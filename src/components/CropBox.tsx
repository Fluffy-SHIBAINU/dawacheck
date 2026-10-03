import { useRef, useState, type PointerEvent } from 'react';
import type { Crop } from '../ocr/preprocess';

export function CropBox({ src, onChange }: { src: string; onChange: (c: Crop | null) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [start, setStart] = useState<{ x: number; y: number } | null>(null);
  const [rect, setRect] = useState<Crop | null>(null);

  const point = (e: PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    return { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) };
  };

  return (
    <div
      ref={ref}
      className="photo"
      onPointerDown={(e) => {
        (e.target as Element).setPointerCapture?.(e.pointerId);
        setStart(point(e));
        setRect(null);
      }}
      onPointerMove={(e) => {
        if (!start) return;
        const p = point(e);
        setRect({ x: Math.min(start.x, p.x), y: Math.min(start.y, p.y), w: Math.abs(p.x - start.x), h: Math.abs(p.y - start.y) });
      }}
      onPointerUp={() => {
        setStart(null);
        onChange(rect && rect.w > 0.03 && rect.h > 0.02 ? rect : null);
      }}
      data-testid="crop-area"
    >
      <img src={src} alt="" />
      {rect && <div className="cropbox" style={{ left: `${rect.x * 100}%`, top: `${rect.y * 100}%`, width: `${rect.w * 100}%`, height: `${rect.h * 100}%` }} />}
    </div>
  );
}
