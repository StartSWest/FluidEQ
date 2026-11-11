/** @jest-environment node */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A scene that did not play is one line in main's log, and every one of
 * those lines reaches Help → Report a problem (Ivan, 2026-11-11: "make sure
 * we log scene failures so users can send logs to us"). The lines carry ids
 * and versions only; what a window sends is read before it is written, so a
 * page cannot put anything else in the log under that mark.
 */

import {
  buildBugReport,
  MAX_REPORT_LOG_LINES,
  takeLogSince,
  takeMarkedSince,
} from '../../../common/bugReport';
import {
  SCENE_FAILURE_CHANNEL,
  SCENE_FAILURE_MARK,
  readSceneFailureEntry,
  sceneFailureLine,
  type ISceneFailureEntry,
} from '../../../common/sceneFailureLog';
import onWindowMessage from '../../../main/ipc/windowMessages';
import {
  logSceneFailure,
  registerSceneFailureIpc,
  resetSceneFailuresForTesting,
} from '../../../main/sceneFailures';

const mockWarn = jest.fn();
jest.mock('electron-log', () => ({
  __esModule: true,
  default: { warn: (line: string) => mockWarn(line) },
}));
jest.mock('main/ipc/windowMessages', () => ({
  __esModule: true,
  default: jest.fn(() => () => undefined),
}));

const LOOK = 'member:4f1c2b9e-8d3a-4e7b-9c11-2a6f0d5e7b30:glacier';
const COMPILE: ISceneFailureEntry = {
  lookId: LOOK,
  version: '3',
  surface: 'graph',
  reason: 'compile',
  detail: "ERROR: 0:3: 'uPalette_colours' : undeclared identifier",
};

beforeEach(() => {
  mockWarn.mockClear();
  resetSceneFailuresForTesting();
});

describe('one line for a scene that did not play', () => {
  it('names the look, version, surface and reason, then the driver’s words', () => {
    expect(sceneFailureLine(COMPILE)).toBe(
      `Scene failure: ${LOOK} v3 on graph: compile. ERROR: 0:3: 'uPalette_colours' : undeclared identifier`,
    );
    expect(
      sceneFailureLine({
        lookId: 'premium:alpine',
        surface: 'lamps',
        reason: 'gpu-reset',
      }),
    ).toBe('Scene failure: premium:alpine on lamps: gpu-reset.');
  });

  it('keeps a multi-line driver log on one line, and a long one short', () => {
    const line = sceneFailureLine({
      ...COMPILE,
      detail: `ERROR: one\r\nERROR: two\t${'x'.repeat(1000)}`,
    });
    expect(line.split('\n')).toHaveLength(1);
    expect(line).toContain('ERROR: one ERROR: two x');
    expect(line.endsWith('…')).toBe(true);
    expect(line.length).toBeLessThan(500);
  });

  it('is written once per scene, version, surface and reason in a session', () => {
    logSceneFailure(COMPILE);
    logSceneFailure(COMPILE);
    expect(mockWarn).toHaveBeenCalledTimes(1);
    // Each of these is a different fact, and each is its own line.
    logSceneFailure({ ...COMPILE, version: '4' });
    logSceneFailure({ ...COMPILE, surface: 'desktop' });
    logSceneFailure({ ...COMPILE, reason: 'stood-in', detail: 'version 2' });
    expect(mockWarn).toHaveBeenCalledTimes(4);
  });
});

describe('what a window sends to be written', () => {
  it('is read as a line, or dropped', () => {
    expect(readSceneFailureEntry(COMPILE)).toEqual(COMPILE);
    expect(
      readSceneFailureEntry({ ...COMPILE, reason: 'oops' }),
    ).toBeUndefined();
    expect(
      readSceneFailureEntry({ ...COMPILE, surface: 'mars' }),
    ).toBeUndefined();
    expect(
      readSceneFailureEntry({ ...COMPILE, lookId: 'C:\\Users\\ivan\\scene' }),
    ).toBeUndefined();
    expect(
      readSceneFailureEntry({ ...COMPILE, version: 'v 3\nScene failure: x' }),
    ).toBeUndefined();
    expect(readSceneFailureEntry('compile')).toBeUndefined();
  });

  it('is written from the window’s channel, and nothing else is', () => {
    registerSceneFailureIpc();
    const [channel, listener] = jest.mocked(onWindowMessage).mock.calls[0] as [
      string,
      (event: unknown, raw: unknown) => void,
    ];
    expect(channel).toBe(SCENE_FAILURE_CHANNEL);
    listener({}, { ...COMPILE, reason: 'nope' });
    expect(mockWarn).not.toHaveBeenCalled();
    listener({}, COMPILE);
    expect(mockWarn).toHaveBeenCalledWith(sceneFailureLine(COMPILE));
  });
});

describe('the report', () => {
  const at = (hour: number, minute: number) =>
    `[2026-11-11 ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00.000]`;
  const sceneLine = `${at(9, 0)} [warn]  ${sceneFailureLine(COMPILE)}`;
  // A scene failing at nine, then an hour of a chatty host after it.
  const noise = Array.from(
    { length: MAX_REPORT_LOG_LINES + 500 },
    (_, index) =>
      `${at(10, index % 60)} [info]  host: block ${index} handed to the device`,
  );
  const log = [
    `${at(7, 0)} [warn]  ${sceneFailureLine({ ...COMPILE, version: '1' })}`,
    sceneLine,
    ...noise,
  ].join('\n');
  const since = new Date('2026-11-11T08:00:00.000').toISOString();

  it('keeps every scene line however much noise came after it', () => {
    // The control: the app log's own window loses it to the noise.
    expect(takeLogSince(log, since)).not.toContain(SCENE_FAILURE_MARK);
    const kept = takeMarkedSince(log, since, SCENE_FAILURE_MARK);
    expect(kept).toBe(sceneLine);
  });

  it('starts where the last report’s logs ended', () => {
    expect(takeMarkedSince(log, undefined, SCENE_FAILURE_MARK)).toContain(
      ' v1 ',
    );
    expect(takeMarkedSince(log, since, SCENE_FAILURE_MARK)).not.toContain(
      ' v1 ',
    );
  });

  it('carries them in a section of their own', () => {
    const report = buildBugReport({
      appVersion: '2.4.1',
      platform: 'Windows 11 10.0.26200',
      arch: 'x64',
      electron: '43.2.0',
      audioEngine: 'fluid',
      isEqualizerApoInstalled: false,
      fluidEngineInstalled: true,
      description: 'My scene shows the bars.',
      appLog: noise.slice(-3).join('\n'),
      installLog: '',
      engineReport: '',
      engineLog: '',
      helperLog: '',
      sceneFailures: takeMarkedSince(log, since, SCENE_FAILURE_MARK),
      gatheredAt: '2026-11-11T12:00:00.000Z',
    });
    expect(report).toContain('### Scene failures');
    expect(report).toContain(sceneFailureLine(COMPILE));
    // The control: no section for a report with no scene line in it.
    expect(
      buildBugReport({
        appVersion: '2.4.1',
        platform: 'Windows 11 10.0.26200',
        arch: 'x64',
        electron: '43.2.0',
        audioEngine: 'fluid',
        isEqualizerApoInstalled: false,
        fluidEngineInstalled: true,
        description: '',
        appLog: '',
        installLog: '',
        engineReport: '',
        engineLog: '',
        helperLog: '',
        sceneFailures: '',
        gatheredAt: '2026-11-11T12:00:00.000Z',
      }),
    ).not.toContain('### Scene failures');
  });
});
