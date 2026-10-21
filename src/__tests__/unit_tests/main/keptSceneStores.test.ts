/** @jest-environment node */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Both scene stores keep the version a newer one replaces, play a pinned one
 * in its place, and still measure updates by the newest held — a pin that
 * read as the held version would make every check download the newest again
 * (Ivan, 2026-10-18: "careful to dont waste server reosurces").
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { generateKeyPairSync, sign } from 'crypto';
import { memberLookId } from '../../../common/memberScenes';
import { premiumLookId } from '../../../common/scenePacks';
import { createVersionPins } from '../../../main/keptVersions';
import { createMemberSceneStore } from '../../../main/memberScenes/store';
import { createScenePackStore } from '../../../main/scenePackStore';
import { trustScenePackKeyForTesting } from '../../../main/scenePackVerify';
import {
  memberPack,
  memberPayload,
  signedEnvelope,
  SOMEONE,
} from '../../utils/memberSceneFixtures';

jest.mock('electron', () => ({
  safeStorage: jest.requireActual('../../utils/sceneStorageCipher')
    .sceneStorageCipher,
}));

const { publicKey, privateKey } = generateKeyPairSync('ed25519');
trustScenePackKeyForTesting('kept-test', publicKey);

/** FluidEQ's own scene, signed, at `version`. */
const officialListing = (version: number) => {
  const bytes = Buffer.from(JSON.stringify(memberPack({ version })));
  return {
    id: 'neon-city',
    version,
    envelope: {
      schema: 1 as const,
      algorithm: 'ed25519' as const,
      keyId: 'kept-test',
      payload: bytes.toString('base64'),
      signature: sign(null, bytes, privateKey).toString('base64'),
    },
  };
};

const imported = (version: number) =>
  signedEnvelope(memberPayload({ pack: memberPack({ version }) }));

let root: string;
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'kept-stores-'));
});
afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

describe("FluidEQ's scenes", () => {
  it('keep the replaced version, play a pinned one, and measure updates by the newest', () => {
    const pins = createVersionPins(root);
    const store = createScenePackStore({ userDataDir: root, pins });
    store.adopt([officialListing(1)]);
    store.adopt([officialListing(2)]);
    store.adopt([officialListing(3)]);
    expect(store.keptVersions('neon-city')).toEqual([2, 1]);
    // The control: nothing pinned, the newest plays.
    expect(store.load('neon-city')?.version).toBe(3);

    pins.pin(premiumLookId('neon-city'), 1);
    expect(store.load('neon-city')?.version).toBe(1);
    expect(store.list().find(({ id }) => id === 'neon-city')?.version).toBe(1);
    expect(store.newest('neon-city')?.version).toBe(3);
    expect(store.newestVersion('neon-city')).toBe(3);

    pins.pin(premiumLookId('neon-city'), undefined);
    expect(store.load('neon-city')?.version).toBe(3);
  });

  it('play the newest when the pinned version is no longer kept, and forget every version on removal', () => {
    const pins = createVersionPins(root);
    const store = createScenePackStore({ userDataDir: root, pins });
    store.adopt([officialListing(1)]);
    store.adopt([officialListing(2)]);
    pins.pin(premiumLookId('neon-city'), 7);
    expect(store.load('neon-city')?.version).toBe(2);
    store.remove('neon-city');
    expect(store.keptVersions('neon-city')).toEqual([]);
  });
});

describe('scenes another member made', () => {
  it('keep the replaced version, play a pinned one, and measure updates by the newest', () => {
    const pins = createVersionPins(root);
    const store = createMemberSceneStore({ userDataDir: root, pins });
    store.saveImported(imported(1));
    store.saveImported(imported(2));
    expect(store.keptVersions(SOMEONE, 'neon-city')).toEqual([1]);
    expect(store.load(SOMEONE, 'neon-city')?.version).toBe(2);

    pins.pin(memberLookId(SOMEONE, 'neon-city'), 1);
    expect(store.load(SOMEONE, 'neon-city')?.version).toBe(1);
    expect(
      store.list().find(({ packId }) => packId === 'neon-city')?.version,
    ).toBe(1);
    expect(store.newest(SOMEONE, 'neon-city')?.version).toBe(2);

    store.remove(SOMEONE, 'neon-city');
    expect(store.keptVersions(SOMEONE, 'neon-city')).toEqual([]);
  });
});
