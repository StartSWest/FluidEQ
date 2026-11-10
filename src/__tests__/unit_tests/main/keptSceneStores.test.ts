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
import {
  createMemberSceneStore,
  memberSceneFingerprint,
} from '../../../main/memberScenes/store';
import { createScenePackStore } from '../../../main/scenePackStore';
import { trustScenePackKeyForTesting } from '../../../main/scenePackVerify';
import {
  memberPack,
  memberPayload,
  signedEnvelope,
  ME,
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

/**
 * A version saved from the server (premium 0100 keeps each scene's last ten)
 * joins the kept ones beside the newest, and nothing that is not exactly
 * that version of that scene, signed by the right key, gets in.
 */
describe('a version saved from the server', () => {
  it("of FluidEQ's own lands beside the newest, plays when pinned, and is refused when it is not that version", () => {
    const pins = createVersionPins(root);
    const store = createScenePackStore({ userDataDir: root, pins });
    const { envelope: first } = officialListing(1);
    // Not held yet: nothing to keep it beside.
    expect(store.keepSaved(first, 'neon-city', 1)).toBe(false);
    store.adopt([officialListing(3)]);
    expect(store.keepSaved(first, 'neon-city', 1)).toBe(true);
    expect(store.keptVersions('neon-city')).toEqual([1]);
    expect(store.newest('neon-city')?.version).toBe(3);
    pins.pin(premiumLookId('neon-city'), 1);
    expect(store.load('neon-city')?.version).toBe(1);
    pins.pin(premiumLookId('neon-city'), undefined);

    // The newest is already here, and kept nowhere else.
    expect(store.keepSaved(officialListing(3).envelope, 'neon-city', 3)).toBe(
      true,
    );
    expect(store.keptVersions('neon-city')).toEqual([1]);
    // Asked as another version, or as another scene, or signed by nobody we trust.
    expect(store.keepSaved(officialListing(2).envelope, 'neon-city', 1)).toBe(
      false,
    );
    expect(store.keepSaved(officialListing(2).envelope, 'other-city', 2)).toBe(
      false,
    );
    const forged = {
      ...officialListing(2).envelope,
      signature: officialListing(1).envelope.signature,
    };
    expect(store.keepSaved(forged, 'neon-city', 2)).toBe(false);
    // A member's signature is not FluidEQ's.
    expect(store.keepSaved(imported(2), 'neon-city', 2)).toBe(false);
    expect(store.keptVersions('neon-city')).toEqual([1]);

    // Ahead of a copy its update has not reached: kept beside it, and the
    // update, when it comes, keeps the copy it replaces as well.
    expect(store.keepSaved(officialListing(4).envelope, 'neon-city', 4)).toBe(
      true,
    );
    expect(store.newest('neon-city')?.version).toBe(3);
    store.adopt([officialListing(5)]);
    expect(store.keptVersions('neon-city')).toEqual([4, 3, 1]);
  });

  it("of another member's lands beside the newest, plays when pinned, and is refused when it is not theirs", () => {
    const pins = createVersionPins(root);
    const store = createMemberSceneStore({ userDataDir: root, pins });
    expect(store.keepSaved(imported(1), SOMEONE, 'neon-city', 1)).toBe(false);
    store.saveImported(imported(3));
    expect(store.keepSaved(imported(1), SOMEONE, 'neon-city', 1)).toBe(true);
    expect(store.keptVersions(SOMEONE, 'neon-city')).toEqual([1]);
    pins.pin(memberLookId(SOMEONE, 'neon-city'), 1);
    expect(store.load(SOMEONE, 'neon-city')?.version).toBe(1);
    expect(store.newest(SOMEONE, 'neon-city')?.version).toBe(3);

    expect(store.keepSaved(imported(3), SOMEONE, 'neon-city', 3)).toBe(true);
    expect(store.keptVersions(SOMEONE, 'neon-city')).toEqual([1]);
    expect(store.keepSaved(imported(2), SOMEONE, 'neon-city', 1)).toBe(false);
    // Another author's name on it, or a key that is not the member key.
    expect(store.keepSaved(imported(2), ME, 'neon-city', 2)).toBe(false);
    const untrusted = signedEnvelope(
      memberPayload({ pack: memberPack({ version: 2 }) }),
      { trusted: false },
    );
    expect(store.keepSaved(untrusted, SOMEONE, 'neon-city', 2)).toBe(false);
    // Blocked since: refused, though the same file was fine a moment ago.
    expect(store.keepSaved(imported(2), SOMEONE, 'neon-city', 2)).toBe(true);
    store.setBlocked([memberSceneFingerprint(SOMEONE, 'neon-city')]);
    expect(store.keepSaved(imported(2), SOMEONE, 'neon-city', 2)).toBe(false);
  });
});
