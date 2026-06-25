import { describe, it, expect } from 'vitest';
import {
  haversine,
  bearing,
  distanceToPolyline,
  pointAlongPolyline,
  polylineLength,
} from './geo';
import { nearestNeighbourOrder } from '../../services/mapboxService';
import { combinedRouteCoords, checkOffRoute, initialOffRoute } from './offroute';
import { advanceProgress, initialProgress } from './progress';
import type { RouteLeg } from '../../types';

describe('geo.haversine', () => {
  it('zwraca ~0 dla tego samego punktu', () => {
    expect(haversine({ lat: 53.78, lng: 20.48 }, { lat: 53.78, lng: 20.48 })).toBeLessThan(0.001);
  });
  it('liczy znany dystans (1 stopień szer. ~ 111 km)', () => {
    const d = haversine({ lat: 53, lng: 20 }, { lat: 54, lng: 20 });
    expect(d).toBeGreaterThan(110000);
    expect(d).toBeLessThan(112000);
  });
});

describe('geo.bearing', () => {
  it('na północ ~0°', () => {
    const b = bearing({ lat: 53, lng: 20 }, { lat: 54, lng: 20 });
    expect(b).toBeGreaterThanOrEqual(0);
    expect(b).toBeLessThan(1);
  });
  it('na wschód ~90°', () => {
    const b = bearing({ lat: 53, lng: 20 }, { lat: 53, lng: 21 });
    expect(Math.abs(b - 90)).toBeLessThan(1);
  });
});

describe('geo.distanceToPolyline', () => {
  const line = [
    [20.0, 53.0],
    [20.0, 53.01],
    [20.0, 53.02],
  ];
  it('punkt na linii ma dystans ~0', () => {
    const r = distanceToPolyline({ lat: 53.005, lng: 20.0 }, line);
    expect(r.distance).toBeLessThan(2);
  });
  it('punkt obok linii liczony do odcinka (nie tylko wierzchołka)', () => {
    // punkt na środku odcinka, przesunięty na wschód
    const r = distanceToPolyline({ lat: 53.005, lng: 20.001 }, line);
    expect(r.distance).toBeGreaterThan(50);
    expect(r.distance).toBeLessThan(90);
    expect(r.segmentIndex).toBe(0);
  });
});

describe('geo.pointAlongPolyline / polylineLength', () => {
  const line = [
    [20.0, 53.0],
    [20.0, 53.01],
  ];
  it('długość zgodna z haversine', () => {
    const len = polylineLength(line);
    expect(Math.abs(len - haversine({ lat: 53, lng: 20 }, { lat: 53.01, lng: 20 }))).toBeLessThan(1);
  });
  it('na połowie dystansu zwraca punkt w środku', () => {
    const len = polylineLength(line);
    const { point } = pointAlongPolyline(line, len / 2);
    expect(Math.abs(point.lat - 53.005)).toBeLessThan(0.0005);
  });
  it('poza końcem oznacza reachedEnd', () => {
    const len = polylineLength(line);
    const { reachedEnd } = pointAlongPolyline(line, len + 100);
    expect(reachedEnd).toBe(true);
  });
});

describe('nearestNeighbourOrder', () => {
  it('odwiedza najbliższy punkt jako pierwszy', () => {
    const start = { lat: 0, lng: 0 };
    const stops = [
      { lat: 0, lng: 2 }, // daleki
      { lat: 0, lng: 0.5 }, // bliski
      { lat: 0, lng: 1 }, // średni
    ];
    const order = nearestNeighbourOrder(start, stops);
    expect(order).toEqual([1, 2, 0]);
  });
});

function legFromCoords(coords: number[][]): RouteLeg {
  return {
    fromStopId: 'a',
    toStopId: 'b',
    distanceMeters: polylineLength(coords),
    durationSeconds: 60,
    steps: [
      {
        instruction: 'Jedź prosto',
        voiceInstruction: 'Jedź prosto',
        maneuverLng: coords[coords.length - 1][0],
        maneuverLat: coords[coords.length - 1][1],
        distanceMeters: polylineLength(coords),
        type: 'arrive',
      },
    ],
    geometry: { type: 'LineString', coordinates: coords },
  };
}

describe('offroute.checkOffRoute', () => {
  const legs = [
    legFromCoords([
      [20.0, 53.0],
      [20.0, 53.02],
    ]),
  ];
  it('na trasie -> brak reroute', () => {
    const r = checkOffRoute(initialOffRoute(), { lat: 53.01, lng: 20.0, accuracy: 5 }, legs);
    expect(r.offRoute).toBe(false);
    expect(r.shouldReroute).toBe(false);
  });
  it('dwa pomiary poza trasą -> reroute', () => {
    let state = initialOffRoute();
    const far = { lat: 53.01, lng: 20.01, accuracy: 5 }; // ~670 m w bok
    let r = checkOffRoute(state, far, legs);
    expect(r.offRoute).toBe(true);
    expect(r.shouldReroute).toBe(false);
    state = r.state;
    r = checkOffRoute(state, far, legs);
    expect(r.shouldReroute).toBe(true);
  });
  it('słaba dokładność jest ignorowana (measured=false)', () => {
    const r = checkOffRoute(initialOffRoute(), { lat: 53.01, lng: 20.01, accuracy: 200 }, legs);
    expect(r.offRoute).toBe(false);
    expect(r.measured).toBe(false);
  });
  it('dobry pomiar ma measured=true', () => {
    const r = checkOffRoute(initialOffRoute(), { lat: 53.01, lng: 20.0, accuracy: 5 }, legs);
    expect(r.measured).toBe(true);
  });
});

describe('offroute.combinedRouteCoords', () => {
  it('skleja legi bez duplikatu na styku', () => {
    const legs = [
      legFromCoords([
        [20, 53],
        [20, 53.01],
      ]),
      legFromCoords([
        [20, 53.01],
        [20, 53.02],
      ]),
    ];
    const coords = combinedRouteCoords(legs);
    expect(coords).toHaveLength(3);
  });
});

describe('progress.advanceProgress', () => {
  const legs = [
    legFromCoords([
      [20.0, 53.0],
      [20.0, 53.02],
    ]),
  ];
  it('przy dojechaniu do manewru przechodzi dalej', () => {
    const target = { lat: 53.02, lng: 20.0 }; // punkt manewru
    const { progress } = advanceProgress(initialProgress(), { ...target, accuracy: 5 }, legs);
    expect(progress.distanceToManeuver).toBeLessThan(31);
    expect(progress.advanced).toBe(true);
  });
  it('z daleka nie przechodzi, ale może zapowiadać', () => {
    const { progress } = advanceProgress(
      initialProgress(),
      { lat: 53.0, lng: 20.0, accuracy: 5 },
      legs,
    );
    expect(progress.advanced).toBe(false);
  });
});

import { nextStepAfter } from './progress';
describe('progress.nextStepAfter', () => {
  const legsTwo = [
    legFromCoords([[20,53],[20,53.01]]),
    legFromCoords([[20,53.01],[20,53.02]]),
  ];
  it('zwraca kolejny krok w obrębie legu', () => {
    const leg0 = legsTwo[0];
    // dołóż drugi krok do leg0
    leg0.steps.push({ instruction:'Skręć w prawo', voiceInstruction:'', maneuverLng:20, maneuverLat:53.005, distanceMeters:50, type:'turn', modifier:'right' });
    expect(nextStepAfter(legsTwo, 0, 0)?.instruction).toBe('Skręć w prawo');
  });
  it('przechodzi na pierwszy krok kolejnego legu', () => {
    expect(nextStepAfter(legsTwo, 1, 99)).toBeNull(); // brak dalej
    expect(nextStepAfter(legsTwo, 0, 50)?.instruction).toBe(legsTwo[1].steps[0].instruction);
  });
});
