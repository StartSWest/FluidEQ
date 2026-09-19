/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { decodeTelemetry, MAGIC_TELEMETRY } from 'main/dspHost/wire';

it('decodes processing buffers separately from the output device buffer', () => {
  const bytes = Buffer.alloc(192);
  bytes.writeUInt32LE(MAGIC_TELEMETRY, 0);
  bytes.writeUInt32LE(1440, 24);
  bytes.writeUInt32LE(48000, 80);
  bytes.writeUInt32LE(336, 112);
  // linear EQ, restoration, leveler, room, bass punch, maximizer, headroom, safety.
  bytes.writeUInt32LE(240, 136);
  bytes.writeUInt32LE(96, 144);
  bytes.write('{AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE}', 152, 'ascii');
  const result = decodeTelemetry(bytes);
  expect(result?.latencyFrames).toBe(1440);
  expect(result).toMatchObject({
    processingEndpoint: '{AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE}',
    processingLatency: {
      rate: 48000,
      frames: 336,
      parts: [
        { stage: 'maximizer', frames: 240 },
        { stage: 'safety', frames: 96 },
      ],
    },
  });
});

it('refuses unavailable or inconsistent processing snapshots without discarding transport', () => {
  const bytes = Buffer.alloc(192);
  bytes.writeUInt32LE(MAGIC_TELEMETRY, 0);
  bytes.writeUInt32LE(48000, 80);
  bytes.writeDoubleLE(12.5, 96);
  bytes.writeUInt32LE(0xffffffff, 112);
  expect(decodeTelemetry(bytes)).toMatchObject({
    deckPositionSeconds: 12.5,
    processingLatency: undefined,
  });
  bytes.writeUInt32LE(100, 112);
  expect(decodeTelemetry(bytes)?.processingLatency).toBeUndefined();
  bytes.writeUInt32LE(0, 112);
  expect(decodeTelemetry(bytes)?.processingLatency).toEqual({
    rate: 48000,
    frames: 0,
    parts: [],
  });
});
