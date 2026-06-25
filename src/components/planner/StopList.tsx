// Lista przystanków: kolejność, notatka „co tu zrobić", zadania check-listy.
// Zmiana kolejności przyciskami ↑/↓ (niezawodne na dotyku). TODO: drag&drop.
import { useState } from 'react';
import type { Stop } from '../../types';

interface Props {
  stops: Stop[];
  onMove: (orderedIds: string[]) => void;
  onRemove: (stopId: string) => void;
  onNotes: (stopId: string, notes: string) => void;
  onAddTask: (stopId: string, text: string) => void;
  onRemoveTask: (stopId: string, taskId: string) => void;
  onToggleTask: (stopId: string, taskId: string) => void;
}

export function StopList({
  stops,
  onMove,
  onRemove,
  onNotes,
  onAddTask,
  onRemoveTask,
  onToggleTask,
}: Props) {
  const ordered = [...stops].sort((a, b) => a.order - b.order);

  const move = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= ordered.length) return;
    const ids = ordered.map((s) => s.id);
    [ids[index], ids[target]] = [ids[target], ids[index]];
    onMove(ids);
  };

  return (
    <div className="stop-list">
      {ordered.length === 0 && <p className="empty">Dodaj pierwszy przystanek powyżej.</p>}
      {ordered.map((stop, i) => (
        <StopRow
          key={stop.id}
          stop={stop}
          index={i}
          isFirst={i === 0}
          isLast={i === ordered.length - 1}
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
  isFirst: boolean;
  isLast: boolean;
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
  isFirst,
  isLast,
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

  const done = stop.tasks.filter((t) => t.done).length;

  return (
    <div className="stop-row">
      <div className="stop-row-head">
        <span className="stop-order">{index + 1}</span>
        <div className="stop-main" onClick={() => setExpanded((v) => !v)}>
          <strong>{stop.label}</strong>
          <span className="stop-address">{stop.address}</span>
          {stop.tasks.length > 0 && (
            <span className="stop-task-count">
              Zadania: {done}/{stop.tasks.length}
            </span>
          )}
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
        </div>
      )}
    </div>
  );
}
