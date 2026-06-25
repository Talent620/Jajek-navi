// Konfetti — animacja sukcesu (koniec dnia / wszystkie dostawy zrobione).
import { useEffect, useRef } from 'react';

interface Props {
  onDone?: () => void;
  durationMs?: number;
}

export function Confetti({ onDone, durationMs = 2600 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const W = (canvas.width = canvas.clientWidth);
    const H = (canvas.height = canvas.clientHeight);
    const colors = ['#22d3ee', '#38bdf8', '#a855f7', '#34d399', '#fbbf24', '#f472b6'];
    const N = 140;
    const parts = Array.from({ length: N }, (_, i) => ({
      x: W / 2 + (Math.sin(i) * W) / 6,
      y: H * 0.3,
      vx: (((i * 37) % 100) / 100 - 0.5) * 8,
      vy: -6 - ((i * 13) % 60) / 10,
      size: 4 + ((i * 7) % 6),
      color: colors[i % colors.length],
      rot: (i * 23) % 360,
      vr: (((i * 17) % 20) - 10) / 3,
    }));

    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = now - start;
      ctx.clearRect(0, 0, W, H);
      for (const p of parts) {
        p.vy += 0.18; // grawitacja
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rot * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.max(0, 1 - t / durationMs);
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 1.6);
        ctx.restore();
      }
      if (t < durationMs) raf = requestAnimationFrame(tick);
      else onDone?.();
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [durationMs, onDone]);

  return <canvas ref={canvasRef} className="confetti-canvas" />;
}
