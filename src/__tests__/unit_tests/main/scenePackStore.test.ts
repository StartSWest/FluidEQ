/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later

@jest-environment node
*/

import { generateKeyPairSync, sign } from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  SCENE_PACK_SCHEMA,
  type IScenePackEnvelope,
} from '../../../common/scenePacks';
import {
  trustScenePackKeyForTesting,
  verifyScenePackEnvelope,
} from '../../../main/scenePackVerify';
import { createScenePackStore } from '../../../main/scenePackStore';

const KEY_ID = 'test-key';
const { publicKey, privateKey } = generateKeyPairSync('ed25519');
trustScenePackKeyForTesting(KEY_ID, publicKey);

const SOURCE = 'vec4 sceneColour(vec2 uv) { return vec4(uv, 0.0, 1.0); }';

const payloadFor = (
  id: string,
  version = 1,
  over: Record<string, unknown> = {},
) =>
  JSON.stringify({
    schema: SCENE_PACK_SCHEMA,
    id,
    version,
    contract: 1,
    names: { en: id },
    fallbackStyle: 'area',
    swatch: ['#00e5cf'],
    source: SOURCE,
    params: [],
    ...over,
  });

const seal = (payload: string, keyId = KEY_ID): IScenePackEnvelope => {
  const bytes = Buffer.from(payload, 'utf8');
  return {
    schema: SCENE_PACK_SCHEMA,
    keyId,
    algorithm: 'ed25519',
    payload: bytes.toString('base64'),
    signature: sign(null, bytes, privateKey).toString('base64'),
  };
};

describe('verifying a signed envelope', () => {
  it('accepts a genuine signature and hands back the exact bytes', () => {
    const payload = payloadFor('aurora');
    expect(verifyScenePackEnvelope(seal(payload))).toBe(payload);
  });

  it('refuses a payload with one byte changed', () => {
    const envelope = seal(payloadFor('aurora'));
    const tampered = Buffer.from(envelope.payload, 'base64');
    tampered[10] = (tampered[10] + 1) % 256;
    expect(
      verifyScenePackEnvelope({
        ...envelope,
        payload: tampered.toString('base64'),
      }),
    ).toBeUndefined();
  });

  it('refuses a signature with one byte changed', () => {
    const envelope = seal(payloadFor('aurora'));
    const tampered = Buffer.from(envelope.signature, 'base64');
    tampered[3] = (tampered[3] + 1) % 256;
    expect(
      verifyScenePackEnvelope({
        ...envelope,
        signature: tampered.toString('base64'),
      }),
    ).toBeUndefined();
  });

  it('refuses a key it has not been told to trust', () => {
    expect(
      verifyScenePackEnvelope(seal(payloadFor('aurora'), 'somebody-else')),
    ).toBeUndefined();
  });

  it('refuses a signature of the wrong length without trying it', () => {
    const envelope = seal(payloadFor('aurora'));
    expect(
      verifyScenePackEnvelope({ ...envelope, signature: 'AAAA' }),
    ).toBeUndefined();
  });
});

describe('the scene pack store', () => {
  let directory: string;

  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-packs-'));
  });

  afterEach(() => {
    fs.rmSync(directory, { force: true, recursive: true });
  });

  const build = () => createScenePackStore({ userDataDir: directory });

  it('starts empty', () => {
    expect(build().list()).toEqual([]);
  });

  it('adopts a genuine pack and lists it without its source', () => {
    const store = build();
    expect(
      store.adopt([
        { id: 'aurora', version: 1, envelope: seal(payloadFor('aurora')) },
      ]),
    ).toBe(1);

    const [summary] = store.list();
    expect(summary).toMatchObject({ id: 'aurora', version: 1 });
    expect(summary).not.toHaveProperty('source');
    expect(store.load('aurora')?.source).toBe(SOURCE);
  });

  it('refuses a listing whose envelope does not verify, and does not refetch it', () => {
    const store = build();
    const bad = seal(payloadFor('aurora'), 'somebody-else');
    expect(store.adopt([{ id: 'aurora', version: 1, envelope: bad }])).toBe(0);
    expect(store.list()).toEqual([]);
    // Same id, same version, offered again: already known bad.
    expect(store.adopt([{ id: 'aurora', version: 1, envelope: bad }])).toBe(0);
    // A new version gets a fresh chance.
    expect(
      store.adopt([
        { id: 'aurora', version: 2, envelope: seal(payloadFor('aurora', 2)) },
      ]),
    ).toBe(1);
  });

  it('refuses an envelope whose payload names a different pack', () => {
    const store = build();
    expect(
      store.adopt([
        { id: 'nebula', version: 1, envelope: seal(payloadFor('aurora')) },
      ]),
    ).toBe(0);
  });

  /**
   * The cache is a convenience, not a trust boundary: a file edited on disk
   * fails verification on the next read and is removed.
   */
  it('rejects a cached file that was tampered with after download', () => {
    const store = build();
    store.adopt([
      { id: 'aurora', version: 1, envelope: seal(payloadFor('aurora')) },
    ]);
    const file = path.join(
      directory,
      'scene-packs',
      'packs',
      'aurora.pack.json',
    );
    const envelope = JSON.parse(
      fs.readFileSync(file, 'utf8'),
    ) as IScenePackEnvelope;
    const forged = Buffer.from(
      payloadFor('aurora', 1, {
        source: 'vec4 sceneColour(vec2 uv){return vec4(1.0);}',
      }),
    ).toString('base64');
    fs.writeFileSync(file, JSON.stringify({ ...envelope, payload: forged }));

    expect(build().load('aurora')).toBeUndefined();
    expect(fs.existsSync(file)).toBe(false);
  });

  it('keeps the newer version and ignores an older listing', () => {
    const store = build();
    store.adopt([
      { id: 'aurora', version: 3, envelope: seal(payloadFor('aurora', 3)) },
    ]);
    expect(
      store.adopt([
        { id: 'aurora', version: 2, envelope: seal(payloadFor('aurora', 2)) },
      ]),
    ).toBe(0);
    expect(store.load('aurora')?.version).toBe(3);
  });

  it('holds back a pack written for a newer contract than this build', () => {
    const store = build();
    store.adopt([
      {
        id: 'future',
        version: 1,
        envelope: seal(payloadFor('future', 1, { contract: 99 })),
      },
    ]);
    expect(store.list()).toEqual([]);
    expect(store.load('future')).toBeUndefined();
  });

  it('quarantines a pack the renderer could not run, and releases it on a new version', () => {
    const store = build();
    store.adopt([
      { id: 'aurora', version: 1, envelope: seal(payloadFor('aurora')) },
    ]);
    store.quarantine('aurora', 'compile');

    expect(store.list()[0].quarantined).toBe('compile');
    expect(store.load('aurora')).toBeUndefined();
    // Survives a restart.
    expect(build().load('aurora')).toBeUndefined();

    store.adopt([
      { id: 'aurora', version: 2, envelope: seal(payloadFor('aurora', 2)) },
    ]);
    expect(store.list()[0].quarantined).toBeUndefined();
    expect(store.load('aurora')?.version).toBe(2);
  });

  /**
   * A shader that would not compile on one build's driver bundle may compile
   * on the next. An entry that outlived its reason would hide a working look.
   */
  it('honours a quarantine only under the app version that wrote it', () => {
    const first = createScenePackStore({
      userDataDir: directory,
      appVersion: '1.6.5',
    });
    first.adopt([
      { id: 'aurora', version: 1, envelope: seal(payloadFor('aurora')) },
    ]);
    first.quarantine('aurora', 'compile');
    expect(first.load('aurora')).toBeUndefined();

    const next = createScenePackStore({
      userDataDir: directory,
      appVersion: '1.6.6',
    });
    expect(next.load('aurora')?.id).toBe('aurora');
    expect(next.list()[0].quarantined).toBeUndefined();
  });

  it('ignores ids that are not pack ids', () => {
    const store = build();
    expect(store.load('../../etc/passwd')).toBeUndefined();
    expect(
      store.adopt([
        { id: 'A B', version: 1, envelope: seal(payloadFor('aurora')) },
      ]),
    ).toBe(0);
  });
});
