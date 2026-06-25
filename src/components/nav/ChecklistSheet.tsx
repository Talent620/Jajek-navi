// Bottom-sheet check-listy przystanku — kluczowe odróżnienie od TomToma.
// Wysuwa się automatycznie po dojechaniu; „Zrobione" zapisuje stan.
// Komenda głosowa „Zrobione" (Web Speech Recognition) — z fallbackiem na przycisk.
import { useEffect, useRef, useState } from 'react';
import type { Stop } from '../../types';
import { TaskItem } from './TaskItem';

interface Props {
  stop: Stop | null;
  onToggleTask: (taskId: string, done: boolean) => void;
  onAddTask: (text: string) => void;
  onTaskPhoto: (taskId: string, photoUri: string) => void;
  onSkip: (reason: string) => void;
  onClose: () => void;
  onNext: () => void;
  hasNext: boolean;
}

export function ChecklistSheet({
  stop,
  onToggleTask,
  onAddTask,
  onTaskPhoto,
  onSkip,
  onClose,
  onNext,
  hasNext,
}: Props) {
  const [newTask, setNewTask] = useState('');
  const [listening, setListening] = useState(false);
  const recRef = useRef<any>(null);

  // Komenda głosowa „Zrobione" — odhacza pierwsze nieukończone zadanie.
  useEffect(() => {
    const SR =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR || !stop) return;
    const rec = new SR();
    rec.lang = 'pl-PL';
    rec.continuous = true;
    rec.interimResults = false;
    rec.onresult = (e: any) => {
      const text = String(e.results[e.results.length - 1][0].transcript).toLowerCase();
      if (text.includes('zrobione') || text.includes('gotowe')) {
        const next = stop.tasks.find((t) => !t.done);
        if (next) onToggleTask(next.id, true);
      }
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    recRef.current = rec;
    return () => {
      try {
        rec.stop();
      } catch {
        /* ignoruj */
      }
    };
  }, [stop, onToggleTask]);

  if (!stop) return null;

  const tasksDone = stop.tasks.filter((t) => t.done).length;
  const allDone = stop.tasks.length > 0 && tasksDone === stop.tasks.length;

  const toggleListen = () => {
    const rec = recRef.current;
    if (!rec) return;
    if (listening) {
      rec.stop();
      setListening(false);
    } else {
      try {
        rec.start();
        setListening(true);
      } catch {
        setListening(false);
      }
    }
  };

  const voiceAvailable =
    typeof window !== 'undefined' &&
    ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

  return (
    <div className="checklist-sheet" role="dialog" aria-label={`Zadania: ${stop.label}`}>
      <div className="sheet-handle" onClick={onClose} />
      <div className="sheet-header">
        <div>
          <h2>{stop.label}</h2>
          <p className="sheet-address">{stop.address}</p>
        </div>
        <span className={`sheet-badge ${allDone ? 'done' : ''}`}>
          {tasksDone}/{stop.tasks.length}
        </span>
      </div>

      {stop.notes && (
        <div className="sheet-notes">
          <strong>Co tu zrobić:</strong> {stop.notes}
        </div>
      )}

      <div className="task-list">
        {stop.tasks.length === 0 && <p className="empty">Brak zadań dla tego przystanku.</p>}
        {stop.tasks.map((t) => (
          <TaskItem
            key={t.id}
            task={t}
            onToggle={(done) => onToggleTask(t.id, done)}
            onPhoto={(uri) => onTaskPhoto(t.id, uri)}
          />
        ))}
      </div>

      <div className="sheet-add-task">
        <input
          value={newTask}
          onChange={(e) => setNewTask(e.target.value)}
          placeholder="Dodaj zadanie…"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && newTask.trim()) {
              onAddTask(newTask.trim());
              setNewTask('');
            }
          }}
        />
        <button
          onClick={() => {
            if (newTask.trim()) {
              onAddTask(newTask.trim());
              setNewTask('');
            }
          }}
        >
          +
        </button>
      </div>

      <div className="sheet-actions">
        {voiceAvailable && (
          <button className={`btn-voice ${listening ? 'active' : ''}`} onClick={toggleListen}>
            {listening ? '🎙 Słucham… („Zrobione")' : '🎙 Komenda głosowa'}
          </button>
        )}
        {allDone && hasNext ? (
          <button className="btn-next" onClick={onNext}>
            Następny przystanek →
          </button>
        ) : (
          <button className="btn-secondary" onClick={onClose}>
            Zwiń
          </button>
        )}
        <button
          className="btn-skip"
          onClick={() => {
            const reason = prompt('Powód pominięcia / przełożenia przystanku:', 'Klient nieobecny');
            if (reason !== null) {
              onSkip(reason);
              onClose();
              if (hasNext) onNext();
            }
          }}
        >
          ⏭ Pomiń / przełóż przystanek
        </button>
      </div>
    </div>
  );
}
