import { SCENE_TAP_AGE_LIMIT_S } from 'common/sceneUniformContract';
import type { ISceneFrame } from './sceneGl';

/**
 * A page frame carried on between page frames by the scene worker, which
 * draws at the display's own rate from the latest one the page sent
 * (`sceneRenderer.worker.ts`).
 *
 * Everything a page frame carries is held until the next one, as it always
 * was, except two clocks: the beat and bar phases, and a tap's age. A clock
 * held for a page frame and then jumped reads as a dancer stepping at thirty
 * frames a second on a display drawing a hundred and forty-four.
 */

/**
 * How long a page frame's clocks are carried on without a newer one. The page
 * sends 30 to 60 frames a second; past this it has stopped (paused, hidden,
 * stalled) and the reading is held rather than run on by itself.
 */
export const CARRY_LIMIT_MS = 100;

/**
 * `frame` as it stands `sinceMs` after the page read it: the beat and bar
 * phases moved on at the tempo while the music's clock is running, and a tap
 * aged. The next page frame corrects whatever this guessed.
 */
export const carriedOn = (frame: ISceneFrame, sinceMs: number): ISceneFrame => {
  const since = Math.max(0, Math.min(CARRY_LIMIT_MS, sinceMs));
  if (since === 0) {
    return frame;
  }
  const { rhythm, tap } = frame;
  const beats =
    rhythm?.running && rhythm.tempo > 0 ? (since * rhythm.tempo) / 60_000 : 0;
  return {
    ...frame,
    ...(rhythm && beats > 0
      ? {
          rhythm: {
            ...rhythm,
            beatPhase: (rhythm.beatPhase + beats) % 1,
            barPhase: (rhythm.barPhase + beats / 4) % 1,
          },
        }
      : {}),
    ...(tap && tap[2] < SCENE_TAP_AGE_LIMIT_S
      ? {
          tap: [
            tap[0],
            tap[1],
            Math.min(SCENE_TAP_AGE_LIMIT_S, tap[2] + since / 1000),
            tap[3],
          ],
        }
      : {}),
  };
};
