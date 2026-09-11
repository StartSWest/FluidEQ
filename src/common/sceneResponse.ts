import { getEaseFactor } from './smoothing';

/**
 * How a scene answers the music: what it hears, bent before it hears it.
 *
 * The engine's measurements — loudness, the three bands, the spectrum — are
 * the same for every scene, but scenes are not: a starfield wants every
 * whisper, a lightning storm only the loud parts, a slow aurora wants its
 * light to rise quickly and fall away slowly. Four controls, the ones every
 * audio-reactive tool has, in the order the signal meets them:
 *
 * - `sensitivity` scales what is heard, so a quiet track still moves the
 *   scene or a loud one stops pinning it at full.
 * - `threshold` is a gate: anything below it is heard as nothing, and what
 *   is above it is spread back over the whole range, so a scene that should
 *   rest through the quiet verse does.
 * - `attack` is how long a rise takes to arrive, and `release` how long a
 *   fall takes, in milliseconds to cover 90% of the way.
 *
 * All four at their neutral values change nothing, and that is what a scene
 * without a `response` of its own gets — every scene that existed before
 * this does exactly what it did. The beat passes through, silenced only
 * where the gate has shut, so a flash never comes out of a passage the
 * member asked the scene to sit through.
 */

export interface ISceneResponse {
  sensitivity: number;
  threshold: number;
  attack: number;
  release: number;
}

export const NEUTRAL_RESPONSE: ISceneResponse = {
  sensitivity: 1,
  threshold: 0,
  attack: 0,
  release: 0,
};

/** Each control's range, as the Studio's sliders and every reader clamp it. */
export const RESPONSE_LIMITS: Record<keyof ISceneResponse, [number, number]> = {
  sensitivity: [0.25, 4],
  threshold: [0, 0.6],
  attack: [0, 1000],
  release: [0, 3000],
};

export const RESPONSE_KEYS = [
  'sensitivity',
  'threshold',
  'attack',
  'release',
] as const satisfies readonly (keyof ISceneResponse)[];

const clamp = (value: number, [min, max]: [number, number]) =>
  Math.min(max, Math.max(min, value));

/**
 * A response from anything — `pack.json`, a saved setting, the page — each
 * control that is missing or not a number taken from `fallback`, each one
 * that is kept in its range.
 */
export const readResponse = (
  raw: unknown,
  fallback: ISceneResponse = NEUTRAL_RESPONSE,
): ISceneResponse => {
  const value =
    typeof raw === 'object' && raw !== null
      ? (raw as Record<string, unknown>)
      : {};
  const read = (key: keyof ISceneResponse) => {
    const given = value[key];
    return typeof given === 'number' && Number.isFinite(given)
      ? clamp(given, RESPONSE_LIMITS[key])
      : fallback[key];
  };
  return {
    sensitivity: read('sensitivity'),
    threshold: read('threshold'),
    attack: read('attack'),
    release: read('release'),
  };
};

export const isNeutralResponse = (response: ISceneResponse) =>
  RESPONSE_KEYS.every((key) => response[key] === NEUTRAL_RESPONSE[key]);

/** Milliseconds to cover 90% of the way, as the half-life the easing takes. */
const halfLifeOf = (ms: number) => ms / Math.log2(10);

/** The response's own memory: where each value it follows has got to. */
export interface IResponseState {
  level: number;
  bands: [number, number, number];
  spectrum: Float32Array;
}

export const createResponseState = (texels: number): IResponseState => ({
  level: 0,
  bands: [0, 0, 0],
  spectrum: new Float32Array(texels),
});

/** Gain, then the gate: what one value is heard as before it is followed. */
const gate = (value: number, response: ISceneResponse) => {
  const gained = Math.min(1, value * response.sensitivity);
  return gained <= response.threshold
    ? 0
    : (gained - response.threshold) / (1 - response.threshold);
};

/** One step of the follower: rising at the attack, falling at the release. */
const follow = (
  from: number,
  to: number,
  elapsedMs: number,
  response: ISceneResponse,
) =>
  from +
  (to - from) *
    getEaseFactor(
      elapsedMs,
      halfLifeOf(to > from ? response.attack : response.release),
    );

export interface IHeardMusic {
  level: number;
  beat: number;
  bands: readonly [number, number, number];
  spectrum: Uint8Array;
  waveform: Uint8Array;
}

/**
 * What the scene hears through `response`, one frame of `elapsedMs` on from
 * the last: new values, with the spectrum and waveform written into `out`'s
 * buffers (never into the heard ones, which belong to whoever measured
 * them). Everything else about the frame is the caller's to keep.
 */
export const respond = (
  heard: IHeardMusic,
  response: ISceneResponse,
  state: IResponseState,
  elapsedMs: number,
  out: { spectrum: Uint8Array; waveform: Uint8Array },
): IHeardMusic => {
  const gatedLevel = gate(heard.level, response);
  state.level = follow(state.level, gatedLevel, elapsedMs, response);
  state.bands = [0, 1, 2].map((index) =>
    follow(
      state.bands[index],
      gate(heard.bands[index], response),
      elapsedMs,
      response,
    ),
  ) as [number, number, number];
  const texels = Math.min(heard.spectrum.length, out.spectrum.length);
  for (let texel = 0; texel < texels; texel += 1) {
    state.spectrum[texel] = follow(
      state.spectrum[texel],
      gate(heard.spectrum[texel] / 255, response),
      elapsedMs,
      response,
    );
    out.spectrum[texel] = Math.round(state.spectrum[texel] * 255);
  }
  const samples = Math.min(heard.waveform.length, out.waveform.length);
  for (let sample = 0; sample < samples; sample += 1) {
    out.waveform[sample] = Math.min(
      255,
      Math.round(heard.waveform[sample] * response.sensitivity),
    );
  }
  return {
    level: state.level,
    beat: gatedLevel > 0 ? heard.beat : 0,
    bands: state.bands,
    spectrum: out.spectrum,
    waveform: out.waveform,
  };
};
