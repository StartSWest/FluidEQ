/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { DEFAULT_SCENE_WAVE, type ISceneWave } from 'common/sceneWave';
import {
  clearListenerWave,
  setListenerWave,
} from 'renderer/utils/sceneWaveStore';

/**
 * A listener's own wave, over the one a scene's author built it around.
 *
 * The rule that matters is the one the scene's controls beside it follow: a
 * scene nobody has touched is not stored, so it follows its author through
 * every new version, and only what was actually moved stays put. Read back
 * through the store's own storage, since that is what a second window sees.
 *
 * Kept per view mode as well, so the same scene can be a band across the pane
 * and the whole glass in full screen.
 */

const STORAGE_KEY = 'fluideq.sceneWaves';

type TStoredWaves = Record<string, Record<string, ISceneWave>>;

const stored = (): TStoredWaves => {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : {};
};

const authored: ISceneWave = { height: 0.6, position: 0.2 };

beforeEach(() => {
  window.localStorage.clear();
  clearListenerWave('aurora', 'normal');
  clearListenerWave('aurora', 'expanded');
  clearListenerWave('aurora', 'fullscreen');
  clearListenerWave('bloom', 'fullscreen');
});

describe(`a listener's wave for one scene`, () => {
  it('keeps what they moved, for that scene and that mode alone', () => {
    setListenerWave(
      'aurora',
      'fullscreen',
      { height: 0.9, position: 0.2 },
      authored,
    );
    expect(stored()).toEqual({
      aurora: { fullscreen: { height: 0.9, position: 0.2 } },
    });

    setListenerWave(
      'bloom',
      'fullscreen',
      { height: 0.3, position: 0.5 },
      authored,
    );
    expect(Object.keys(stored()).sort()).toEqual(['aurora', 'bloom']);
    expect(stored().aurora.fullscreen).toEqual({ height: 0.9, position: 0.2 });
  });

  it('keeps a mode of its own for each of the three', () => {
    // The pane is a band across a card and full screen is the whole glass, so
    // one wave for both is a wave that is wrong in one of them.
    setListenerWave('aurora', 'normal', { height: 0.3, position: 0 }, authored);
    setListenerWave(
      'aurora',
      'fullscreen',
      { height: 1, position: 0.5 },
      authored,
    );
    expect(stored().aurora).toEqual({
      normal: { height: 0.3, position: 0 },
      fullscreen: { height: 1, position: 0.5 },
    });
  });

  it(`forgets it when the wave is put back on the author's, however it got there`, () => {
    // Dragging a slider back onto the author's mark and pressing Restore
    // have to mean the same thing, or one of them pins a copy of today's
    // value and the scene stops following its author's next version.
    setListenerWave(
      'aurora',
      'fullscreen',
      { height: 0.9, position: 0.2 },
      authored,
    );
    setListenerWave('aurora', 'fullscreen', authored, authored);
    expect(stored()).toEqual({});

    setListenerWave(
      'aurora',
      'fullscreen',
      { height: 0.9, position: 0.2 },
      authored,
    );
    clearListenerWave('aurora', 'fullscreen');
    expect(stored()).toEqual({});
  });

  it('restores the mode being looked at and leaves the others alone', () => {
    setListenerWave('aurora', 'normal', { height: 0.3, position: 0 }, authored);
    setListenerWave(
      'aurora',
      'fullscreen',
      { height: 1, position: 0.5 },
      authored,
    );
    clearListenerWave('aurora', 'fullscreen');
    expect(stored().aurora).toEqual({ normal: { height: 0.3, position: 0 } });
  });

  it('stores nothing at all for a scene nobody has moved', () => {
    // The positive control for the two above: an untouched scene leaves no
    // entry, which is what lets a new version bring its author's wave.
    expect(stored()).toEqual({});
    setListenerWave(
      'aurora',
      'fullscreen',
      DEFAULT_SCENE_WAVE,
      DEFAULT_SCENE_WAVE,
    );
    expect(stored()).toEqual({});
  });

  it('reads a damaged entry as no override rather than refusing the scene', () => {
    // A fresh store, because it reads the stored entries once and keeps
    // them: this is what a window opening on a garbled entry sees. The
    // usable one is in the shape written before the modes had their own, so
    // this is the migration as well — it was set with no notion of modes, so
    // it is equally true of all three.
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        aurora: { height: 'tall' },
        bloom: { height: 0.4, position: 0.1 },
      }),
    );
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require -- a second copy of the store, to read the storage afresh
      const fresh = require('renderer/utils/sceneWaveStore');
      // Written through, which is what proves it was read: the unusable
      // entry is gone and the usable one survived.
      fresh.setListenerWave(
        'aurora',
        'fullscreen',
        { height: 0.5, position: 0 },
        authored,
      );
    });
    const carried = { height: 0.4, position: 0.1 };
    expect(stored().bloom).toEqual({
      normal: carried,
      expanded: carried,
      fullscreen: carried,
    });
    expect(stored().aurora).toEqual({
      fullscreen: { height: 0.5, position: 0 },
    });
  });
});
