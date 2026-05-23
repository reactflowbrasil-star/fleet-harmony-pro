import { useRef, useState } from "react";
import { Camera, ImagePlus, X } from "lucide-react";

interface Props {
  value: File[];
  onChange: (files: File[]) => void;
  max?: number;
}

export function PhotoCapture({ value, onChange, max = 4 }: Props) {
  const inputCameraRef = useRef<HTMLInputElement>(null);
  const inputGalleryRef = useRef<HTMLInputElement>(null);
  const [previews, setPreviews] = useState<string[]>(() => value.map((f) => URL.createObjectURL(f)));

  function addFiles(files: FileList | null) {
    if (!files) return;
    const incoming = Array.from(files).slice(0, max - value.length);
    if (!incoming.length) return;
    const next = [...value, ...incoming];
    onChange(next);
    setPreviews((p) => [...p, ...incoming.map((f) => URL.createObjectURL(f))]);
  }
  function remove(i: number) {
    const nextFiles = value.filter((_, idx) => idx !== i);
    const nextPrev = previews.filter((_, idx) => idx !== i);
    URL.revokeObjectURL(previews[i]);
    onChange(nextFiles);
    setPreviews(nextPrev);
  }

  const canAdd = value.length < max;
  return (
    <div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {previews.map((src, i) => (
          <div key={i} className="relative aspect-square overflow-hidden rounded-md border border-border bg-muted">
            <img src={src} alt={`Foto ${i + 1}`} className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => remove(i)}
              className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-foreground/80 text-background hover:bg-foreground"
              aria-label="Remover"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        {canAdd && (
          <div className="flex aspect-square flex-col items-center justify-center gap-1.5 rounded-md border border-dashed border-border bg-muted/40 p-2">
            <button
              type="button"
              onClick={() => inputCameraRef.current?.click()}
              className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-md bg-primary text-xs font-medium text-primary-foreground hover:opacity-90"
            >
              <Camera className="h-3.5 w-3.5" /> Foto
            </button>
            <button
              type="button"
              onClick={() => inputGalleryRef.current?.click()}
              className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-md border border-border text-xs font-medium hover:bg-card"
            >
              <ImagePlus className="h-3.5 w-3.5" /> Galeria
            </button>
          </div>
        )}
      </div>
      <p className="mt-1.5 text-[11px] text-muted-foreground">
        {value.length}/{max} foto{value.length === 1 ? "" : "s"} · até {max}
      </p>

      <input
        ref={inputCameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }}
      />
      <input
        ref={inputGalleryRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }}
      />
    </div>
  );
}
