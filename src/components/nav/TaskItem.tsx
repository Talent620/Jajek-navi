// Pojedyncze zadanie z dużym przyciskiem „Zrobione" (driving-friendly)
// oraz zdjęciem-dowodem wykonania (sekcja 4.6).
import { useState } from 'react';
import type { Task } from '../../types';
import { capturePhoto } from '../../services/cameraService';

interface Props {
  task: Task;
  onToggle: (done: boolean) => void;
  onPhoto?: (photoUri: string) => void;
}

export function TaskItem({ task, onToggle, onPhoto }: Props) {
  const [busy, setBusy] = useState(false);

  const takePhoto = async () => {
    if (!onPhoto) return;
    setBusy(true);
    try {
      const uri = await capturePhoto();
      if (uri) onPhoto(uri);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`task-item ${task.done ? 'done' : ''}`}>
      <div className="task-row-main">
        <div className="task-text">
          <span className="task-check">{task.done ? '✓' : '○'}</span>
          <span>{task.text}</span>
        </div>
        <div className="task-buttons">
          {onPhoto && (
            <button
              className={`task-photo-btn ${task.photoUri ? 'has-photo' : ''}`}
              onClick={takePhoto}
              disabled={busy}
              aria-label="Dodaj zdjęcie-dowód"
              title="Zdjęcie-dowód"
            >
              {busy ? '…' : task.photoUri ? '📷✓' : '📷'}
            </button>
          )}
          <button
            className={`task-done-btn ${task.done ? 'is-done' : ''}`}
            onClick={() => onToggle(!task.done)}
            aria-pressed={task.done}
          >
            {task.done ? 'Cofnij' : 'Zrobione'}
          </button>
        </div>
      </div>
      {task.photoUri && (
        <img className="task-photo-thumb" src={task.photoUri} alt="Dowód wykonania" />
      )}
    </div>
  );
}
