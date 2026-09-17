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
 */

const STORAGE_KEY = 'fluideq.sceneWaves';

const stored = (): Record<string, ISceneWave> => {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : {};
};

const authored: ISceneWave = { height: 0.6, position: 0.2 };

beforeEach(() => {
  window.localStorage.clear();
  clearListenerWave('aurora');
  clearListenerWave('bloom');
});

describe(`a listener's wave for one scene`, () => {
  it('keeps what they moved, for that scene alone', () => {
    setListenerWave('aurora', { height: 0.9, position: 0.2 }, authored);
    expect(stored()).toEqual({ aurora: { height: 0.9, position: 0.2 } });

    setListenerWave('bloom', { height: 0.3, position: 0.5 }, authored);
    expect(Object.keys(stored()).sort()).toEqual(['aurora', 'bloom']);
    expect(stored().aurora).toEqual({ height: 0.9, position: 0.2 });
  });

  it(`forgets it when the wave is put back on the author's, however it got there`, () => {
    // Dragging a slider back onto the author's mark and pressing Restore
    // have to mean the same thing, or one of them pins a copy of today's
    // value and the scene stops following its author's next version.
    setListenerWave('aurora', { height: 0.9, position: 0.2 }, authored);
    setListenerWave('aurora', authored, authored);
    expect(stored()).toEqual({});

    setListenerWave('aurora', { height: 0.9, position: 0.2 }, authored);
    clearListenerWave('aurora');
    expect(stored()).toEqual({});
  });

  it('stores nothing at all for a scene nobody has moved', () => {
    // The positive control for the two above: an untouched scene leaves no
    // entry, which is what lets a new version bring its author's wave.
    expect(stored()).toEqual({});
    setListenerWave('aurora', DEFAULT_SCENE_WAVE, DEFAULT_SCENE_WAVE);
    expect(stored()).toEqual({});
  });

  it('reads a damaged entry as no override rather than refusing the scene', () => {
    // A fresh store, because it reads the stored entries once and keeps
    // them: this is what a window opening on a garbled entry sees.
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
      fresh.setListenerWave('aurora', { height: 0.5, position: 0 }, authored);
    });
    expect(stored().bloom).toEqual({ height: 0.4, position: 0.1 });
    expect(stored().aurora).toEqual({ height: 0.5, position: 0 });
  });
});
