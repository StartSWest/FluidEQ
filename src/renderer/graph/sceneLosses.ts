/**
 * When a scene whose GPU context was lost may come back, kept apart from the
 * worker so it can be held to its rules (`sceneRenderer.worker.ts`).
 *
 * A loss the scene is not blamed for — sleep, a driver update, another page's
 * crash — is waited out on `webglcontextrestored`, and once the scene draws
 * again it is forgotten. Only a second loss before any frame came back from
 * the first is fatal. Counted for the worker's whole life, as it was, two
 * resets of the driver hours apart took a scene off every place it played
 * until the next launch (Ivan, 2026-11-09, in a week of renderer crashes).
 *
 * A loss that is the scene's own doing is never forgotten: restored and drawn,
 * a scene that reset the driver would reset it again, so it comes back once
 * at most, as it always has. One nobody has watched (another member's) that
 * held the GPU too long does not come back at all.
 */
export interface ISceneLossLedger {
  /**
   * The context was lost. `heavy`: an unwatched scene's own frame held the GPU
   * past the blamed length. `scenesOwn`: the loss is blamed on this scene.
   * Answers whether the scene is now done for.
   */
  lost(cause: { heavy: boolean; scenesOwn: boolean }): boolean;
  /** The context came back and the scene was built on it again. */
  restored(): void;
  /** The scene drew a frame. */
  drew(): void;
  /** Whether a loss has made the scene unusable. */
  spent(): boolean;
}

const FATAL = 2;

export const createSceneLossLedger = (): ISceneLossLedger => {
  let count = 0;
  let restoring = false;
  let forgivable = true;
  return {
    lost: ({ heavy, scenesOwn }) => {
      restoring = false;
      forgivable = !scenesOwn;
      count += heavy ? FATAL : 1;
      return count >= FATAL;
    },
    restored: () => {
      restoring = forgivable;
    },
    drew: () => {
      if (restoring) {
        restoring = false;
        count = 0;
      }
    },
    spent: () => count >= FATAL,
  };
};
