import type { IScenePack } from '../../../common/scenePacks';
import {
  SPECTRUM_TEXELS,
  WAVEFORM_TEXELS,
} from '../../../common/sceneUniformContract';
import type { ISceneFrame } from '../../../renderer/graph/sceneGl';
import { createSceneTuner } from '../../../renderer/graph/sceneTuner';

const frame = (level: number): ISceneFrame => ({
  timeSeconds: 0,
  deltaMs: 16,
  level,
  beat: 0,
  bands: [level, level, level],
  accent: [0, 0, 0],
  fade: 1,
  spectrum: new Uint8Array(SPECTRUM_TEXELS).fill(Math.round(level * 255)),
  waveform: new Uint8Array(WAVEFORM_TEXELS),
  params: {},
});

const pack = (response?: IScenePack['response']): IScenePack =>
  ({
    schema: 1,
    id: 'neon-city',
    version: 4,
    contract: 6,
    names: { en: 'Neon City' },
    fallbackStyle: 'skyline',
    swatch: [],
    source: '',
    params: [],
    ...(response ? { response } : {}),
  }) as IScenePack;

/** Loud for one frame, then silent for `ms`: how much of the level is left. */
const levelAfterFall = (
  scene: IScenePack,
  ms: number,
  tuning?: Parameters<ReturnType<typeof createSceneTuner>['apply']>[4],
) => {
  const tuner = createSceneTuner();
  tuner.apply(frame(1), 16, scene, {}, tuning);
  return tuner.apply(frame(0), ms, scene, {}, tuning).level;
};

describe('scene tuner', () => {
  it('passes the music straight through for a pack with no response', () => {
    expect(levelAfterFall(pack(), 100)).toBe(0);
  });

  it('follows the pack’s own release when nobody chose another', () => {
    const own = pack({ sensitivity: 1, threshold: 0, attack: 0, release: 300 });
    const left = levelAfterFall(own, 100);
    expect(left).toBeGreaterThan(0.2);
    expect(left).toBeLessThan(1);
  });

  it('lays a listener’s release over the pack’s and keeps its other controls', () => {
    const own = pack({
      sensitivity: 0.5,
      threshold: 0,
      attack: 0,
      release: 300,
    });
    const slow = levelAfterFall(own, 100, { response: { release: 3000 } });
    const quick = levelAfterFall(own, 100, { response: { release: 0 } });
    // A long release leaves most of the level; none leaves nothing.
    expect(slow).toBeGreaterThan(levelAfterFall(own, 100));
    expect(quick).toBe(0);

    // The pack's sensitivity still applies under the listener's release:
    // a full-scale hit is heard at half.
    const tuner = createSceneTuner();
    const heard = tuner.apply(
      frame(1),
      16,
      own,
      {},
      {
        response: { release: 3000 },
      },
    );
    expect(heard.level).toBeCloseTo(0.5, 2);
  });

  it('gives a listener’s timing to a pack that has no response of its own', () => {
    expect(
      levelAfterFall(pack(), 100, { response: { release: 1000 } }),
    ).toBeGreaterThan(0.5);
  });
});
