// Pasek wskaźników nawigacji: ETA, dystans pozostały, prędkość, postęp dnia.
import { formatDistance, formatDuration, formatEta, formatSpeed, formatMoney } from '../../lib/format';
import type { Fix } from '../../types';

interface Props {
  remainingDistance: number;
  remainingDuration: number;
  fix: Fix | null;
  stopsDone: number;
  stopsTotal: number;
  tasksDone: number;
  tasksTotal: number;
  parcelsScanned: number;
  parcelsTotal: number;
  codCollected: number;
  codTotal: number;
  currency: string;
}

export function NavStats({
  remainingDistance,
  remainingDuration,
  fix,
  stopsDone,
  stopsTotal,
  tasksDone,
  tasksTotal,
  parcelsScanned,
  parcelsTotal,
  codCollected,
  codTotal,
  currency,
}: Props) {
  return (
    <div className="nav-stats">
      <div className="stat">
        <span className="stat-value">{formatEta(remainingDuration)}</span>
        <span className="stat-label">Przyjazd</span>
      </div>
      <div className="stat">
        <span className="stat-value">{formatDuration(remainingDuration)}</span>
        <span className="stat-label">Pozostało</span>
      </div>
      <div className="stat">
        <span className="stat-value">{formatDistance(remainingDistance)}</span>
        <span className="stat-label">Dystans</span>
      </div>
      <div className="stat">
        <span className="stat-value">{formatSpeed(fix?.speed)}</span>
        <span className="stat-label">Prędkość</span>
      </div>
      <div className="stat progress">
        <span className="stat-value">
          {stopsDone}/{stopsTotal} • {tasksDone}/{tasksTotal}
          {parcelsTotal > 0 ? ` • 📦 ${parcelsScanned}/${parcelsTotal}` : ''}
          {codTotal > 0 ? ` • 💰 ${formatMoney(codCollected, currency)}/${formatMoney(codTotal, currency)}` : ''}
        </span>
        <span className="stat-label">Przystanki • Zadania{parcelsTotal > 0 ? ' • Paczki' : ''}{codTotal > 0 ? ' • Pobrania' : ''}</span>
      </div>
    </div>
  );
}
