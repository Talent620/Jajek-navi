import { useEffect, useState } from 'react';
import { PlannerScreen } from './screens/PlannerScreen';
import { NavigationScreen } from './screens/NavigationScreen';
import { TripsScreen } from './screens/TripsScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { UpdateBanner } from './components/UpdateBanner';
import { OfflineBanner } from './components/OfflineBanner';
import { initStatusBar } from './services/deviceService';

type Screen = 'planner' | 'navigation' | 'trips' | 'settings';

export default function App() {
  const [screen, setScreen] = useState<Screen>('planner');

  useEffect(() => {
    void initStatusBar();
  }, []);

  return (
    <div className="app">
      <OfflineBanner />
      {screen !== 'navigation' && <UpdateBanner />}

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
        {screen === 'settings' && <SettingsScreen />}
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
          <button
            className={screen === 'settings' ? 'active' : ''}
            onClick={() => setScreen('settings')}
          >
            ⚙ Ustawienia
          </button>
        </nav>
      )}
    </div>
  );
}
