/** @jest-environment node */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Footsteps reaches each output's rack file exactly when the installed engine
 * runs it. Every flush used to decide from the layout it prepares (1.19)
 * rather than the engine installed, so the trailer was stripped from every
 * output's rack on an engine that runs it, and Footsteps and its Isolate did
 * nothing (2026-11-01). The answer is asked in the write's own turn: a flush
 * that waited on it before writing could land after a newer one.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { getDefaultState } from '../../../common/constants';
import { DSP_DEFAULTS, IDspSettings } from '../../../common/dsp/chain';
import { encodeChainSettings } from '../../../common/dsp/chainWire';
import { CHAIN_FOOTSTEPS_TAG } from '../../../common/dsp/footstepsWire';
import { flushPendingWrites, forgetPath } from '../../../main/asyncWriter';
import { readEngineHealth } from '../../../main/engineHealth';
import { flushOutputDsp } from '../../../main/outputDsp';

jest.mock('../../../main/engineHealth', () => ({
  readEngineHealth: jest.fn(async () => ({ outputs: [] })),
}));

const ENDPOINT = '{AAAAAAAA-1111-2222-3333-444455556666}';
const DSP_FILENAME = 'fluideq-dsp-aaaaaaaa-1111-2222-3333-444455556666.txt';
const DEVICE = 'device-a';

const rackWith = (
  footsteps: Partial<IDspSettings['footsteps']>,
): IDspSettings => ({
  ...DSP_DEFAULTS,
  enabled: true,
  footsteps: { ...DSP_DEFAULTS.footsteps, enabled: true, ...footsteps },
});

let configDir: string;

beforeEach(() => {
  jest.mocked(readEngineHealth).mockReset().mockResolvedValue({ outputs: [] });
  configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-output-dsp-'));
});

afterEach(async () => {
  await flushPendingWrites().catch(() => undefined);
  forgetPath(path.join(configDir, DSP_FILENAME));
  fs.rmSync(configDir, { recursive: true, force: true });
});

const flush = (
  rack: IDspSettings,
  engineVersion?: () => Promise<string | undefined>,
) =>
  flushOutputDsp({
    configDirPath: configDir,
    settings: { version: 1, assignments: {} },
    presetDirForDevice: () => configDir,
    activeOverride: {
      deviceId: DEVICE,
      devicePattern: ENDPOINT,
      state: getDefaultState(),
    },
    dspOverrides: new Map([[DEVICE, rack]]),
    engineVersion,
  });

/** The numbers the engine will read from the output's rack file. */
const written = async (): Promise<number[]> => {
  await flushPendingWrites();
  const [line] = fs
    .readFileSync(path.join(configDir, DSP_FILENAME), 'utf8')
    .split('\r\n')
    .filter((text) => text && !text.startsWith('#'));
  return line.split(' ').map(Number);
};

describe("Footsteps in an output's rack file", () => {
  it('is written, Isolate and all, for an engine that runs it', async () => {
    const rack = rackWith({ isolate: true, lift: 0.4, calm: 0.2 });
    await flush(rack, async () => '1.25.0.0');
    const values = await written();
    const at = values.indexOf(CHAIN_FOOTSTEPS_TAG);
    expect(at).toBeGreaterThan(0);
    expect(values.slice(at)).toEqual([
      CHAIN_FOOTSTEPS_TAG,
      1,
      4,
      1,
      1,
      0.4,
      0.2,
    ]);
    expect(values).toEqual(encodeChainSettings(rack));
  });

  const cannotRunIt: [
    string,
    (() => Promise<string | undefined>) | undefined,
  ][] = [
    ['an engine before 1.25', async () => '1.24.0.0'],
    ['no version known', async () => undefined],
    ['a failed read', async () => Promise.reject(new Error('no helper'))],
    ['nobody to ask', undefined],
  ];

  it.each(cannotRunIt)(
    'is left off, the rest of the rack kept, for %s',
    async (_case, engineVersion) => {
      const rack = rackWith({});
      await flush(rack, engineVersion);
      expect(await written()).toEqual(
        encodeChainSettings({
          ...rack,
          footsteps: { ...rack.footsteps, enabled: false },
        }),
      );
    },
  );

  it('never lets an earlier flush still asking overwrite a newer one', async () => {
    let answerEarlier: (version: string) => void = () => undefined;
    const earlierVersion = new Promise<string>((resolve) => {
      answerEarlier = resolve;
    });
    const earlier = flush(rackWith({ lift: 0.3 }), () => earlierVersion);
    const newer = flush(rackWith({ lift: 0.9 }), async () => '1.25.0.0');
    answerEarlier('1.25.0.0');
    await Promise.all([earlier, newer]);
    expect(await written()).toEqual(
      encodeChainSettings(rackWith({ lift: 0.9 })),
    );
  });
});
