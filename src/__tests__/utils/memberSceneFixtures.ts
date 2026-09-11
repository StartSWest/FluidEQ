/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { generateKeyPairSync, sign } from 'crypto';
import type { IScenePack, IScenePackEnvelope } from '../../common/scenePacks';
import { SCENE_CONTRACT_VERSION } from '../../common/sceneUniformContract';
import { trustMemberSceneKeyForTesting } from '../../main/scenePackVerify';

/**
 * A member scene and the signed file another member would receive, made the
 * way `sign-member-scene` makes them, with a keypair the app is told to trust
 * for the member class only.
 */

export const MEMBER_KEY_ID = 'test-member-key';
const { publicKey, privateKey } = generateKeyPairSync('ed25519');
trustMemberSceneKeyForTesting(MEMBER_KEY_ID, publicKey);

/** A key nobody trusts, for the file that was never signed by FluidEQ. */
const stranger = generateKeyPairSync('ed25519');

export const ME = '4f1c2b9e-8d3a-4e7b-9c11-2a6f0d5e7b30';
export const SOMEONE = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';

export const SOURCE = `vec4 sceneColour(vec2 uv) {
  return vec4(uAccent * texture(uSpectrumSlow, vec2(uv.x, 0.5)).r, 1.0);
}
`;

export const memberPack = (over: Partial<IScenePack> = {}): IScenePack => ({
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

export const memberPayload = ({
  author = SOMEONE,
  name = 'Mei Tanaka',
  pack = memberPack(),
  extra = {},
}: {
  author?: string;
  name?: string | null;
  pack?: IScenePack;
  extra?: Record<string, unknown>;
} = {}) =>
  JSON.stringify({
    schema: 1,
    kind: 'member-scene',
    author: { id: author, name },
    exportedAt: '2026-09-10T12:00:00.000Z',
    pack,
    ...extra,
  });

/**
 * What `fetch` answers, as far as the code under test reads it. The test
 * environment has no `Response` of its own.
 */
export const fakeResponse = (status: number, body: unknown): Response => {
  const bytes =
    body instanceof Uint8Array
      ? body
      : new TextEncoder().encode(
          typeof body === 'string' ? body : JSON.stringify(body),
        );
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null },
    json: async () => body,
    arrayBuffer: async () =>
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  } as unknown as Response;
};

/** A few bytes that are a WebP by their RIFF header, as a picture must be. */
export const webpBytes = (size = 64): Uint8Array => {
  const bytes = new Uint8Array(size);
  bytes.set(new TextEncoder().encode('RIFF'), 0);
  bytes.set(new TextEncoder().encode('WEBP'), 8);
  return bytes;
};

export const signedEnvelope = (
  payload: string,
  { trusted = true }: { trusted?: boolean } = {},
): IScenePackEnvelope => {
  const bytes = Buffer.from(payload, 'utf8');
  return {
    schema: 1,
    keyId: MEMBER_KEY_ID,
    algorithm: 'ed25519',
    payload: bytes.toString('base64'),
    signature: sign(
      null,
      bytes,
      trusted ? privateKey : stranger.privateKey,
    ).toString('base64'),
  };
};
