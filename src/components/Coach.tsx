// Samouczek pierwszego uruchomienia — pokazuje się raz, tłumaczy jak nawigować.
import { useSettingsStore } from '../store/settingsStore';

const STEPS = [
  { icon: '➕', title: 'Dodaj cel', text: 'W polu „Dodaj przystanek" wpisz adres i dotknij podpowiedzi.' },
  { icon: '▶', title: 'Jedź', text: 'Dotknij „Jedź" — aplikacja wyznaczy trasę i włączy nawigację z głosem.' },
  { icon: '🚗', title: 'Jazda 3D', text: 'W nawigacji włącz „Jazda 3D" — holograficzny widok z perspektywy kierowcy.' },
  { icon: '📍', title: 'Lokalizacja', text: 'Przy starcie zezwól na dostęp do lokalizacji — to ustawia punkt startu.' },
];

export function Coach() {
  const done = useSettingsStore((s) => s.coachDone);
  const setDone = useSettingsStore((s) => s.setCoachDone);
  if (done) return null;
  return (
    <div className="coach">
      <div className="coach-card">
        <div className="coach-logo">🧭</div>
        <h2>Witaj w Jajek Navi</h2>
        <p className="coach-lead">Nawigacja terenowa z check-listą zadań. W skrócie:</p>
        <div className="coach-steps">
          {STEPS.map((s) => (
            <div key={s.title} className="coach-step">
              <span className="coach-step-icon">{s.icon}</span>
              <div>
                <strong>{s.title}</strong>
                <span>{s.text}</span>
              </div>
            </div>
          ))}
        </div>
        <button className="btn-primary big" onClick={() => setDone(true)}>
          Zaczynamy
        </button>
      </div>
    </div>
  );
}
