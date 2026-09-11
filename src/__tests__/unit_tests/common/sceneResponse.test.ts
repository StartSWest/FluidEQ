import {
  createResponseState,
  NEUTRAL_RESPONSE,
  readResponse,
  respond,
  type IHeardMusic,
} from '../../../common/sceneResponse';

const music = (over: Partial<IHeardMusic> = {}): IHeardMusic => ({
  level: 0.5,
  beat: 0.8,
  bands: [0, 0.5, 1],
  spectrum: new Uint8Array([0, 128, 255]),
  waveform: new Uint8Array([0, 64, 255]),
  ...over,
});
const buffers = () => ({
  spectrum: new Uint8Array(3),
  waveform: new Uint8Array(3),
});

describe('scene response', () => {
  it('leaves existing scenes unchanged and never overwrites measured buffers', () => {
    const heard = music();
    const original = music();
    const out = buffers();
    const result = respond(
      heard,
      NEUTRAL_RESPONSE,
      createResponseState(3),
      16,
      out,
    );
    expect(result).toEqual(original);
    expect(result.spectrum).toBe(out.spectrum);
    expect(result.waveform).toBe(out.waveform);
    result.spectrum.fill(42);
    result.waveform.fill(42);
    expect(heard).toEqual(original);
  });

  it('applies gain before the gate, silences gated beats, and saturates loud input', () => {
    const response = { ...NEUTRAL_RESPONSE, sensitivity: 2, threshold: 0.5 };
    const state = createResponseState(3);
    expect(
      respond(music({ level: 0.25 }), response, state, 16, buffers()).beat,
    ).toBe(0);
    const result = respond(
      music({ level: 0.375, bands: [0.25, 0.375, 1] }),
      response,
      state,
      16,
      buffers(),
    );
    expect(result.level).toBe(0.5);
    expect(result.beat).toBe(0.8);
    expect(result.bands).toEqual([0, 0.5, 1]);
    expect(result.waveform).toEqual(new Uint8Array([0, 128, 255]));
  });

  it('covers 90 percent of a rise and fall in their respective durations at different frame rates', () => {
    const response = { ...NEUTRAL_RESPONSE, attack: 100, release: 1000 };
    const loud = music({
      level: 1,
      bands: [1, 1, 1],
      spectrum: new Uint8Array([255, 255, 255]),
    });
    const quiet = music({
      level: 0,
      bands: [0, 0, 0],
      spectrum: new Uint8Array(3),
    });
    const once = createResponseState(3);
    const split = createResponseState(3);
    const rising = respond(loud, response, once, 100, buffers());
    for (let frame = 0; frame < 10; frame += 1) {
      respond(loud, response, split, 10, buffers());
    }
    expect(rising.level).toBeCloseTo(0.9);
    expect(split.level).toBeCloseTo(rising.level);
    expect(rising.bands[1]).toBeCloseTo(0.9);
    // The follower stores Float32: 90% rounds just below the half-byte boundary.
    expect(rising.spectrum[0]).toBe(229);
    const falling = respond(quiet, response, once, 1000, buffers());
    expect(falling.level).toBeCloseTo(0.09);
    expect(falling.bands[2]).toBeCloseTo(0.09);
    expect(falling.spectrum[2]).toBe(23);
    expect(falling.beat).toBe(0);
  });

  it('bounds saved controls and falls back independently for non-finite or nonnumeric values', () => {
    expect(
      readResponse({
        sensitivity: 99,
        threshold: -1,
        attack: 9999,
        release: -1,
      }),
    ).toEqual({
      sensitivity: 4,
      threshold: 0,
      attack: 1000,
      release: 0,
    });
    expect(
      readResponse({
        sensitivity: -1,
        threshold: 1,
        attack: -1,
        release: 9999,
      }),
    ).toEqual({
      sensitivity: 0.25,
      threshold: 0.6,
      attack: 0,
      release: 3000,
    });
    const fallback = {
      sensitivity: 2,
      threshold: 0.2,
      attack: 40,
      release: 400,
    };
    expect(
      readResponse(
        { sensitivity: NaN, threshold: Infinity, attack: '50', release: null },
        fallback,
      ),
    ).toEqual(fallback);
    expect(readResponse(null)).toEqual(NEUTRAL_RESPONSE);
  });
});
