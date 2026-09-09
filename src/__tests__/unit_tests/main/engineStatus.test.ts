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

jest.mock('main/registry', () => ({
  isEqualizerAPOInstalled: (...args: unknown[]) =>
    isEqualizerAPOInstalledSpy(...args),
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
});

describe('reading the combined audio engine status', () => {
  const resolveChild = () => {
    fakeChild.stdout.emit('data', '{"installed":false,"endpoints":[]}');
    fakeChild.emit('close', 0);
  };

  it('never probes Equalizer APO when the engine is fluid', async () => {
    const promise = readAudioEngineStatus('C:\\userData', 'fluid');
    resolveChild();
    const status = await promise;

    expect(isEqualizerAPOInstalledSpy).not.toHaveBeenCalled();
    expect(status.engine).toBe('fluid');
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
});
