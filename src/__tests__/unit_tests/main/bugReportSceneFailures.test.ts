/** @jest-environment node */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Help → Report a problem gathers every scene line since the last report from
 * both halves of the app log, however much else was written after it — the
 * app log's own section keeps only its newest lines (Ivan, 2026-11-11: "make
 * sure we log scene failures so users can send logs to us").
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { MAX_REPORT_LOG_LINES } from '../../../common/bugReport';
import { sceneFailureLine } from '../../../common/sceneFailureLog';

const mockUserData = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-report-'));

jest.mock('electron', () => ({
  app: { getPath: () => mockUserData },
}));
jest.mock('electron-log', () => ({
  __esModule: true,
  default: { warn: jest.fn() },
}));
jest.mock('../../../main/appVersion', () => ({ appVersion: () => '2.4.1' }));
jest.mock('../../../main/registry', () => ({
  getFluidEngineConfigDir: () => path.join(mockUserData, 'engine', 'config'),
  isEngineInstalled: () => Promise.resolve(false),
  isEqualizerAPOInstalled: () => Promise.resolve(false),
}));
jest.mock('../../../main/audioDevices', () => ({
  discoverAudioDevices: () => Promise.resolve([]),
}));
jest.mock('../../../main/engineStatus', () => ({
  readFluidEngineStatus: () => Promise.resolve(undefined),
}));
jest.mock('../../../main/engineHealth', () => ({
  readEngineHealth: () => Promise.resolve(undefined),
}));

// eslint-disable-next-line import/first -- the mocks above are installed first
import gatherBugReportFacts from '../../../main/bugReportFacts';

const line = sceneFailureLine({
  lookId: 'premium:alpine',
  version: '7',
  surface: 'desktop',
  reason: 'gpu-reset',
});

beforeAll(() => {
  const logs = path.join(mockUserData, 'logs');
  fs.mkdirSync(logs, { recursive: true });
  // The scene failed early in the rotated half; the current half is all
  // noise, more than the app log's section keeps.
  fs.writeFileSync(
    path.join(logs, 'main.old.log'),
    `[2026-11-11 09:00:00.000] [warn]  ${line}\n`,
  );
  fs.writeFileSync(
    path.join(logs, 'main.log'),
    Array.from(
      { length: MAX_REPORT_LOG_LINES + 100 },
      (_, index) => `[2026-11-11 10:00:00.000] [info]  host: block ${index}`,
    ).join('\n'),
  );
});

afterAll(() => {
  fs.rmSync(mockUserData, { recursive: true, force: true });
});

it('carries a scene line the app log’s own section has lost to noise', async () => {
  const facts = await gatherBugReportFacts('fluid', mockUserData);
  // The control: the app log section is full of the noise and lost it.
  expect(facts.appLog).not.toContain(line);
  expect(facts.sceneFailures).toContain(line);
});
