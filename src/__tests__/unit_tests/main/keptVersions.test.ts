/** @jest-environment node */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Earlier versions of a scene, kept on this computer so an owner can play
 * any of them again without the server (`keptVersions.ts`). What is held: the
 * file being replaced is copied aside and only the newest KEPT_VERSIONS stay;
 * a write that fails takes the copy back; and which version plays is a pin
 * that survives a restart and reads a damaged file as none.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  KEPT_VERSIONS,
  createVersionPins,
  forgetKeptVersions,
  keepSavedVersion,
  keptVersionFile,
  keptVersionsOf,
  replaceKeepingVersion,
} from '../../../main/keptVersions';

let root: string;
let scene: string;

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'kept-versions-'));
  scene = path.join(root, 'alpine.pack.enc');
});
afterEach(() => {
  jest.restoreAllMocks();
  fs.rmSync(root, { recursive: true, force: true });
});

/** Puts `version` in the scene file, keeping the one it replaces. */
const publish = (version: number, replaced?: number) =>
  replaceKeepingVersion(scene, replaced, () =>
    fs.writeFileSync(scene, `v${version}`),
  );

describe('keeping the version a newer one replaces', () => {
  it('copies the file as it was, under its version, before the write', () => {
    publish(1);
    expect(keptVersionsOf(scene)).toEqual([]);
    publish(2, 1);
    publish(3, 2);
    expect(fs.readFileSync(scene, 'utf8')).toBe('v3');
    expect(keptVersionsOf(scene)).toEqual([2, 1]);
    expect(fs.readFileSync(keptVersionFile(scene, 1), 'utf8')).toBe('v1');
    expect(fs.readFileSync(keptVersionFile(scene, 2), 'utf8')).toBe('v2');
  });

  it(`keeps the newest ${KEPT_VERSIONS} and lets the oldest go`, () => {
    publish(1);
    for (let version = 2; version <= KEPT_VERSIONS + 3; version += 1) {
      publish(version, version - 1);
    }
    const kept = keptVersionsOf(scene);
    expect(kept).toHaveLength(KEPT_VERSIONS);
    expect(kept[0]).toBe(KEPT_VERSIONS + 2);
    expect(kept).not.toContain(1);
    expect(kept).not.toContain(2);
  });

  it('takes the copy back when the write fails, and leaves no empty folder', () => {
    publish(1);
    expect(() =>
      replaceKeepingVersion(scene, 1, () => {
        throw new Error('disk full');
      }),
    ).toThrow('disk full');
    expect(fs.readFileSync(scene, 'utf8')).toBe('v1');
    expect(keptVersionsOf(scene)).toEqual([]);
    expect(fs.readdirSync(root)).toEqual(['alpine.pack.enc']);
  });

  it('keeps versions already kept when a later write fails', () => {
    publish(1);
    publish(2, 1);
    expect(() =>
      replaceKeepingVersion(scene, 2, () => {
        throw new Error('disk full');
      }),
    ).toThrow();
    // The copy of 2 this attempt made is gone; 1, kept before, stays.
    expect(keptVersionsOf(scene)).toEqual([1]);
  });

  it('keeps nothing without a version or a file to keep', () => {
    publish(1);
    publish(2);
    expect(keptVersionsOf(scene)).toEqual([]);
    const missing = path.join(root, 'missing.pack.enc');
    replaceKeepingVersion(missing, 4, () => fs.writeFileSync(missing, 'v5'));
    expect(keptVersionsOf(missing)).toEqual([]);
  });

  it('forgets every kept version with the scene, and lists only version names', () => {
    publish(1);
    publish(2, 1);
    fs.writeFileSync(path.join(`${scene}.versions`, 'notes.txt'), 'x');
    expect(keptVersionsOf(scene)).toEqual([1]);
    forgetKeptVersions(scene);
    expect(fs.existsSync(`${scene}.versions`)).toBe(false);
  });
});

describe('a version the member saved on purpose', () => {
  /** Keeps `version` as a save from the server writes it. */
  const save = (version: number) =>
    keepSavedVersion(scene, version, (target) =>
      fs.writeFileSync(target, `saved v${version}`),
    );

  it(`is never let go, and holds no place among the ${KEPT_VERSIONS} an update keeps`, () => {
    publish(5);
    save(2);
    for (let version = 6; version <= KEPT_VERSIONS + 8; version += 1) {
      publish(version, version - 1);
    }
    const kept = keptVersionsOf(scene);
    expect(kept).toContain(2);
    expect(fs.readFileSync(keptVersionFile(scene, 2), 'utf8')).toBe('saved v2');
    // The control: the updates' own still keep exactly the newest ten.
    expect(kept.filter((version) => version !== 2)).toHaveLength(KEPT_VERSIONS);
    expect(kept).not.toContain(5);
  });

  it('leaves nothing behind when its write fails', () => {
    publish(5);
    expect(() =>
      keepSavedVersion(scene, 2, () => {
        throw new Error('disk full');
      }),
    ).toThrow('disk full');
    expect(keptVersionsOf(scene)).toEqual([]);
    expect(fs.readdirSync(root)).toEqual(['alpine.pack.enc']);
    // Beside a version already kept, the folder stays and holds no mark: a
    // mark left there would hold an update's own copy of 2 for good.
    publish(6, 5);
    expect(() =>
      keepSavedVersion(scene, 2, () => {
        throw new Error('disk full');
      }),
    ).toThrow('disk full');
    expect(fs.readdirSync(`${scene}.versions`)).toEqual(['5']);
  });

  it('loses its mark with its file, so a version kept again later can be let go', () => {
    publish(5);
    save(2);
    // A copy that stopped verifying is removed by its store.
    fs.rmSync(keptVersionFile(scene, 2));
    publish(6, 5);
    expect(fs.readdirSync(`${scene}.versions`).sort()).toEqual(['5']);
  });
});

describe('which version a look plays', () => {
  it('pins and unpins, and the pins survive a restart', () => {
    const pins = createVersionPins(root);
    expect(pins.pinned('premium:alpine')).toBeUndefined();
    pins.pin('premium:alpine', 46);
    pins.pin('member:a:b', 2);
    expect(createVersionPins(root).pinned('premium:alpine')).toBe(46);
    pins.pin('premium:alpine', undefined);
    const again = createVersionPins(root);
    expect(again.pinned('premium:alpine')).toBeUndefined();
    expect(again.pinned('member:a:b')).toBe(2);
  });

  it('reads a damaged or foreign pins file as no pins', () => {
    const file = path.join(root, 'version-pins.json');
    fs.writeFileSync(file, '{not json');
    expect(createVersionPins(root).pinned('premium:alpine')).toBeUndefined();
    fs.writeFileSync(file, JSON.stringify({ 'premium:alpine': 'six' }));
    expect(createVersionPins(root).pinned('premium:alpine')).toBeUndefined();
    // The control: a sound file is read.
    fs.writeFileSync(file, JSON.stringify({ 'premium:alpine': 6 }));
    expect(createVersionPins(root).pinned('premium:alpine')).toBe(6);
  });
});
