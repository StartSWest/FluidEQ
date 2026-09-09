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

import path from 'path';
import os from 'os';
import { parseEngineSetupOutput, runEngineSetup } from 'main/engineSetup';

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
    const missingExe = path.join(
      os.tmpdir(),
      'fluideq-engine-setup-does-not-exist.exe',
    );

    const result = await runEngineSetup('install', [], missingExe);

    expect(result.ok).toBe(false);
    expect(result.declined).toBe(false);
    expect(result.error).toBeTruthy();
    expect(result.endpoints).toEqual([]);
  });
});
