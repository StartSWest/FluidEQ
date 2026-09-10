/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

const KEY = 'fluideq.player.volume';
const LEGACY_KEY = 'fluideq.library.volume';

/**
 * Re-imported per test, deliberately.
 *
 * The module reads storage once at load — that is the whole point of it, since
 * the audio elements are built at the stored level rather than at unity and
 * turned down afterwards — so a test about what it reads at load has to load
 * it again.
 */
const loadModule = async () => {
  jest.resetModules();
  return import('../../../renderer/audio/appVolume');
};

describe('the app volume', () => {
  beforeEach(() => window.localStorage.clear());

  it('starts at unity when nothing has been stored', async () => {
    const { DEFAULT_VOLUME, getAppVolume, readAppVolume } = await loadModule();
    expect(readAppVolume()).toBe(DEFAULT_VOLUME);
    expect(getAppVolume()).toBe(DEFAULT_VOLUME);
    expect(DEFAULT_VOLUME).toBe(1);
  });

  it('round-trips a level the user set', async () => {
    const { commitAppVolume, readAppVolume, setAppVolume } = await loadModule();
    setAppVolume(0.17);
    commitAppVolume();
    expect(readAppVolume()).toBeCloseTo(0.17, 6);
  });

  it('remembers silence rather than treating it as absent', async () => {
    const { commitAppVolume, readAppVolume, setAppVolume } = await loadModule();
    setAppVolume(0);
    commitAppVolume();
    expect(readAppVolume()).toBe(0);
  });

  /**
   * The library's key, from before this was app-wide.
   *
   * Read once so that moving the fader out of the library did not silently
   * reset everybody's remembered level to full scale on the version it landed
   * in.
   */
  it('adopts the level the library alone used to keep', async () => {
    window.localStorage.setItem(LEGACY_KEY, '0.5');
    const { getAppVolume, readAppVolume } = await loadModule();
    expect(readAppVolume()).toBe(0.5);
    expect(getAppVolume()).toBe(0.5);
  });

  it('prefers its own key over the library one once both exist', async () => {
    window.localStorage.setItem(LEGACY_KEY, '0.5');
    window.localStorage.setItem(KEY, '0.25');
    const { readAppVolume } = await loadModule();
    expect(readAppVolume()).toBe(0.25);
  });

  it('never writes back to the library key', async () => {
    window.localStorage.setItem(LEGACY_KEY, '0.5');
    const { commitAppVolume, setAppVolume } = await loadModule();
    setAppVolume(0.3);
    commitAppVolume();
    expect(window.localStorage.getItem(LEGACY_KEY)).toBe('0.5');
    expect(window.localStorage.getItem(KEY)).toBe('0.3');
  });

  /**
   * Whole percent, because the Media tab's page is told a level through its
   * own player API and that API takes whole percent. A level that does not
   * survive the round trip unchanged comes back as a different number and
   * nudges the fader the user just set.
   */
  it('quantises to whole percent so a page can report it back unchanged', async () => {
    const { clampAppVolume } = await loadModule();
    expect(clampAppVolume(0.375)).toBe(0.38);
    expect(clampAppVolume(0.1234)).toBe(0.12);
    expect(clampAppVolume(1 / 3)).toBe(0.33);
  });

  it('holds the fader inside its travel', async () => {
    const { clampAppVolume } = await loadModule();
    expect(clampAppVolume(1.5)).toBe(1);
    expect(clampAppVolume(-0.2)).toBe(0);
  });

  /**
   * A missing stored value falls back to full scale, because that is where a
   * fresh audio element sits. A garbage value arriving at the setter must not:
   * answering a broken number with full volume is the app shouting at somebody
   * who moved a fader.
   */
  it('ignores a value that is not a number instead of going loud', async () => {
    const { getAppVolume, setAppVolume } = await loadModule();
    setAppVolume(0.2);
    setAppVolume(Number.NaN);
    expect(getAppVolume()).toBe(0.2);
    setAppVolume(Number.POSITIVE_INFINITY);
    expect(getAppVolume()).toBe(0.2);
  });

  /**
   * Every one of these would otherwise reach `element.volume`, which throws on
   * a value outside 0..1 and would take playback down with it.
   */
  it.each([
    ['not a number', 'loud'],
    ['above the range', '1.5'],
    ['below the range', '-0.2'],
    ['empty', ''],
    ['NaN', 'NaN'],
    ['Infinity', 'Infinity'],
  ])(
    'falls back to unity for a stored value that is %s',
    async (_label, stored) => {
      window.localStorage.setItem(KEY, stored);
      const { DEFAULT_VOLUME, readAppVolume } = await loadModule();
      expect(readAppVolume()).toBe(DEFAULT_VOLUME);
    },
  );

  it('survives a storage that refuses to be read', async () => {
    const getItem = jest
      .spyOn(Storage.prototype, 'getItem')
      .mockImplementation(() => {
        throw new Error('storage disabled');
      });
    const { DEFAULT_VOLUME, readAppVolume } = await loadModule();
    expect(readAppVolume()).toBe(DEFAULT_VOLUME);
    getItem.mockRestore();
  });

  it('survives a storage that refuses to be written', async () => {
    const { commitAppVolume, setAppVolume } = await loadModule();
    const setItem = jest
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw new Error('quota exceeded');
      });
    setAppVolume(0.4);
    expect(() => commitAppVolume()).not.toThrow();
    setItem.mockRestore();
  });

  /**
   * The volume is a preference, the queue is a session.
   *
   * Kept under its own key so clearing what was playing does not also reset
   * how loud the app is — a small annoyance, but one that would repeat.
   */
  it('is stored apart from the playback memory', async () => {
    const { commitAppVolume, setAppVolume } = await loadModule();
    setAppVolume(0.42);
    commitAppVolume();
    expect(window.localStorage.getItem(KEY)).not.toBeNull();
    expect(window.localStorage.getItem('fluideq.library.playback')).toBeNull();
  });

  /**
   * One number for the whole app. Karaoke kept a second one defaulting to 0.8
   * and the Media tab invented a third that was always 1, so the same app
   * played at three different levels depending on which tab was open.
   */
  it('tells every subscriber the same level', async () => {
    const { getAppVolume, setAppVolume } = await loadModule();
    const seen: number[] = [];
    setAppVolume(0.6);
    seen.push(getAppVolume());
    setAppVolume(0.6);
    seen.push(getAppVolume());
    expect(seen).toEqual([0.6, 0.6]);
  });
});
