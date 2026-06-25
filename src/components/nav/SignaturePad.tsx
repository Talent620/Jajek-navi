// Podpis odbiorcy na ekranie dotykowym (canvas) — element POD.
import { useEffect, useRef, useState } from 'react';

interface Props {
  initial?: string;
  onSave: (dataUrl: string) => void;
}

export function SignaturePad({ initial, onSave }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const [hasInk, setHasInk] = useState(!!initial);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = canvas.clientWidth * ratio;
    canvas.height = canvas.clientHeight * ratio;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#0b0f14';
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);
    if (initial) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, canvas.clientWidth, canvas.clientHeight);
      img.src = initial;
    }
  }, [initial]);

  const pos = (e: React.PointerEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const down = (e: React.PointerEvent) => {
    drawing.current = true;
    const ctx = canvasRef.current!.getContext('2d')!;
    const { x, y } = pos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };
  const move = (e: React.PointerEvent) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current!.getContext('2d')!;
    const { x, y } = pos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasInk(true);
  };
  const up = () => {
    drawing.current = false;
  };

  const clear = () => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);
    setHasInk(false);
  };

  const save = () => {
    const canvas = canvasRef.current!;
    onSave(canvas.toDataURL('image/png'));
  };

  return (
    <div className="signature-pad">
      <canvas
        ref={canvasRef}
        className="signature-canvas"
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerLeave={up}
      />
      <div className="signature-actions">
        <button className="btn-secondary" onClick={clear}>
          Wyczyść
        </button>
        <button className="btn-primary" onClick={save} disabled={!hasInk}>
          Zapisz podpis
        </button>
      </div>
    </div>
  );
}
