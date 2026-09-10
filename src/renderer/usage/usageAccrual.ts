/**
 * How many seconds of listening one live frame stands for.
 *
 * Frames arrive about twenty-two times a second while music plays and stop
 * when it does not, so the gap between two frames is the listening it covers
 * — bounded, because a gap after the window was hidden or the machine slept
 * is not listening and must not be counted as such. Two seconds is comfortably
 * more than any real frame gap and comfortably less than any real pause.
 */
export const MAX_FRAME_GAP_SECONDS = 2;

/** Report to the main process once this much has accrued. */
export const FLUSH_AFTER_SECONDS = 60;

export const accrueFromFrame = (
  previousAtMs: number | undefined,
  nowMs: number,
  playing: boolean,
): number => {
  if (!playing || previousAtMs === undefined) {
    return 0;
  }
  const gap = (nowMs - previousAtMs) / 1000;
  if (!Number.isFinite(gap) || gap <= 0) {
    return 0;
  }
  return Math.min(MAX_FRAME_GAP_SECONDS, gap);
};
