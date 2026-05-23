import { useEffect, useImperativeHandle, useRef, useState, forwardRef } from "react";
import { Eraser } from "lucide-react";

export interface SignaturePadHandle {
  clear: () => void;
  toDataURL: (type?: string) => string;
  isEmpty: () => boolean;
}

interface Props {
  height?: number;
  strokeColor?: string;
  background?: string;
  className?: string;
  onChange?: (hasInk: boolean) => void;
}

/** Touch- and mouse-aware signature pad on a canvas with high-DPI scaling. */
export const SignaturePad = forwardRef<SignaturePadHandle, Props>(function SignaturePad(
  { height = 200, strokeColor = "#0f172a", background = "#fff", className, onChange },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const hadInkRef = useRef(false);
  const [, force] = useState(0);

  // Init + DPR scaling + resize observer
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctxRef.current = ctx;

    function resize() {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      const c = ctxRef.current!;
      c.scale(dpr, dpr);
      c.fillStyle = background;
      c.fillRect(0, 0, rect.width, rect.height);
      c.lineCap = "round";
      c.lineJoin = "round";
      c.strokeStyle = strokeColor;
      c.lineWidth = 2.4;
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [background, strokeColor]);

  useImperativeHandle(ref, () => ({
    clear() {
      const canvas = canvasRef.current;
      const c = ctxRef.current;
      if (!canvas || !c) return;
      const rect = canvas.getBoundingClientRect();
      c.save();
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.clearRect(0, 0, canvas.width, canvas.height);
      c.restore();
      c.fillStyle = background;
      c.fillRect(0, 0, rect.width, rect.height);
      hadInkRef.current = false;
      onChange?.(false);
      force((n) => n + 1);
    },
    toDataURL(type = "image/png") {
      return canvasRef.current?.toDataURL(type) ?? "";
    },
    isEmpty() {
      return !hadInkRef.current;
    },
  }));

  function getPoint(e: PointerEvent | React.PointerEvent): { x: number; y: number } | null {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return { x: (e as any).clientX - rect.left, y: (e as any).clientY - rect.top };
  }

  function down(e: React.PointerEvent<HTMLCanvasElement>) {
    e.preventDefault();
    const p = getPoint(e);
    if (!p) return;
    (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
    drawingRef.current = true;
    lastPointRef.current = p;
    const c = ctxRef.current!;
    c.beginPath();
    c.moveTo(p.x, p.y);
    c.lineTo(p.x + 0.01, p.y + 0.01); // dot for a single tap
    c.stroke();
    if (!hadInkRef.current) {
      hadInkRef.current = true;
      onChange?.(true);
      force((n) => n + 1);
    }
  }

  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    e.preventDefault();
    const p = getPoint(e);
    const last = lastPointRef.current;
    if (!p || !last) return;
    const c = ctxRef.current!;
    c.beginPath();
    c.moveTo(last.x, last.y);
    c.lineTo(p.x, p.y);
    c.stroke();
    lastPointRef.current = p;
  }

  function up(e: React.PointerEvent<HTMLCanvasElement>) {
    drawingRef.current = false;
    lastPointRef.current = null;
    try { (e.target as HTMLCanvasElement).releasePointerCapture(e.pointerId); } catch { /* ignore */ }
  }

  return (
    <div
      className={"relative overflow-hidden rounded-lg border border-border bg-white " + (className ?? "")}
      style={{ height, touchAction: "none" }}
    >
      <canvas
        ref={canvasRef}
        className="block h-full w-full cursor-crosshair"
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
      />
      <button
        type="button"
        onClick={() => (ref && typeof ref !== "function" && ref.current?.clear())}
        className="absolute right-2 top-2 inline-flex h-8 items-center gap-1 rounded-md border border-border bg-card/90 px-2 text-[11px] font-medium text-foreground/80 backdrop-blur hover:bg-accent"
        aria-label="Limpar assinatura"
      >
        <Eraser className="h-3.5 w-3.5" /> Limpar
      </button>
      {!hadInkRef.current && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
          Assine com o dedo
        </div>
      )}
    </div>
  );
});
