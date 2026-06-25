// Lista przystanków: kolejność (drag&drop ⠿ + przyciski ↑/↓), kontakt, okno
// czasowe, pobranie, paczki, notatka „co tu zrobić", zadania check-listy.
import { useEffect, useRef, useState } from 'react';
import type { Stop } from '../../types';
import { useTripStore } from '../../store/tripStore';
import { Collapsible } from '../Collapsible';
import { formatDuration } from '../../lib/format';

interface Props {
  stops: Stop[];
  etaByStopId?: Record<string, number>;
  onMove: (orderedIds: string[]) => void;
  onRemove: (stopId: string) => void;
  onNotes: (stopId: string, notes: string) => void;
  onAddTask: (stopId: string, text: string) => void;
  onRemoveTask: (stopId: string, taskId: string) => void;
  onToggleTask: (stopId: string, taskId: string) => void;
}

export function StopList({
  stops,
  etaByStopId,
  onMove,
  onRemove,
  onNotes,
  onAddTask,
  onRemoveTask,
  onToggleTask,
}: Props) {
  const ordered = [...stops].sort((a, b) => a.order - b.order);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);

  const move = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= ordered.length) return;
    const ids = ordered.map((s) => s.id);
    [ids[index], ids[target]] = [ids[target], ids[index]];
    onMove(ids);
  };

  // Drag&drop: śledzimy palec/mysz globalnie i wstawiamy przeciągany wiersz
  // tam, gdzie aktualnie jest kursor (live reorder).
  useEffect(() => {
    if (!dragId) return;
    const onPointerMove = (e: PointerEvent) => {
      const cont = containerRef.current;
      if (!cont) return;
      const rows = Array.from(cont.querySelectorAll<HTMLElement>('.stop-row[data-id]'));
      let targetId: string | null = null;
      for (const row of rows) {
        const r = row.getBoundingClientRect();
        if (e.clientY >= r.top && e.clientY <= r.bottom) {
          targetId = row.dataset.id ?? null;
          break;
        }
      }
      if (targetId && targetId !== dragId) {
        const ids = rows.map((r) => r.dataset.id!).filter(Boolean);
        const from = ids.indexOf(dragId);
        const to = ids.indexOf(targetId);
        if (from > -1 && to > -1) {
          ids.splice(to, 0, ids.splice(from, 1)[0]);
          onMove(ids);
        }
      }
    };
    const onUp = () => setDragId(null);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [dragId, onMove]);

  return (
    <div className="stop-list" ref={containerRef}>
      {ordered.length === 0 && <p className="empty">Dodaj pierwszy przystanek powyżej.</p>}
      {ordered.map((stop, i) => (
        <StopRow
          key={stop.id}
          stop={stop}
          index={i}
          eta={etaByStopId?.[stop.id]}
          isFirst={i === 0}
          isLast={i === ordered.length - 1}
          dragging={dragId === stop.id}
          onDragStart={() => setDragId(stop.id)}
          onMoveUp={() => move(i, -1)}
          onMoveDown={() => move(i, 1)}
          onRemove={() => onRemove(stop.id)}
          onNotes={(notes) => onNotes(stop.id, notes)}
          onAddTask={(text) => onAddTask(stop.id, text)}
          onRemoveTask={(taskId) => onRemoveTask(stop.id, taskId)}
          onToggleTask={(taskId) => onToggleTask(stop.id, taskId)}
        />
      ))}
    </div>
  );
}

interface RowProps {
  stop: Stop;
  index: number;
  eta?: number;
  isFirst: boolean;
  isLast: boolean;
  dragging: boolean;
  onDragStart: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
  onNotes: (notes: string) => void;
  onAddTask: (text: string) => void;
  onRemoveTask: (taskId: string) => void;
  onToggleTask: (taskId: string) => void;
}

function StopRow({
  stop,
  index,
  eta,
  isFirst,
  isLast,
  dragging,
  onDragStart,
  onMoveUp,
  onMoveDown,
  onRemove,
  onNotes,
  onAddTask,
  onRemoveTask,
  onToggleTask,
}: RowProps) {
  const [expanded, setExpanded] = useState(false);
  const [taskText, setTaskText] = useState('');
  const [parcelCode, setParcelCode] = useState('');

  const setStopContact = useTripStore((s) => s.setStopContact);
  const setStopWindow = useTripStore((s) => s.setStopWindow);
  const setStopCod = useTripStore((s) => s.setStopCod);
  const addParcel = useTripStore((s) => s.addParcel);
  const removeParcel = useTripStore((s) => s.removeParcel);

  const done = stop.tasks.filter((t) => t.done).length;
  const parcels = stop.parcels ?? [];

  return (
    <div className={`stop-row ${dragging ? 'dragging' : ''}`} data-id={stop.id}>
      <div className="stop-row-head">
        <button
          className="drag-handle"
          aria-label="Przeciągnij, by zmienić kolejność"
          onPointerDown={(e) => {
            e.preventDefault();
            onDragStart();
          }}
        >
          ⠿
        </button>
        <span className="stop-order">{index + 1}</span>
        <div className="stop-main" onClick={() => setExpanded((v) => !v)}>
          <strong>{stop.label}</strong>
          <span className="stop-address">{stop.address}</span>
          <span className="stop-chips">
            {stop.tasks.length > 0 && <span className="chip">✓ {done}/{stop.tasks.length}</span>}
            {parcels.length > 0 && <span className="chip">📦 {parcels.length}</span>}
            {stop.codAmount ? <span className="chip cod">💰</span> : null}
            {eta != null && eta > 0 && <span className="chip eta">⏱ {formatDuration(eta)}</span>}
            {stop.phone && <span className="chip">📞</span>}
            {(stop.windowStart || stop.windowEnd) && (
              <span className="chip">🕒 {stop.windowStart || ''}-{stop.windowEnd || ''}</span>
            )}
          </span>
        </div>
        <div className="stop-row-actions">
          <button disabled={isFirst} onClick={onMoveUp} aria-label="W górę">
            ↑
          </button>
          <button disabled={isLast} onClick={onMoveDown} aria-label="W dół">
            ↓
          </button>
          <button className="danger" onClick={onRemove} aria-label="Usuń">
            ✕
          </button>
        </div>
      </div>

      {expanded && (
        <div className="stop-row-body">
          <label className="field-label">Co tu zrobić (notatka)</label>
          <textarea
            value={stop.notes ?? ''}
            onChange={(e) => onNotes(e.target.value)}
            placeholder="np. Odebrać podpis, zostawić paczkę w recepcji…"
            rows={2}
          />

          <label className="field-label">Check-lista zadań</label>
          <div className="stop-tasks">
            {stop.tasks.map((t) => (
              <div key={t.id} className={`stop-task ${t.done ? 'done' : ''}`}>
                <button className="task-toggle" onClick={() => onToggleTask(t.id)}>
                  {t.done ? '✓' : '○'}
                </button>
                <span>{t.text}</span>
                <button className="task-del" onClick={() => onRemoveTask(t.id)}>
                  ✕
                </button>
              </div>
            ))}
          </div>
          <div className="add-task-row">
            <input
              value={taskText}
              onChange={(e) => setTaskText(e.target.value)}
              placeholder="Dodaj zadanie…"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && taskText.trim()) {
                  onAddTask(taskText.trim());
                  setTaskText('');
                }
              }}
            />
            <button
              onClick={() => {
                if (taskText.trim()) {
                  onAddTask(taskText.trim());
                  setTaskText('');
                }
              }}
            >
              Dodaj
            </button>
          </div>

          {/* DODATKI — kontakt, okno czasowe, pobranie, paczki (ukryte) */}
          <Collapsible
            title="Szczegóły dostawy"
            icon="📦"
            subtitle="kontakt · okno · pobranie · paczki"
            badge={parcels.length || undefined}
          >
            <div className="field-grid">
              <div>
                <label className="field-label">Osoba kontaktowa</label>
                <input
                  value={stop.contactName ?? ''}
                  onChange={(e) => setStopContact(stop.id, e.target.value, stop.phone ?? '')}
                  placeholder="np. Jan Kowalski"
                />
              </div>
              <div>
                <label className="field-label">Telefon</label>
                <input
                  type="tel"
                  value={stop.phone ?? ''}
                  onChange={(e) => setStopContact(stop.id, stop.contactName ?? '', e.target.value)}
                  placeholder="+48…"
                />
              </div>
              <div>
                <label className="field-label">Okno od</label>
                <input
                  type="time"
                  value={stop.windowStart ?? ''}
                  onChange={(e) => setStopWindow(stop.id, e.target.value, stop.windowEnd ?? '')}
                />
              </div>
              <div>
                <label className="field-label">Okno do</label>
                <input
                  type="time"
                  value={stop.windowEnd ?? ''}
                  onChange={(e) => setStopWindow(stop.id, stop.windowStart ?? '', e.target.value)}
                />
              </div>
              <div>
                <label className="field-label">Pobranie (COD)</label>
                <input
                  type="number"
                  inputMode="decimal"
                  value={stop.codAmount ?? ''}
                  onChange={(e) =>
                    setStopCod(stop.id, e.target.value === '' ? undefined : Number(e.target.value))
                  }
                  placeholder="0.00"
                />
              </div>
            </div>

            <label className="field-label">Paczki / przesyłki</label>
            <div className="stop-tasks">
              {parcels.map((p) => (
                <div key={p.id} className="stop-task">
                  <span className="parcel-code">{p.code}</span>
                  {p.label && <span>{p.label}</span>}
                  <button className="task-del" onClick={() => removeParcel(stop.id, p.id)}>
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <div className="add-task-row">
              <input
                value={parcelCode}
                onChange={(e) => setParcelCode(e.target.value)}
                placeholder="Numer przesyłki / kod…"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && parcelCode.trim()) {
                    addParcel(stop.id, parcelCode.trim());
                    setParcelCode('');
                  }
                }}
              />
              <button
                onClick={() => {
                  if (parcelCode.trim()) {
                    addParcel(stop.id, parcelCode.trim());
                    setParcelCode('');
                  }
                }}
              >
                Dodaj
              </button>
            </div>
          </Collapsible>
        </div>
      )}
    </div>
  );
}
