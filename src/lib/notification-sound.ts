/**
 * Notification sound generator using Web Audio API — no asset required.
 * Plays a short two-tone alert. Falls back silently if AudioContext is blocked
 * (e.g., no user gesture yet).
 */

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AC = (window.AudioContext || (window as any).webkitAudioContext) as
    | typeof AudioContext
    | undefined;
  if (!AC) return null;
  if (!ctx) {
    try { ctx = new AC(); } catch { return null; }
  }
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

/** Play one tone for `duration` seconds at `freq` Hz, starting `delay` seconds from now. */
function tone(freq: number, duration: number, delay: number, volume = 0.18) {
  const c = getCtx();
  if (!c) return;
  const t0 = c.currentTime + delay;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(freq, t0);
  // Quick attack + smooth decay → bell-like
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(volume, t0 + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(gain).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

/** Pleasant two-tone alert (~0.5s). */
export function playAlert() {
  tone(880, 0.22, 0);
  tone(1175, 0.32, 0.18); // perfect fifth
}

/* ----------------------------------------------------------
 * Loud, attention-grabbing alarm (siren-like) that loops until stopped.
 * Use for high-priority pushes (nova viagem, ocorrência crítica).
 * -------------------------------------------------------- */

let urgentTimer: number | null = null;
let urgentStop: (() => void) | null = null;

/** Single siren sweep: ~1.2s rising then falling tone at high volume. */
function sirenSweep(c: AudioContext, t0: number, volume = 0.55) {
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = "square"; // brighter, louder perception
  // Frequency sweep 700 → 1300 → 700
  osc.frequency.setValueAtTime(700, t0);
  osc.frequency.linearRampToValueAtTime(1300, t0 + 0.45);
  osc.frequency.linearRampToValueAtTime(700, t0 + 0.9);
  // Envelope with strong attack
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(volume, t0 + 0.03);
  gain.gain.setValueAtTime(volume, t0 + 0.85);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.0);
  osc.connect(gain).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + 1.05);
}

/**
 * Start a loud looping siren + repeating vibration. Loops until stopUrgentAlarm()
 * is called or the optional `maxLoops` is reached (default 6 ≈ 7.5s, enough to wake
 * a driver but not annoying forever).
 */
export function playUrgentAlarm(maxLoops = 6) {
  stopUrgentAlarm();
  const c = getCtx();
  if (!c) return;
  let count = 0;
  const period = 1.25; // 1s siren + 0.25s gap
  function fire() {
    if (!c) return;
    sirenSweep(c, c.currentTime + 0.02);
    vibrate([500, 120, 500, 120, 500]);
    count++;
    if (count >= maxLoops) return;
    urgentTimer = window.setTimeout(fire, period * 1000);
  }
  fire();
  urgentStop = () => {
    if (urgentTimer != null) { clearTimeout(urgentTimer); urgentTimer = null; }
    try { c.suspend().then(() => c.resume()).catch(() => {}); } catch { /* ignore */ }
  };
}

export function stopUrgentAlarm() {
  if (urgentStop) { urgentStop(); urgentStop = null; }
  if (urgentTimer != null) { clearTimeout(urgentTimer); urgentTimer = null; }
}

/** Subtle confirmation tone (~0.15s). */
export function playTick() {
  tone(660, 0.12, 0);
}

/** Vibrate device if supported. */
export function vibrate(pattern: number | number[] = [200, 80, 200]) {
  if (typeof navigator === "undefined") return;
  if (typeof navigator.vibrate === "function") {
    try { navigator.vibrate(pattern); } catch { /* ignore */ }
  }
}

/** Try to show a browser/system notification. Returns whether it was shown. */
export function showBrowserNotification(
  title: string,
  options: NotificationOptions = {},
): boolean {
  if (typeof window === "undefined") return false;
  if (!("Notification" in window)) return false;
  if (Notification.permission !== "granted") return false;
  try {
    // Prefer Service Worker so notifications survive tab focus changes
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistration().then((reg) => {
        if (reg) {
          reg.showNotification(title, {
            icon: "/icon-192.svg",
            badge: "/icon-192.svg",
            vibrate: [200, 80, 200],
            ...options,
          } as any).catch(() => new Notification(title, options));
        } else {
          new Notification(title, options);
        }
      }).catch(() => { try { new Notification(title, options); } catch { /* ignore */ } });
    } else {
      new Notification(title, options);
    }
    return true;
  } catch {
    return false;
  }
}

/** Ask permission. Returns "granted" | "denied" | "default". */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === "undefined" || !("Notification" in window)) return "denied";
  if (Notification.permission === "granted" || Notification.permission === "denied") {
    return Notification.permission;
  }
  try {
    return await Notification.requestPermission();
  } catch {
    return "denied";
  }
}

/** Prime the AudioContext from a user gesture so future plays don't get blocked. */
export function primeAudio() {
  const c = getCtx();
  if (!c) return;
  // Play a near-silent blip to satisfy autoplay policy
  tone(440, 0.01, 0, 0.0001);
}
