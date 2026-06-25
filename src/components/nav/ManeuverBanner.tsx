// Baner manewru u góry ekranu nawigacji.
import type { ManeuverStep } from '../../types';
import { formatDistance } from '../../lib/format';

interface Props {
  step: ManeuverStep | null;
  distanceToManeuver: number;
  rerouting?: boolean;
}

/** Prosta ikona kierunku na bazie type/modifier. */
function maneuverIcon(step: ManeuverStep | null): string {
  if (!step) return '•';
  const m = step.modifier ?? '';
  if (step.type === 'arrive') return '🏁';
  if (step.type === 'depart') return '⬆';
  if (m.includes('left')) return m.includes('slight') ? '↖' : '⬅';
  if (m.includes('right')) return m.includes('slight') ? '↗' : '➡';
  if (m.includes('uturn')) return '↩';
  if (m.includes('straight')) return '⬆';
  return '⬆';
}

export function ManeuverBanner({ step, distanceToManeuver, rerouting }: Props) {
  if (rerouting) {
    return (
      <div className="maneuver-banner rerouting">
        <div className="maneuver-icon">↻</div>
        <div className="maneuver-text">
          <div className="maneuver-instruction">Przeliczam trasę…</div>
        </div>
      </div>
    );
  }
  if (!step) {
    return (
      <div className="maneuver-banner">
        <div className="maneuver-icon">•</div>
        <div className="maneuver-text">
          <div className="maneuver-instruction">Gotowy do jazdy</div>
        </div>
      </div>
    );
  }
  return (
    <div className="maneuver-banner">
      <div className="maneuver-icon">{maneuverIcon(step)}</div>
      <div className="maneuver-text">
        <div className="maneuver-distance">{formatDistance(distanceToManeuver)}</div>
        <div className="maneuver-instruction">{step.instruction}</div>
      </div>
    </div>
  );
}
