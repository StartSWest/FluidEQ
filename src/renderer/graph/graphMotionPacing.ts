/** The compact graph is the reference size used when tuning each look. */
const REFERENCE_DEPTH = 360;

/**
 * Enlarging a wave multiplies every pixel of travel. Ease its visual clock
 * with the square root of that growth: calmer on a large canvas while hits
 * still arrive promptly. This affects drawing only, never the audio clock.
 */
const getGraphMotionDelta = (
  deltaMs: number,
  renderedDepth: number,
): number => {
  const depth = Number.isFinite(renderedDepth)
    ? Math.max(0, renderedDepth)
    : REFERENCE_DEPTH;
  const compensation = Math.max(
    1,
    Math.min(2.5, Math.sqrt(depth / REFERENCE_DEPTH)),
  );
  return deltaMs / compensation;
};

export default getGraphMotionDelta;
