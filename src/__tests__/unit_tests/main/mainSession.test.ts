/** @jest-environment node */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The engine's folder is set from half a dozen places; FluidEQ-Tray has to
 * hear every change of it, or a crash undoes the EQ in a folder the app has
 * already left (`nativeTray/`).
 */

import createMainSession from '../../../main/mainSession';

describe("the session's engine folder", () => {
  it('reports each change once, and not a value it already holds', () => {
    const heard = jest.fn();
    const session = createMainSession(heard);
    expect(session.configPath).toBe('');

    session.configPath = 'C:\\ProgramData\\FluidEQ\\engine\\config';
    session.configPath = 'C:\\ProgramData\\FluidEQ\\engine\\config';
    session.configPath = '';

    expect(heard.mock.calls).toEqual([
      ['C:\\ProgramData\\FluidEQ\\engine\\config'],
      [''],
    ]);
    expect(session.configPath).toBe('');
  });

  it('works with nobody listening', () => {
    const session = createMainSession();
    session.configPath = 'C:\\cfg';
    expect(session.configPath).toBe('C:\\cfg');
  });
});
