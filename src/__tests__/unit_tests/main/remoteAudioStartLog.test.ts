/** @jest-environment node */
/* FluidEQ — GPL-3.0-or-later */

/**
 * What a Share Audio start that did not finish writes: one line, saying
 * what failed, why and what happens next, and a stack only for a bug (Ivan,
 * 2026-11-13: "we need to log them and make sure they record nicely").
 */

import log from 'electron-log';
import { AudioWorkerStopped } from '../../../main/shareAudio/host';
import {
  START_CANCELLED_LINE,
  logStartOutcome,
} from '../../../main/remoteAudioStartLog';

const NEXT =
  'It starts again when the network comes back, when this computer wakes, or when the Share Audio page is opened again.';

let info: jest.SpyInstance;
let warn: jest.SpyInstance;
let error: jest.SpyInstance;
beforeEach(() => {
  info = jest.spyOn(log, 'info').mockImplementation(() => undefined);
  warn = jest.spyOn(log, 'warn').mockImplementation(() => undefined);
  error = jest.spyOn(log, 'error').mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

it('writes one quiet line for a start the quit or a restart cut short', () => {
  expect(logStartOutcome(new AudioWorkerStopped(true))).toBe('cancelled');
  expect(info.mock.calls).toEqual([
    ['Share Audio: local link start cancelled, FluidEQ closing or restarting'],
  ]);
  expect(START_CANCELLED_LINE).toBe(info.mock.calls[0][0]);
  expect(warn).not.toHaveBeenCalled();
  expect(error).not.toHaveBeenCalled();
});

it('names the system’s refusal in one warning, with no stack', () => {
  const refused = Object.assign(
    new Error(`operation failed lan.start ${'s'.repeat(43)}`),
    { code: 'EADDRINUSE', syscall: 'listen' },
  );
  expect(logStartOutcome(refused)).toBe('failed');
  expect(warn.mock.calls).toEqual([
    [
      `Share Audio: the local link could not start: the system refused it (EADDRINUSE on listen). ${NEXT}`,
    ],
  ]);
  // The message is never written: a pairing parse can carry a secret.
  expect(JSON.stringify(warn.mock.calls)).not.toContain('s'.repeat(43));
  expect(error).not.toHaveBeenCalled();
  expect(info).not.toHaveBeenCalled();
});

it('calls a Share Audio service that died a bug, with the error after it', () => {
  const died = new AudioWorkerStopped(false);
  expect(logStartOutcome(died)).toBe('failed');
  expect(error.mock.calls).toEqual([
    [
      `Share Audio: the local link could not start: the Share Audio service stopped while it was starting (a bug). ${NEXT}`,
      died,
    ],
  ]);
  expect(warn).not.toHaveBeenCalled();
});

it('calls anything else a bug, with the error and its stack after it', () => {
  const surprise = new TypeError('x is not a function');
  expect(logStartOutcome(surprise)).toBe('failed');
  expect(error.mock.calls).toEqual([
    [
      `Share Audio: the local link could not start: an unexpected error (a bug). ${NEXT}`,
      surprise,
    ],
  ]);
  // A code that is not a system's word is not trusted as one.
  error.mockClear();
  logStartOutcome(Object.assign(new Error('odd'), { code: 'not a code' }));
  expect(error).toHaveBeenCalledTimes(1);
  expect(warn).not.toHaveBeenCalled();
});
