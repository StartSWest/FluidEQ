/** @jest-environment node */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Every field a scene can carry, through every way a scene is written down
 * and read again (Ivan, 2026-11-11: "we cannot have missing data on
 * publish"). Palettes, colours and choices were lost because the one scene
 * that used them went through a pair nobody had walked. Here one scene with
 * EVERY field (`everyFieldScene.ts`, whose list of fields the compiler holds
 * to `IScenePack`) goes through each pair, and has to come back the same.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { generateKeyPairSync, sign } from 'crypto';
import {
  checkMemberScene,
  readMemberScene,
  memberLookId,
} from '../../../common/memberScenes';
import {
  normalizeScenePack,
  parseScenePackPayload,
  type IScenePack,
} from '../../../common/scenePacks';
import storedScenePack from '../../../common/sceneStoredPack';
import { createVersionPins } from '../../../main/keptVersions';
import { createMemberSceneStore } from '../../../main/memberScenes/store';
import { createScenePackStore } from '../../../main/scenePackStore';
import { trustScenePackKeyForTesting } from '../../../main/scenePackVerify';
import { EVERY_PACK_FIELD, everyFieldPack } from '../../utils/everyFieldScene';
import {
  ME,
  memberPayload,
  signedEnvelope,
  SOMEONE,
} from '../../utils/memberSceneFixtures';

jest.mock('../../../main/sceneCacheFile', () => ({
  __esModule: true,
  ...jest.requireActual('../../../main/sceneCacheFile'),
}));

jest.mock('electron', () => ({
  safeStorage: jest.requireActual('../../utils/sceneStorageCipher')
    .sceneStorageCipher,
}));

const official = generateKeyPairSync('ed25519');
trustScenePackKeyForTesting('every-field', official.publicKey);

const FIELDS = Object.keys(EVERY_PACK_FIELD) as (keyof IScenePack)[];

/** The same scene, field by field, so a failure names the field lost. */
const expectSame = (got: IScenePack | undefined | null, want: IScenePack) => {
  expect(got).toBeTruthy();
  if (!got) {
    return;
  }
  FIELDS.forEach((field) => {
    expect({ field, value: got[field] }).toEqual({ field, value: want[field] });
  });
  expect(Object.keys(got).sort()).toEqual(Object.keys(want).sort());
};

let root: string;
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'every-field-'));
});
afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

it('the scene carries every field a pack can carry', () => {
  const pack = everyFieldPack();
  FIELDS.forEach((field) => {
    expect({ field, carried: pack[field] !== undefined }).toEqual({
      field,
      carried: true,
    });
  });
  // And each of the three kinds of control that live among `params`.
  expect(pack.params.some((param) => param.options)).toBe(true);
  expect(pack.palettes).toHaveLength(1);
  expect(pack.colours).toHaveLength(1);
});

it('the stored layout names every control by its kind, among params alone', () => {
  // What the signing service reads: it knows a choice, a palette and a
  // colour only by `type`, and reads nothing outside `params`. The app's
  // own reader heals a pack that says less, so only the shape can show it.
  const stored = storedScenePack(everyFieldPack());
  expect(stored).not.toHaveProperty('palettes');
  expect(stored).not.toHaveProperty('colours');
  const params = stored.params as { type?: string; options?: unknown }[];
  expect(params.map((param) => param.type)).toEqual([
    undefined,
    undefined,
    'choice',
    'palette',
    'colour',
  ]);
  expect(params.filter((param) => param.options)).toHaveLength(1);
});

describe('every field survives', () => {
  it('the wire to the signing service and back (export, publish)', () => {
    expect.hasAssertions();
    const pack = everyFieldPack();
    const sent = JSON.parse(JSON.stringify(storedScenePack(pack)));
    expectSame(normalizeScenePack(sent), pack);
    expectSame(readMemberScene(sent), pack);
    const checked = checkMemberScene(sent);
    expectSame(checked.ok ? checked.pack : undefined, pack);
  });

  it('a pack written down as built, by any FluidEQ that did', () => {
    expect.hasAssertions();
    const pack = everyFieldPack();
    const built = JSON.parse(JSON.stringify(pack));
    expectSame(normalizeScenePack(built), pack);
    expectSame(parseScenePackPayload(JSON.stringify(pack)), pack);
    expectSame(readMemberScene(built), pack);
  });

  it("the maker's own copy in the looks, kept at Add to looks and at publication", () => {
    expect.hasAssertions();
    const pack = everyFieldPack();
    createMemberSceneStore({ userDataDir: root }).save(ME, pack);
    const store = createMemberSceneStore({ userDataDir: root });
    expectSame(store.load(ME, pack.id), pack);
    expectSame(store.newest(ME, pack.id), pack);
  });

  it("another member's scene: imported from a file, synced from the gallery, and a saved earlier version", () => {
    const pack = everyFieldPack();
    const envelopeOf = (version: number) =>
      signedEnvelope(
        memberPayload({ pack: storedScenePack({ ...pack, version }) as never }),
      );
    const pins = createVersionPins(root);
    const store = createMemberSceneStore({ userDataDir: root, pins });
    store.saveImported(envelopeOf(pack.version + 1));
    expectSame(store.load(SOMEONE, pack.id), {
      ...pack,
      version: pack.version + 1,
    });
    // The version the server keeps, saved beside it and played when pinned.
    expect(
      store.keepSaved(envelopeOf(pack.version), SOMEONE, pack.id, pack.version),
    ).toBe(true);
    pins.pin(memberLookId(SOMEONE, pack.id), pack.version);
    expectSame(
      createMemberSceneStore({ userDataDir: root, pins }).load(
        SOMEONE,
        pack.id,
      ),
      pack,
    );
  });

  it("one of FluidEQ's own, signed and adopted", () => {
    expect.hasAssertions();
    const pack = everyFieldPack();
    const bytes = Buffer.from(JSON.stringify(storedScenePack(pack)));
    const store = createScenePackStore({ userDataDir: root });
    store.adopt([
      {
        id: pack.id,
        version: pack.version,
        envelope: {
          schema: 1,
          algorithm: 'ed25519',
          keyId: 'every-field',
          payload: bytes.toString('base64'),
          signature: sign(null, bytes, official.privateKey).toString('base64'),
        },
      },
    ]);
    expectSame(createScenePackStore({ userDataDir: root }).load(pack.id), pack);
  });
});

describe('a save that would leave a poorer copy', () => {
  // The write itself made to lose a field, as the built layout once did.
  const losing = (field: 'params' | 'world') => {
    const cache = jest.requireActual('../../../main/sceneCacheFile');
    return jest
      .spyOn(
        jest.requireMock('../../../main/sceneCacheFile'),
        'writeSceneCache',
      )
      .mockImplementation((...args: unknown[]) => {
        const [file, scope, value] = args as [
          string,
          string,
          { pack?: object },
        ];
        const pack = { ...(value.pack as Record<string, unknown>) };
        if (field === 'world') {
          delete pack.world;
        } else {
          pack.params = (pack.params as { type?: string }[]).filter(
            (param) => param.type !== 'palette',
          );
        }
        cache.writeSceneCache(file, scope, { ...value, pack });
      });
  };

  it.each(['params', 'world'] as const)(
    'fails loudly and keeps the copy before it (%s lost)',
    (field) => {
      const pack = everyFieldPack();
      const store = createMemberSceneStore({ userDataDir: root });
      store.save(ME, pack);
      const spy = losing(field);
      expect(() =>
        store.save(ME, { ...pack, version: pack.version + 1 }),
      ).toThrow(/did not read back/);
      spy.mockRestore();
      // The good copy is still the one in the looks, after a restart too.
      expectSame(store.load(ME, pack.id), pack);
      expectSame(
        createMemberSceneStore({ userDataDir: root }).load(ME, pack.id),
        pack,
      );
    },
  );

  it('leaves nothing behind when there was no copy before', () => {
    const pack = everyFieldPack();
    const store = createMemberSceneStore({ userDataDir: root });
    const spy = losing('params');
    expect(() => store.save(ME, pack)).toThrow(/did not read back/);
    spy.mockRestore();
    expect(store.load(ME, pack.id)).toBeUndefined();
    // The control: the same save, unharmed, lands.
    store.save(ME, pack);
    expectSame(store.load(ME, pack.id), pack);
  });
});
