// Model danych aplikacji — zgodny ze specyfikacją (sekcja 3).
import type { LineString } from 'geojson';

export interface Task {
  id: string;
  text: string; // np. "Odebrać podpis na protokole"
  done: boolean;
  doneAt?: string; // ISO timestamp
  note?: string; // opcjonalna notatka kierowcy
  photoUri?: string; // opcjonalne zdjęcie jako dowód wykonania
}

export interface Stop {
  id: string;
  label: string; // nazwa klienta / punktu
  address: string;
  lat: number;
  lng: number;
  order: number; // kolejność po optymalizacji
  arrived: boolean; // czy kierowca dojechał (auto przy ~50 m)
  arrivedAt?: string;
  completed: boolean; // czy wszystkie zadania odhaczone
  skipped?: boolean; // przystanek pominięty / przełożony
  skipReason?: string; // powód pominięcia
  notes?: string; // "co tu zrobić" — instrukcja dla kierowcy
  tasks: Task[];
}

export interface ManeuverStep {
  instruction: string; // tekst instrukcji ("Skręć w prawo w...")
  voiceInstruction: string; // wersja do TTS
  maneuverLat: number;
  maneuverLng: number;
  distanceMeters: number; // dystans tego kroku
  type: string; // turn / merge / arrive...
  modifier?: string; // left / right / straight...
}

export interface RouteLeg {
  fromStopId: string;
  toStopId: string;
  distanceMeters: number;
  durationSeconds: number;
  steps: ManeuverStep[]; // z Mapbox Directions
  geometry: LineString;
}

export type TripStatus = 'planned' | 'active' | 'completed';

export interface Trip {
  id: string;
  name: string; // np. "Trasa Olsztyn – wtorek"
  date: string; // ISO
  status: TripStatus;
  startLat?: number;
  startLng?: number;
  stops: Stop[];
  legs: RouteLeg[];
  totalDistanceMeters: number;
  totalDurationSeconds: number;
  createdAt: string;
  completedAt?: string;
}

/** Prosty typ pozycji używany w warstwie nawigacji. */
export interface LngLat {
  lng: number;
  lat: number;
}

export interface Fix extends LngLat {
  accuracy?: number;
  heading?: number | null;
  speed?: number | null;
  timestamp?: number;
}
