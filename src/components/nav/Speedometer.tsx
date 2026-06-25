// Prędkościomierz HUD — neonowy łuk z aktualną prędkością.
interface Props {
  speedMps: number | null | undefined;
  maxKmh?: number;
}

export function Speedometer({ speedMps, maxKmh = 140 }: Props) {
  const kmh = Math.max(0, Math.round((speedMps ?? 0) * 3.6));
  const pct = Math.min(1, kmh / maxKmh);
  // łuk 270° (od -225° do +45°)
  const R = 40;
  const C = 2 * Math.PI * R;
  const arc = C * 0.75; // 270°
  const dash = arc * pct;

  return (
    <div className="speedo">
      <svg viewBox="0 0 100 100" className="speedo-svg">
        <circle
          cx="50"
          cy="50"
          r={R}
          className="speedo-track"
          strokeDasharray={`${arc} ${C}`}
          transform="rotate(135 50 50)"
        />
        <circle
          cx="50"
          cy="50"
          r={R}
          className="speedo-fill"
          strokeDasharray={`${dash} ${C}`}
          transform="rotate(135 50 50)"
        />
      </svg>
      <div className="speedo-center">
        <span className="speedo-val">{kmh}</span>
        <span className="speedo-unit">km/h</span>
      </div>
    </div>
  );
}
