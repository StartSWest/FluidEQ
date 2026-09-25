/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { generateKeyPairSync, sign } from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { safeStorage } from 'electron';
import {
  SCENE_PACK_SCHEMA,
  type IScenePackEnvelope,
} from '../../../common/scenePacks';
import { createMemberSceneStore } from '../../../main/memberScenes/store';
import { createScenePackStore } from '../../../main/scenePackStore';
import { trustScenePackKeyForTesting } from '../../../main/scenePackVerify';
import {
  ME,
  memberPack,
  memberPayload,
  signedEnvelope,
} from '../../utils/memberSceneFixtures';

jest.mock('electron', () => ({
  safeStorage: jest.requireActual('../../utils/sceneStorageCipher')
    .sceneStorageCipher,
}));

const KEY_ID = 'summary-cache-test';
const { publicKey, privateKey } = generateKeyPairSync('ed25519');
trustScenePackKeyForTesting(KEY_ID, publicKey);

const sealOfficial = (version: number): IScenePackEnvelope => {
  const bytes = Buffer.from(
    JSON.stringify({
      schema: SCENE_PACK_SCHEMA,
      id: 'aurora',
      version,
      contract: 1,
      names: { en: 'Aurora' },
      fallbackStyle: 'area',
      swatch: ['#00e5cf'],
      source: 'vec4 sceneColour(vec2 uv) { return vec4(uv, 0.0, 1.0); }',
      params: [],
    }),
    'utf8',
  );
  return {
    schema: SCENE_PACK_SCHEMA,
    keyId: KEY_ID,
    algorithm: 'ed25519',
    payload: bytes.toString('base64'),
    signature: sign(null, bytes, privateKey).toString('base64'),
  };
};

let userDataDir: string;

beforeEach(() => {
  userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-summaries-'));
});

afterEach(() => {
  jest.restoreAllMocks();
  fs.rmSync(userDataDir, { recursive: true, force: true });
});

/** How many scene files a call decrypted: every read of one decrypts it. */
const decryptsDuring = <T>(work: () => T): { value: T; decrypts: number } => {
  const decrypt = jest.spyOn(safeStorage, 'decryptString');
  try {
    const value = work();
    return { value, decrypts: decrypt.mock.calls.length };
  } finally {
    decrypt.mockRestore();
  }
};

describe('listing the scenes a member holds', () => {
  it('reads each scene once, not on every list, until one changes', () => {
    const store = createMemberSceneStore({ userDataDir });
    store.save(ME, memberPack());
    store.saveImported(signedEnvelope(memberPayload()));

    // The control: a first list does read every file.
    const first = decryptsDuring(() => store.list());
    expect(first.value).toHaveLength(2);
    expect(first.decrypts).toBe(2);

    // What every focus of the window asks, again and again.
    const again = decryptsDuring(() => [store.list(), store.list()]);
    expect(again.value).toEqual([first.value, first.value]);
    expect(again.decrypts).toBe(0);

    // A scene saved anew is read again, and only that one.
    store.save(ME, memberPack({ version: 2 }));
    const afterSave = decryptsDuring(() => store.list());
    expect(afterSave.decrypts).toBe(1);
    expect(afterSave.value.find((scene) => scene.own)?.version).toBe(2);
  });
});

describe('listing the FluidEQ scenes held', () => {
  it('verifies each pack once, not on every list, until one changes', () => {
    const store = createScenePackStore({ userDataDir });
    store.adopt([{ id: 'aurora', version: 1, envelope: sealOfficial(1) }]);

    const first = decryptsDuring(() => store.list());
    expect(first.value.map((pack) => pack.version)).toEqual([1]);
    expect(first.decrypts).toBe(1);

    const again = decryptsDuring(() => [store.list(), store.list()]);
    expect(again.value).toEqual([first.value, first.value]);
    expect(again.decrypts).toBe(0);

    store.adopt([{ id: 'aurora', version: 2, envelope: sealOfficial(2) }]);
    const afterAdopt = decryptsDuring(() => store.list());
    expect(afterAdopt.value.map((pack) => pack.version)).toEqual([2]);
    expect(afterAdopt.decrypts).toBe(1);

    store.remove('aurora');
    expect(store.list()).toEqual([]);
  });
});
