/** @jest-environment node */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Main's words to FluidEQ-Tray and the tray's back, held to what
 * `tray_model.cpp` and `tray_host.cpp` read and write.
 */

import {
  readTrayHostLine,
  recipeLine,
  stateLine,
  trayHostKey,
  trayHostPipe,
} from '../../../main/nativeTray/trayHostWire';

describe("FluidEQ-Tray's wire", () => {
  it("reads the tray's hello and its presses", () => {
    expect(
      readTrayHostLine('{"type":"hello","pid":4321,"ownerPipe":true}'),
    ).toEqual({ type: 'hello', pid: 4321, ownerPipe: true });
    expect(
      readTrayHostLine('{"type":"pressed","id":"recover-window"}'),
    ).toEqual({ type: 'pressed', id: 'recover-window' });
  });

  it('reads nothing it was not sent on purpose', () => {
    [
      'not json',
      'null',
      '[1]',
      '{"type":"hello","pid":1.5,"ownerPipe":true}',
      '{"type":"hello","pid":7}',
      '{"type":"pressed","id":"format-disk"}',
      '{"type":"pressed"}',
      '{"type":"leaving"}',
    ].forEach((line) => expect(readTrayHostLine(line)).toBeUndefined());
  });

  it('writes one line a message, as the tray splits them', () => {
    const state = stateLine({
      tooltip: 'FluidEQ — still running',
      icon: 'C:\\app\\icon.ico',
      menu: [{ id: 'open', label: 'Open FluidEQ', separatorAfter: true }],
    });
    expect(state.endsWith('\n')).toBe(true);
    expect(state.indexOf('\n')).toBe(state.length - 1);
    expect(JSON.parse(state)).toEqual({
      type: 'state',
      tooltip: 'FluidEQ — still running',
      icon: 'C:\\app\\icon.ico',
      menu: [{ id: 'open', label: 'Open FluidEQ', separatorAfter: true }],
    });
  });

  it('sends the recipe on its own, and says so when there is none', () => {
    const recipe = {
      configDir: 'C:\\ProgramData\\FluidEQ\\engine\\config',
      rootName: 'fluideq.txt',
      rootText: '# off\r\n',
      removeNames: ['fluideq-dsp.txt'],
      removePrefixes: ['fluideq-dsp-'],
    };
    expect(JSON.parse(recipeLine(recipe))).toEqual({ type: 'recipe', recipe });
    expect(JSON.parse(recipeLine(undefined))).toEqual({ type: 'recipe' });
  });

  it('names one tray per data folder, in letters and digits', () => {
    const installed = trayHostKey(
      'C:\\Users\\me\\AppData\\Roaming\\fluideq-app',
    );
    expect(installed).toMatch(/^[0-9a-f]{32}$/);
    // Windows paths are one path whatever their case.
    expect(trayHostKey('C:\\USERS\\ME\\AppData\\Roaming\\FLUIDEQ-APP')).toBe(
      installed,
    );
    expect(trayHostKey('C:\\Users\\me\\AppData\\Roaming\\FluidEQ')).not.toBe(
      installed,
    );
    expect(trayHostPipe(installed)).toBe(
      `\\\\.\\pipe\\FluidEQ-Tray-${installed}`,
    );
  });
});
