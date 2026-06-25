// Pojedyncze zadanie z dużym przyciskiem „Zrobione" (driving-friendly).
import type { Task } from '../../types';

interface Props {
  task: Task;
  onToggle: (done: boolean) => void;
}

export function TaskItem({ task, onToggle }: Props) {
  return (
    <div className={`task-item ${task.done ? 'done' : ''}`}>
      <div className="task-text">
        <span className="task-check">{task.done ? '✓' : '○'}</span>
        <span>{task.text}</span>
      </div>
      <button
        className={`task-done-btn ${task.done ? 'is-done' : ''}`}
        onClick={() => onToggle(!task.done)}
        aria-pressed={task.done}
      >
        {task.done ? 'Cofnij' : 'Zrobione'}
      </button>
    </div>
  );
}
