/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * @jest-environment node
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { createMemberSceneStore } from '../../../main/memberScenes/store';
import { memberLookId } from '../../../common/memberScenes';
import type { IScenePack } from '../../../common/scenePacks';
import { SCENE_CONTRACT_VERSION } from '../../../common/sceneUniformContract';

const ME = '4f1c2b9e-8d3a-4e7b-9c11-2a6f0d5e7b30';
const SOURCE = `vec4 sceneColour(vec2 uv) {
  return vec4(uAccent * texture(uSpectrumSlow, vec2(uv.x, 0.5)).r, 1.0);
}
`;

const pack = (over: Partial<IScenePack> = {}): IScenePack => ({
  schema: 1,
  id: 'neon-city',
  version: 1,
  contract: SCENE_CONTRACT_VERSION,
  names: { en: 'Neon City' },
  fallbackStyle: 'skyline',
  swatch: ['#050a1a', '#00e5cf'],
  source: SOURCE,
  params: [],
  ...over,
});

let userDataDir: string;

beforeEach(() => {
  userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-members-'));
});

afterEach(() => {
  fs.rmSync(userDataDir, { recursive: true, force: true });
});

const sceneFile = (packId: string) =>
  path.join(userDataDir, 'member-scenes', 'own', ME, `${packId}.json`);

describe('the member scene store', () => {
  // The control: everything below is a departure from this round trip.
  it('keeps a saved scene and gives it back whole', () => {
    const store = createMemberSceneStore({ userDataDir, appVersion: '1.0.0' });
    const summary = store.save(ME, pack());
    expect(summary).toMatchObject({
      lookId: memberLookId(ME, 'neon-city'),
      authorId: ME,
      packId: 'neon-city',
      version: 1,
      own: true,
    });
    expect(store.list()).toEqual([summary]);
    expect(store.load(ME, 'neon-city')).toEqual(pack());
  });

  it('survives a restart', () => {
    createMemberSceneStore({ userDataDir, appVersion: '1.0.0' }).save(
      ME,
      pack(),
    );
    const again = createMemberSceneStore({ userDataDir, appVersion: '1.0.0' });
    expect(again.load(ME, 'neon-city')).toEqual(pack());
  });

  it('refuses to save a scene that breaks a rule', () => {
    const store = createMemberSceneStore({ userDataDir, appVersion: '1.0.0' });
    expect(() =>
      store.save(ME, pack({ source: `#define X 1\n${SOURCE}` })),
    ).toThrow();
    expect(store.list()).toEqual([]);
  });

  it('checks a scene again on every load, and keeps the file', () => {
    const store = createMemberSceneStore({ userDataDir, appVersion: '1.0.0' });
    store.save(ME, pack());
    const record = JSON.parse(fs.readFileSync(sceneFile('neon-city'), 'utf8'));
    record.pack.source = `#define X 1\n${SOURCE}`;
    fs.writeFileSync(sceneFile('neon-city'), JSON.stringify(record));
    expect(store.load(ME, 'neon-city')).toBeUndefined();
    expect(store.list()).toEqual([]);
    // A member's own work is never deleted behind their back.
    expect(fs.existsSync(sceneFile('neon-city'))).toBe(true);
  });

  it('ignores files that are not scenes', () => {
    const store = createMemberSceneStore({ userDataDir, appVersion: '1.0.0' });
    store.save(ME, pack());
    fs.writeFileSync(sceneFile('broken'), '{ nope');
    fs.writeFileSync(
      path.join(path.dirname(sceneFile('x')), 'NOT AN ID.json'),
      '{}',
    );
    expect(store.list().map((scene) => scene.packId)).toEqual(['neon-city']);
  });

  it('refuses ids that are not ids', () => {
    const store = createMemberSceneStore({ userDataDir, appVersion: '1.0.0' });
    expect(() => store.save('not-an-account', pack())).toThrow();
    expect(store.load(ME, '../neon-city')).toBeUndefined();
    expect(store.load('../../etc', 'neon-city')).toBeUndefined();
  });

  it('removes a scene when its author asks', () => {
    const store = createMemberSceneStore({ userDataDir, appVersion: '1.0.0' });
    store.save(ME, pack());
    expect(store.remove(ME, 'neon-city')).toBe(true);
    expect(store.list()).toEqual([]);
    expect(store.remove(ME, 'neon-city')).toBe(false);
  });

  it('quarantines for this build only, and a new version lifts it', () => {
    const store = createMemberSceneStore({ userDataDir, appVersion: '1.0.0' });
    store.save(ME, pack());
    store.quarantine(ME, 'neon-city', 'compile');
    expect(store.load(ME, 'neon-city')).toBeUndefined();
    expect(store.list()[0].quarantined).toBe('compile');
    // Another build of the app gets a fresh chance.
    const next = createMemberSceneStore({ userDataDir, appVersion: '1.0.1' });
    expect(next.load(ME, 'neon-city')).toEqual(pack());
    // And a saved new version lifts it under the same build.
    store.save(ME, pack({ version: 2 }));
    expect(store.load(ME, 'neon-city')).toEqual(pack({ version: 2 }));
  });
});
