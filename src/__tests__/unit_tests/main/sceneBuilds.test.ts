/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * @jest-environment node
 */

/**
 * The last version of each look that built here (`sceneBuilds.ts`), against
 * the real member store: a version that will not compile gives way to it in
 * every place a look plays, and a relaunch still has it.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { memberLookId } from '../../../common/memberScenes';
import { premiumLookId, type IScenePack } from '../../../common/scenePacks';
import { SCENE_CONTRACT_VERSION } from '../../../common/sceneUniformContract';
import { createMemberSceneStore } from '../../../main/memberScenes/store';
import { createSceneBuilds, sceneRevisionOf } from '../../../main/sceneBuilds';

jest.mock('electron', () => ({
  safeStorage: jest.requireActual('../../utils/sceneStorageCipher')
    .sceneStorageCipher,
}));

const ME = '4f1c2b9e-8d3a-4e7b-9c11-2a6f0d5e7b30';
const LOOK = memberLookId(ME, 'glacier');

const pack = (source: string, version = 1): IScenePack => ({
  schema: 1,
  id: 'glacier',
  version,
  contract: SCENE_CONTRACT_VERSION,
  names: { en: 'Glacier' },
  fallbackStyle: 'skyline',
  swatch: ['#050a1a', '#00e5cf'],
  source,
  params: [],
});

const WORKS = `vec4 sceneColour(vec2 uv) {
  return vec4(uAccent * texture(uSpectrumSlow, vec2(uv.x, 0.5)).r, 1.0);
}
`;
// The store keeps it; the driver would not compile it. Which is the point:
// nothing in main can tell, only the window's build.
const BROKEN = `vec4 sceneColour(vec2 uv) {
  return vec4(uAccent * texture(uSpectrumSlow, vec2(uv.x, 0.5)).r, 1.0)
}
`;

let userDataDir: string;

beforeEach(() => {
  userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-builds-'));
});

afterEach(() => {
  fs.rmSync(userDataDir, { recursive: true, force: true });
});

const setup = () => {
  const store = createMemberSceneStore({ userDataDir });
  let entitled = true;
  const open = () =>
    createSceneBuilds({
      dir: path.join(userDataDir, 'scene-builds'),
      loadScene: (lookId) => {
        if (!entitled || lookId !== LOOK) {
          return undefined;
        }
        const loaded = store.load(ME, 'glacier');
        return loaded
          ? { pack: loaded, madeBy: 'listener' as const }
          : undefined;
      },
    });
  const revision = () => {
    const [summary] = store.list();
    if (!summary?.revision) {
      throw new Error('no listed revision');
    }
    return summary.revision;
  };
  return {
    store,
    open,
    revision,
    lapse: () => {
      entitled = false;
    },
  };
};

describe('the last build of a look', () => {
  // What the window reports a build by is the listing's revision; what main
  // checks it against is the pack it would load. If the two were hashed from
  // different copies, nothing would ever be kept and nothing would fail.
  it('names a version the way the looks list it', () => {
    const { store, revision } = setup();
    store.save(ME, pack(WORKS));
    const loaded = store.load(ME, 'glacier');
    expect(loaded && sceneRevisionOf(loaded)).toBe(revision());
  });

  it('stands in for a newer version that will not build, after a relaunch too', () => {
    const { store, open, revision } = setup();
    store.save(ME, pack(WORKS));
    open().built(LOOK, revision());
    store.save(ME, pack(BROKEN));

    // A fresh start: only the disk remembers.
    expect(open().lastBuilt(LOOK)?.source).toBe(WORKS);
  });

  it('keeps nothing the stores did not hand out at that revision', () => {
    const { store, open, revision } = setup();
    store.save(ME, pack(WORKS));
    const stale = revision();
    store.save(ME, pack(BROKEN));
    const builds = open();
    // The window built the first version, and says so after the second was
    // kept: the version kept is the store's, so nothing is kept.
    builds.built(LOOK, stale);
    expect(builds.lastBuilt(LOOK)).toBeUndefined();
    // The control: reported at the revision the store now has, it is kept.
    builds.built(LOOK, revision());
    expect(builds.lastBuilt(LOOK)?.source).toBe(BROKEN);
  });

  it('is handed out only while the look itself can be loaded', () => {
    const { store, open, revision, lapse } = setup();
    store.save(ME, pack(WORKS));
    const builds = open();
    builds.built(LOOK, revision());
    expect(builds.lastBuilt(LOOK)).toBeDefined();
    lapse();
    expect(builds.lastBuilt(LOOK)).toBeUndefined();
  });

  it('puts the last build on the desktop in place of a version that will not build, until a newer one comes', () => {
    const { store, open, revision } = setup();
    store.save(ME, pack(WORKS));
    const builds = open();
    builds.built(LOOK, revision());
    store.save(ME, pack(BROKEN, 2));
    const broken = store.load(ME, 'glacier');
    if (!broken) {
      throw new Error('not kept');
    }
    // The control: before the desktop says it would not build, it plays it.
    expect(builds.loadScene(LOOK)?.pack.source).toBe(BROKEN);

    expect(builds.wouldNotBuild(LOOK, broken)).toBe(true);
    expect(builds.loadScene(LOOK)?.pack.source).toBe(WORKS);

    // The author fixes it: the new version gets its own try at once.
    const fixed = WORKS.replace('0.5', '0.6');
    store.save(ME, pack(fixed, 3));
    expect(builds.loadScene(LOOK)?.pack.source).toBe(fixed);
  });

  it('gives up when what would not build is the last build itself', () => {
    const { store, open, revision } = setup();
    store.save(ME, pack(WORKS));
    const builds = open();
    builds.built(LOOK, revision());
    const kept = store.load(ME, 'glacier');
    if (!kept) {
      throw new Error('not kept');
    }
    expect(builds.wouldNotBuild(LOOK, kept)).toBe(false);
  });

  it('keeps one of FluidEQ’s own looks in memory only', () => {
    const official = premiumLookId('alpine');
    const alpine = { ...pack(WORKS), id: 'alpine' };
    const builds = createSceneBuilds({
      dir: path.join(userDataDir, 'scene-builds'),
      loadScene: (lookId) =>
        lookId === official
          ? { pack: alpine, madeBy: 'fluideq' as const }
          : undefined,
    });
    builds.drawn(official, alpine);
    expect(builds.lastBuilt(official)).toBe(alpine);
    expect(fs.existsSync(path.join(userDataDir, 'scene-builds'))).toBe(false);
  });

  it('goes with the look when the look is removed', () => {
    const { store, open, revision } = setup();
    store.save(ME, pack(WORKS));
    open().built(LOOK, revision());
    const dir = path.join(userDataDir, 'scene-builds');
    expect(fs.readdirSync(dir)).toHaveLength(1);
    open().forget(LOOK);
    expect(fs.readdirSync(dir)).toHaveLength(0);
  });
});

describe('the last build of a scene with a palette and a colour', () => {
  // Written in the built layout and read as the stored one, a palette scene
  // came back from disk without its palette (2026-11-11).
  it('keeps them across a relaunch', () => {
    const { store, open, revision } = setup();
    const coloured = {
      ...pack(WORKS),
      palettes: [
        {
          id: 'colours',
          names: { en: 'Colours' },
          stops: ['#ff0000', '#0000ff'],
        },
      ],
      colours: [{ id: 'glow', names: { en: 'Glow' }, value: '#00ffcc' }],
    };
    store.save(ME, coloured);
    open().built(LOOK, revision());
    store.save(ME, pack(BROKEN));
    const last = open().lastBuilt(LOOK);
    expect(last?.palettes).toEqual(coloured.palettes);
    expect(last?.colours).toEqual(coloured.colours);
  });
});
