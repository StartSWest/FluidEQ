/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { EventEmitter } from 'events';

/**
 * `execFile` is mocked rather than spawning for real, for two reasons: a
 * genuinely missing exe is one code path (the `error` event), but the
 * stdout-cap test below needs a child that can emit more than 1 MiB of
 * output on demand — not reproducible hermetically through a real spawn —
 * and `execFile`'s exported binding is non-configurable at runtime, so
 * `jest.spyOn` on the real module cannot override it per test. One fake
 * child, driven by hand, covers both.
 */
class FakeChildProcess extends EventEmitter {
  stdout = new EventEmitter();

  stderr = new EventEmitter();
}

let fakeChild: FakeChildProcess;

jest.mock('child_process', () => ({
  execFile: jest.fn(() => fakeChild),
}));

// eslint-disable-next-line import/first
import { parseEngineSetupOutput, runEngineSetup } from 'main/engineSetup';

beforeEach(() => {
  fakeChild = new FakeChildProcess();
});

describe('parsing the setup helper output', () => {
  it('reads a successful command, defaulting backupExists false', () => {
    const result = parseEngineSetupOutput(
      '{"command":"install","ok":true,"error":"","endpoints":[{"guid":"{A}","attached":true}]}',
      0,
    );
    expect(result.ok).toBe(true);
    expect(result.declined).toBe(false);
    expect(result.endpoints).toEqual([
      { guid: '{A}', attached: true, backupExists: false },
    ]);
  });

  it('reports a declined elevation prompt even with empty stdout', () => {
    const result = parseEngineSetupOutput('', 2);
    expect(result.declined).toBe(true);
    expect(result.ok).toBe(false);
  });

  it('reports failure with a readable error for garbage stdout', () => {
    const result = parseEngineSetupOutput('not json at all', 3);
    expect(result.ok).toBe(false);
    expect(result.declined).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('respects an explicit ok:false even on exit code 0', () => {
    const result = parseEngineSetupOutput('{"ok":false,"error":"x"}', 0);
    expect(result.ok).toBe(false);
    expect(result.error).toBe('x');
    expect(result.endpoints).toEqual([]);
  });

  it('defaults endpoints to an empty list when the field is missing', () => {
    const result = parseEngineSetupOutput('{"ok":true}', 0);
    expect(result.endpoints).toEqual([]);
  });
});

describe('running the setup helper', () => {
  it('resolves ok:false with the spawn error instead of throwing on a missing exe', async () => {
    const promise = runEngineSetup(
      'install',
      [],
      'C:\\fluideq-engine-setup-does-not-exist.exe',
    );
    const spawnError = Object.assign(new Error('spawn ENOENT'), {
      code: 'ENOENT',
    });
    fakeChild.emit('error', spawnError);

    const result = await promise;

    expect(result.ok).toBe(false);
    expect(result.declined).toBe(false);
    expect(result.error).toBeTruthy();
    expect(result.endpoints).toEqual([]);
  });

  /**
   * `execFile`'s own `maxBuffer` is a no-op without a callback (see the
   * comment above `runEngineSetup`), so the cap is hand-rolled — this
   * exercises that accumulate-and-compare logic directly, not the OS pipe
   * underneath it.
   */
  it('treats stdout past 1 MiB as unreadable instead of growing without bound', async () => {
    const promise = runEngineSetup('install', [], 'C:\\fake-setup.exe');
    // One chunk past the 1 MiB cap — real stdout would arrive in many
    // smaller chunks, but a single oversized one exercises the same
    // accumulate-and-compare path.
    fakeChild.stdout.emit('data', 'a'.repeat(1024 * 1024 + 1));
    fakeChild.emit('close', 0);

    const result = await promise;

    expect(result.ok).toBe(false);
    expect(result.declined).toBe(false);
    expect(result.error).toBeTruthy();
    expect(result.endpoints).toEqual([]);
  });
});
