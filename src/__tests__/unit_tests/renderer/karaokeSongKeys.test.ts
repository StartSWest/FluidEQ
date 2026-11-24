import {
  IKaraokeSungPitch,
  karaokeSongScale,
  karaokeSongTuningSemitones,
  karaokeSungKey,
  karaokeSungPitch,
  rekeyKaraokeNotes,
} from '../../../renderer/karaoke/makerAi/songKeys';

const always = () => true;
const midiToHz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);
const C_MAJOR = [60, 62, 64, 65, 67, 69, 71];

const repeated = (keys: readonly number[], framesEach: number): number[] =>
  keys.flatMap((key) => new Array<number>(framesEach).fill(key));

const sungFrom = (
  midi: readonly number[],
  rest: Partial<IKaraokeSungPitch> = {},
): IKaraokeSungPitch => ({
  midi: Float32Array.from(midi),
  sure: new Uint8Array(midi.length).fill(1),
  hopMs: 10,
  tuningSemitones: 0,
  ...rest,
});

describe("where a song's keys are", () => {
  it('reads how far the song sits from concert pitch', () => {
    const sharp = repeated([60.3, 64.3, 67.3], 150);
    expect(karaokeSongTuningSemitones(sharp, always)).toBeCloseTo(0.3, 3);
    // The control: the same song at concert pitch has nothing to correct.
    expect(
      karaokeSongTuningSemitones(repeated([60, 64, 67], 150), always),
    ).toBeCloseTo(0, 6);
  });

  it('reads a flat song as flat', () => {
    expect(
      karaokeSongTuningSemitones(repeated([59.8, 63.8], 200), always),
    ).toBeCloseTo(-0.2, 3);
  });

  it('leaves a song with too little singing at concert pitch', () => {
    expect(karaokeSongTuningSemitones(repeated([60.3], 200), always)).toBe(0);
  });

  it('leaves a song whose pitch gathers nowhere at concert pitch', () => {
    const glide = Array.from({ length: 600 }, (_unused, frame) => frame / 100);
    expect(karaokeSongTuningSemitones(glide, always)).toBe(0);
  });

  it('counts only the frames that are sung', () => {
    const track = [...repeated([60.3], 400), ...repeated([60], 400)];
    expect(
      karaokeSongTuningSemitones(track, (frame) => frame < 400),
    ).toBeCloseTo(0.3, 3);
  });
});

describe('which keys a song uses', () => {
  it('finds the scale that holds the singing', () => {
    const scale = karaokeSongScale(repeated(C_MAJOR, 60), always);
    expect(scale && [...scale].sort((a, b) => a - b)).toEqual([
      0, 2, 4, 5, 7, 9, 11,
    ]);
  });

  it('finds it in another key', () => {
    const dMajor = C_MAJOR.map((key) => key + 2);
    const scale = karaokeSongScale(repeated(dMajor, 60), always);
    expect(scale?.has(1)).toBe(true);
    expect(scale?.has(0)).toBe(false);
  });

  it('names no scale for a song no scale holds', () => {
    const chromatic = Array.from({ length: 12 }, (_unused, step) => 60 + step);
    expect(karaokeSongScale(repeated(chromatic, 40), always)).toBeUndefined();
  });

  it('names no scale from too little singing', () => {
    expect(karaokeSongScale(repeated(C_MAJOR, 20), always)).toBeUndefined();
  });

  it('gives a slide between two keys no vote', () => {
    // 420 frames on the scale and 200 between two keys of it: counted, the
    // slides would be C sharp and F sharp and no scale would hold 80%.
    const track = [...repeated(C_MAJOR, 60), ...repeated([60.5, 65.5], 100)];
    expect(karaokeSongScale(track, always)).toBeDefined();
  });
});

describe("a song's pitch as it is sung", () => {
  it('puts the pitch on the song own keys and reads its scale', () => {
    const hz = repeated(C_MAJOR, 60).map((key) => midiToHz(key + 0.3));
    const sung = karaokeSungPitch(hz, new Array(hz.length).fill(0.9), 10, 0.5);
    expect(sung.tuningSemitones).toBeCloseTo(0.3, 2);
    expect(sung.midi[30]).toBeCloseTo(60, 2);
    expect(sung.scale?.has(4)).toBe(true);
    expect(sung.sure[0]).toBe(1);
  });

  it('marks unsure frames and frames with no pitch', () => {
    const sung = karaokeSungPitch(
      [0, 0, 0, 0, 0, 0, 0, midiToHz(60)],
      [0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.1],
      10,
      0.5,
    );
    expect(Number.isNaN(sung.midi[0])).toBe(true);
    expect(sung.sure[7]).toBe(0);
  });
});

describe('the key sung under a note', () => {
  it('names the pitch the voice arrives at, not the slide into it', () => {
    // More than half of the note is the slide: the whole note's median is 58.
    const sung = sungFrom([...repeated([58], 16), ...repeated([60], 14)]);
    expect(karaokeSungKey(sung, 0, 300)).toBe(60);
  });

  it('listens a little past the end and never into the next note', () => {
    const sung = sungFrom([...repeated([60], 10), ...repeated([67], 6)]);
    // Left alone, the 60 ms past the end reach the next note and outvote it.
    expect(karaokeSungKey(sung, 0, 100)).toBe(67);
    expect(karaokeSungKey(sung, 0, 100, 100)).toBe(60);
  });

  it('names nothing where too little is sung', () => {
    const silent = sungFrom(repeated([60], 30), {
      sure: new Uint8Array(30),
    });
    expect(karaokeSungKey(silent, 0, 300)).toBeUndefined();
    // Three frames of the held part are sung: enough to name a key, and not
    // the 60 ms a word needs before it is given a note of its own.
    const brief = sungFrom(repeated([60], 5));
    expect(karaokeSungKey(brief, 0, 50, 50)).toBe(60);
    expect(karaokeSungKey(brief, 0, 50, 50, 60)).toBeUndefined();
  });

  it('leans to the scale for a pitch between two keys', () => {
    const scale = new Set([0, 2, 4, 5, 7, 9, 11]);
    const between = repeated([61.3], 30);
    expect(karaokeSungKey(sungFrom(between, { scale }), 0, 300)).toBe(62);
    // The control: with no scale the nearest key is taken.
    expect(karaokeSungKey(sungFrom(between), 0, 300)).toBe(61);
  });

  it('believes a key outside the scale when the pitch sits on it', () => {
    const scale = new Set([0, 2, 4, 5, 7, 9, 11]);
    expect(
      karaokeSungKey(sungFrom(repeated([61.05], 30), { scale }), 0, 300),
    ).toBe(61);
  });
});

describe('naming notes once they sit on their words', () => {
  const note = (startMs: number, endMs: number, targetMidi: number) => ({
    startMs,
    endMs,
    targetMidi,
    source: 'basic-pitch',
  });

  it('renames a note from what is sung under it and keeps its octave', () => {
    const sung = sungFrom(repeated([62], 30));
    const [renamed] = rekeyKaraokeNotes([note(0, 300, 72)], sung, () => false);
    expect(renamed.targetMidi).toBe(74);
  });

  it('leaves a note that is not the detector to rename', () => {
    const sung = sungFrom(repeated([62], 30));
    const original = note(0, 300, 72);
    expect(rekeyKaraokeNotes([original], sung, () => true)).toEqual([original]);
  });

  it('leaves a note with nothing sung under it', () => {
    const sung = sungFrom(repeated([62], 30), { sure: new Uint8Array(30) });
    const original = note(0, 300, 72);
    expect(rekeyKaraokeNotes([original], sung, () => false)).toEqual([
      original,
    ]);
  });

  it('names each of two notes from its own held part', () => {
    const sung = sungFrom([...repeated([60], 20), ...repeated([67], 30)]);
    const renamed = rekeyKaraokeNotes(
      [note(0, 200, 64), note(200, 500, 64)],
      sung,
      () => false,
    );
    expect(renamed.map((entry) => entry.targetMidi)).toEqual([60, 67]);
  });
});
