/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  encodeChainSettings,
  roomHeadOnWire,
} from '../../../common/dsp/chainWire';
import { DSP_DEFAULTS, ROOM_HEADS } from '../../../common/dsp/chain';
import { flushPendingWrites, forgetPath } from '../../../main/asyncWriter';
import {
  ROOM_HEAD_FILENAME,
  forgetRoomHead,
  writeRoomHead,
} from '../../../main/roomHead';
import { writeSystemDspChain } from '../../../main/systemDspChain';

/**
 * The shipped heads in the shape the engine's `parse_room_head` reads: a
 * name line, then for each of three rates a `rate` line and one line of
 * numbers per direction.
 */
const blocksOf = (text: string) => {
  const lines = text.split('\n');
  const rates: {
    rate: number;
    directions: number;
    taps: number;
    rows: number;
  }[] = [];
  lines.forEach((line, at) => {
    const header = /^rate (\d+) directions (\d+) taps (\d+)$/.exec(line);
    if (!header) {
      return;
    }
    const directions = Number(header[2]);
    const rows = lines
      .slice(at + 1, at + 1 + directions)
      .filter((row) => row.split(' ').length === Number(header[3]) * 2).length;
    rates.push({
      rate: Number(header[1]),
      directions,
      taps: Number(header[3]),
      rows,
    });
  });
  return rates;
};

describe('the room head file', () => {
  let configDir: string;

  beforeEach(() => {
    configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-room-head-'));
    forgetRoomHead();
  });

  afterEach(async () => {
    await flushPendingWrites().catch(() => undefined);
    forgetPath(path.join(configDir, ROOM_HEAD_FILENAME));
    forgetPath(path.join(configDir, 'fluideq-dsp.txt'));
    fs.rmSync(configDir, { recursive: true, force: true });
  });

  it.each(ROOM_HEADS)(
    'ships the %s head at three rates, 24 directions each',
    (head) => {
      const text = fs.readFileSync(
        path.join(__dirname, '../../../../assets/room/heads', `${head}.txt`),
        'utf8',
      );
      expect(text.split('\n')[0]).toBe(`# FluidEQ room head v1 ${head}`);
      expect(blocksOf(text)).toEqual([
        { rate: 44100, directions: 24, taps: 256, rows: 24 },
        { rate: 48000, directions: 24, taps: 256, rows: 24 },
        { rate: 96000, directions: 24, taps: 512, rows: 24 },
      ]);
    },
  );

  it('writes the chosen head beside the rack, once, and again when it changes', async () => {
    await writeRoomHead(configDir, 'large');
    await flushPendingWrites();
    const file = path.join(configDir, ROOM_HEAD_FILENAME);
    expect(fs.readFileSync(file, 'utf8').split('\n')[0]).toBe(
      '# FluidEQ room head v1 large',
    );
    const before = fs.statSync(file).mtimeMs;
    // The same head again is no write at all: the engine reloads every
    // output on any write in this folder.
    const backdated = Math.floor(before / 1000) * 1000 - 5000;
    fs.utimesSync(file, new Date(backdated), new Date(backdated));
    await writeRoomHead(configDir, 'large');
    await flushPendingWrites();
    expect(fs.statSync(file).mtimeMs).toBe(backdated);

    await writeRoomHead(configDir, 'small');
    await flushPendingWrites();
    expect(fs.readFileSync(file, 'utf8').split('\n')[0]).toBe(
      '# FluidEQ room head v1 small',
    );
  });

  it('is written from the rack message itself', async () => {
    const values = encodeChainSettings({
      ...DSP_DEFAULTS,
      room: { ...DSP_DEFAULTS.room, head: 'small' },
    });
    expect(roomHeadOnWire(values)).toBe('small');
    await writeSystemDspChain(configDir, values);
    await flushPendingWrites();
    expect(
      fs
        .readFileSync(path.join(configDir, ROOM_HEAD_FILENAME), 'utf8')
        .split('\n')[0],
    ).toBe('# FluidEQ room head v1 small');
    expect(fs.existsSync(path.join(configDir, 'fluideq-dsp.txt'))).toBe(true);
  });

  it('reads a rack from before the room as the medium head', () => {
    const values = encodeChainSettings(DSP_DEFAULTS);
    values[values.length - 1] = 0;
    expect(roomHeadOnWire(values)).toBe('medium');
    expect(roomHeadOnWire([])).toBe('medium');
  });
});
