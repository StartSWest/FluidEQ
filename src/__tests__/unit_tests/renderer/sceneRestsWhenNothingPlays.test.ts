/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { readFileSync } from 'fs';
import { join } from 'path';
import {
  SPECTRUM_TEXELS,
  WAVEFORM_TEXELS,
} from '../../../common/sceneUniformContract';
import type { ISceneFrame } from '../../../renderer/graph/sceneGl';
import {
  createStudioSignalBuffers,
  shapeStudioFrame,
} from '../../../renderer/studio/studioSignals';
import { createCalmShaper } from '../../../renderer/wallpaper/calmMotion';

/**
 * Every place rests a scene the same way — thirty frames a second after ten
 * seconds with nothing played (`sceneRest.ts`) — and judges "nothing played"
 * on the frame as its place has shaped it, not on the room.
 *
 * Only the graph used to rest at all. The Studio drew its made-up music at
 * the display's full rate in a silent room, and was right to; a desktop set
 * calm drew its slow swells at the display's rate for nobody. Judged on the
 * room, the Studio's test music would have slowed to thirty the moment the
 * song stopped; judged on the shaped frame, it plays as music, the Studio's
 * Silence rests, and so does a calm desktop.
 */

const heard = (playing: boolean): ISceneFrame => ({
  timeSeconds: 4,
  deltaMs: 1000 / 60,
  level: playing ? 0.7 : 0,
  beat: 0,
  bands: playing ? [0.8, 0.5, 0.3] : [0, 0, 0],
  musicAccent: [0, 0],
  musicRun: [0, 0],
  accent: [0, 0.9, 0.8],
  fade: 1,
  playing,
  spectrum: new Uint8Array(SPECTRUM_TEXELS).fill(playing ? 200 : 0),
  waveform: new Uint8Array(WAVEFORM_TEXELS).fill(playing ? 180 : 0),
  params: {},
});

describe('what counts as nothing played', () => {
  it('is the Studio’s test music playing, even in a silent room', () => {
    const buffers = createStudioSignalBuffers();
    (['beat', 'accent', 'showcase'] as const).forEach((signal) =>
      expect(shapeStudioFrame(heard(false), signal, buffers).playing).toBe(
        true,
      ),
    );
    // And its Silence is nothing played, whatever the room is playing.
    expect(shapeStudioFrame(heard(true), 'silence', buffers).playing).toBe(
      false,
    );
    // Live is the room itself: the frame goes through as it was heard.
    expect(shapeStudioFrame(heard(false), 'live', buffers).playing).toBe(false);
    expect(shapeStudioFrame(heard(true), 'live', buffers).playing).toBe(true);
  });

  it('is a calm desktop, whatever the music is doing', () => {
    const calm = createCalmShaper('calm');
    expect(calm.shape(heard(true)).playing).toBe(false);
    // Positive control: set to follow the music, it hears the music.
    const music = createCalmShaper('music');
    expect(music.shape(heard(true)).playing).toBe(true);
  });

  it('is read by the runner once its place has had its say', () => {
    const runner = readFileSync(
      join(__dirname, '../../../renderer/graph/useSceneRunner.ts'),
      'utf8',
    );
    const shaped = runner.indexOf('const shaped = shapeRef.current');
    const rest = runner.indexOf('restRef.current.frame(now, !shaped.playing');
    expect(shaped).toBeGreaterThan(0);
    expect(rest).toBeGreaterThan(shaped);
    // Once, and nowhere judged on the room before it.
    expect(runner.match(/restRef\.current\.frame\(/g)).toHaveLength(1);
  });
});
