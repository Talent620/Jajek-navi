// Pasek czasu pracy kierowcy (busiarz): zmiana / jazda / przerwa + przypomnienie.
import { useEffect, useState } from 'react';
import { useShiftStore } from '../store/shiftStore';
import { formatClock } from '../lib/format';

export function ShiftBar() {
  const s = useShiftStore();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!s.shiftStart) {
    return (
      <div className="shift-bar">
        <span className="shift-idle">Zmiana niezarozpoczęta</span>
        <button className="btn-shift start" onClick={s.startShift}>
          ▶ Rozpocznij pracę
        </button>
      </div>
    );
  }

  const driving = s.drivingSeconds(now);
  const overdue = driving >= s.breakReminderSeconds;

  return (
    <div className={`shift-bar active ${overdue ? 'overdue' : ''}`}>
      <div className="shift-times">
        <span>⏱ Zmiana {formatClock(s.shiftSeconds(now))}</span>
        <span>🚚 Jazda {formatClock(driving)}</span>
        {s.onBreak && <span className="break-on">☕ Przerwa</span>}
      </div>
      {overdue && !s.onBreak && <span className="shift-warn">Czas na przerwę!</span>}
      <div className="shift-actions">
        {s.onBreak ? (
          <button className="btn-shift" onClick={s.endBreak}>
            Koniec przerwy
          </button>
        ) : (
          <button className="btn-shift" onClick={s.startBreak}>
            ☕ Przerwa
          </button>
        )}
        <button className="btn-shift stop" onClick={s.endShift}>
          ⏹ Koniec
        </button>
      </div>
    </div>
  );
}
