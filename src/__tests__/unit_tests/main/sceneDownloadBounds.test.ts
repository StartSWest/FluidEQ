/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * @jest-environment node
 */

/**
 * Every bound a scene meets on its way to a listener holds the largest scene
 * a member may publish (Ivan, 2026-11-28: "time to increase the limit to 10
 * mb"). The Studio's limit, the pack a download accepts, and the signed file
 * each download reads it from — a member's (`MAX_MEMBER_SCENE_FILE_BYTES`)
 * and FluidEQ's own (`MAX_ENVELOPE_BYTES`, which was a fixed 12 MiB and would
 * have refused a 10 MiB official scene) — are held here against a file built
 * the way the server signs one.
 */

import { MAX_MEMBER_SCENE_FILE_BYTES } from '../../../common/memberSceneFile';
import { MAX_PUBLISH_BYTES } from '../../../common/scenePackSize';
import { MAX_PACK_BYTES } from '../../../common/scenePacks';
import { MAX_ENVELOPE_BYTES } from '../../../main/plus/officialGallery';

const bytesOf = (value: unknown) =>
  new TextEncoder().encode(JSON.stringify(value)).byteLength;

/**
 * The file the server writes for a payload of `payloadBytes`: the payload as
 * base64 with the key's id and a 64-byte Ed25519 signature
 * (`signAndRecord`, `publishOfficial`).
 */
const signedFileBytes = (payloadBytes: number) =>
  bytesOf({
    schema: 1,
    keyId: 'member-2026-09',
    algorithm: 'ed25519',
    payload: 'A'.repeat(Math.ceil(payloadBytes / 3) * 4),
    signature: 'A'.repeat(88),
  });

/** What a member's payload carries beside the pack. */
const MEMBER_WRAPPER = bytesOf({
  schema: 1,
  kind: 'member-scene',
  author: { id: '10000000-0000-4000-8000-000000000001', name: 'x'.repeat(60) },
  exportedAt: '2026-11-28T00:00:00.000Z',
});

describe('a scene at the publish limit', () => {
  it('is a pack a download accepts', () => {
    expect(MAX_PUBLISH_BYTES).toBe(10 * 1024 * 1024);
    expect(MAX_PACK_BYTES).toBeGreaterThanOrEqual(MAX_PUBLISH_BYTES);
  });

  it("travels in a member's signed file", () => {
    expect(
      signedFileBytes(MAX_PUBLISH_BYTES + MEMBER_WRAPPER),
    ).toBeLessThanOrEqual(MAX_MEMBER_SCENE_FILE_BYTES);
  });

  it("travels in FluidEQ's own signed file", () => {
    const file = signedFileBytes(MAX_PUBLISH_BYTES);
    expect(file).toBeLessThanOrEqual(MAX_ENVELOPE_BYTES);
    // The control: the fixed 12 MiB it replaced refused that file.
    expect(file).toBeGreaterThan(12 * 1024 * 1024);
  });
});
