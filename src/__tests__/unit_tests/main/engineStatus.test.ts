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

const isEqualizerAPOInstalledSpy = jest.fn().mockResolvedValue(false);
const noteFluidEngineRegisteredSpy = jest.fn();

jest.mock('main/registry', () => ({
  isEqualizerAPOInstalled: (...args: unknown[]) =>
    isEqualizerAPOInstalledSpy(...args),
  noteFluidEngineRegistered: (...args: unknown[]) =>
    noteFluidEngineRegisteredSpy(...args),
}));

/**
 * `readFluidEngineStatus` shells out to the real setup helper by default,
 * which would make this suite depend on whether a native build happens to
 * exist on the machine it runs on. `child_process` is mocked so the probe
 * always resolves the same way here, regardless.
 */
class FakeChildProcess extends EventEmitter {
  stdout = new EventEmitter();

  stderr = new EventEmitter();
}

let fakeChild: FakeChildProcess;

jest.mock('child_process', () => ({
  execFile: jest.fn(() => fakeChild),
}));

// Imports come after jest.mock on purpose: the module under test reads the
// mocked dependency at import time, so hoisting the import above the mock
// would bind it to the real one and the test would exercise nothing.
// eslint-disable-next-line import/first
import {
  isFluidEngineSupported,
  parseFluidEngineStatus,
  readAudioEngineStatus,
} from 'main/engineStatus';

beforeEach(() => {
  isEqualizerAPOInstalledSpy.mockClear();
  fakeChild = new FakeChildProcess();
});

describe('deciding whether this Windows build can run the FluidEQ Engine', () => {
  it('accepts the exact 1803 build the APO plumbing shipped in', () => {
    expect(isFluidEngineSupported('10.0.17134')).toBe(true);
  });

  it('rejects a Windows 10 build older than 1803', () => {
    expect(isFluidEngineSupported('10.0.16299')).toBe(false);
  });

  it('rejects a pre-Windows-10 kernel version', () => {
    expect(isFluidEngineSupported('6.1.7601')).toBe(false);
  });

  it('accepts a current Windows 10/11 build', () => {
    expect(isFluidEngineSupported('10.0.26200')).toBe(true);
  });

  it('accepts any major version above 10', () => {
    expect(isFluidEngineSupported('11.0.0')).toBe(true);
  });
});

describe('parsing the status document', () => {
  it('reads the documented shape', () => {
    const status = parseFluidEngineStatus(
      JSON.stringify({
        installed: true,
        dllPath: 'C:\\dll',
        dllVersion: '1.0.0.0',
        configDir: 'C:\\config',
        endpoints: [
          {
            guid: '{A}',
            name: 'Speakers',
            attached: true,
            backupExists: false,
          },
        ],
      }),
    );
    expect(status).toEqual({
      installed: true,
      dllPath: 'C:\\dll',
      dllVersion: '1.0.0.0',
      configDir: 'C:\\config',
      endpoints: [{ guid: '{A}', attached: true, backupExists: false }],
    });
  });

  it('reads an enumeration failure as not installed with no endpoints', () => {
    expect(parseFluidEngineStatus('{"error":"boom"}')).toEqual({
      installed: false,
      endpoints: [],
    });
  });

  it('reads non-JSON as not installed', () => {
    expect(parseFluidEngineStatus('not json')).toEqual({
      installed: false,
      endpoints: [],
    });
  });

  it('defaults endpoints to an empty list when the field is missing', () => {
    expect(parseFluidEngineStatus('{"installed":true}')).toEqual({
      installed: true,
      endpoints: [],
    });
  });

  it('defaults an endpoint missing backupExists to false rather than dropping it', () => {
    const status = parseFluidEngineStatus(
      JSON.stringify({
        installed: true,
        endpoints: [{ guid: '{A}', attached: true }],
      }),
    );
    expect(status.endpoints).toEqual([
      { guid: '{A}', attached: true, backupExists: false },
    ]);
  });
});

describe('reading the combined audio engine status', () => {
  const resolveChild = () => {
    fakeChild.stdout.emit('data', '{"installed":false,"endpoints":[]}');
    fakeChild.emit('close', 0);
  };

  /**
   * The probe used to be skipped under `'fluid'`, which reported Equalizer
   * APO as absent on machines that have it — and the switch back to Equalizer
   * APO reads that field to decide whether to run APO's installer, so it ran
   * every time and asked for a reboot.
   */
  it('probes Equalizer APO even when the engine is fluid', async () => {
    isEqualizerAPOInstalledSpy.mockResolvedValueOnce(true);

    const promise = readAudioEngineStatus('C:\\userData', 'fluid');
    resolveChild();
    const status = await promise;

    expect(isEqualizerAPOInstalledSpy).toHaveBeenCalledTimes(1);
    expect(status.engine).toBe('fluid');
    expect(status.apo).toEqual({ installed: true });
  });

  // The flush gate remembers the helper's `installed` answer, so a status
  // the helper produced has to reach it — and one it did not (the helper
  // missing, or talking past the cap) must not, or "could not ask" becomes
  // "not installed" for every flush that follows.
  it('hands the helper’s own installed answer to the flush gate, and nothing else', async () => {
    noteFluidEngineRegisteredSpy.mockClear();

    let promise = readAudioEngineStatus('C:\\userData', 'fluid');
    fakeChild.stdout.emit('data', '{"installed":true,"endpoints":[]}');
    fakeChild.emit('close', 0);
    await promise;
    expect(noteFluidEngineRegisteredSpy).toHaveBeenCalledWith(true);

    fakeChild = new FakeChildProcess();
    promise = readAudioEngineStatus('C:\\userData', 'fluid');
    resolveChild();
    await promise;
    expect(noteFluidEngineRegisteredSpy).toHaveBeenLastCalledWith(false);

    noteFluidEngineRegisteredSpy.mockClear();
    fakeChild = new FakeChildProcess();
    promise = readAudioEngineStatus('C:\\userData', 'fluid');
    fakeChild.emit('error', new Error('helper missing'));
    await promise;
    expect(noteFluidEngineRegisteredSpy).not.toHaveBeenCalled();
  });

  it('folds a failed probe under fluid to not installed', async () => {
    isEqualizerAPOInstalledSpy.mockRejectedValueOnce(
      new Error('registry read failed'),
    );

    const promise = readAudioEngineStatus('C:\\userData', 'fluid');
    resolveChild();

    await expect(promise).resolves.toEqual(
      expect.objectContaining({ apo: { installed: false } }),
    );
  });

  it('probes Equalizer APO when the engine is apo', async () => {
    const promise = readAudioEngineStatus('C:\\userData', 'apo');
    resolveChild();
    await promise;

    expect(isEqualizerAPOInstalledSpy).toHaveBeenCalledTimes(1);
  });

  it('probes Equalizer APO when no engine has been chosen yet', async () => {
    const promise = readAudioEngineStatus('C:\\userData', null);
    resolveChild();
    await promise;

    expect(isEqualizerAPOInstalledSpy).toHaveBeenCalledTimes(1);
  });

  it('resolves apo.installed:false instead of rejecting when the registry probe fails', async () => {
    isEqualizerAPOInstalledSpy.mockRejectedValueOnce(
      new Error('registry read failed'),
    );

    const promise = readAudioEngineStatus('C:\\userData', 'apo');
    resolveChild();

    await expect(promise).resolves.toEqual(
      expect.objectContaining({ apo: { installed: false } }),
    );
  });
});
