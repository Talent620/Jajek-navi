import { useState } from 'react';
import { PlannerScreen } from './screens/PlannerScreen';
import { NavigationScreen } from './screens/NavigationScreen';
import { TripsScreen } from './screens/TripsScreen';

type Screen = 'planner' | 'navigation' | 'trips';

export default function App() {
  const [screen, setScreen] = useState<Screen>('planner');

  return (
    <div className="app">
      <main className="app-main">
        {screen === 'planner' && (
          <PlannerScreen onStartNavigation={() => setScreen('navigation')} />
        )}
        {screen === 'navigation' && (
          <NavigationScreen onExit={() => setScreen('planner')} />
        )}
        {screen === 'trips' && (
          <TripsScreen onOpenPlanner={() => setScreen('planner')} />
        )}
      </main>

      {screen !== 'navigation' && (
        <nav className="tab-bar">
          <button
            className={screen === 'planner' ? 'active' : ''}
            onClick={() => setScreen('planner')}
          >
            🗺 Planowanie
          </button>
          <button
            className={screen === 'trips' ? 'active' : ''}
            onClick={() => setScreen('trips')}
          >
            📚 Historia
          </button>
        </nav>
      )}
    </div>
  );
}
