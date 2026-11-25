/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The driver's error line in its parts (`splitDriverError`), which the white
 * window draws each in its own ink: the severity, where, the name it tripped
 * on and what is wrong. Only the shader translator's own shape is split;
 * anything else stays one line rather than being guessed at.
 */

import { splitDriverError } from 'renderer/studio/driverErrorLine';

const joined = (line: string) => {
  const parts = splitDriverError(line);
  return (
    parts &&
    [
      parts.severity,
      parts.afterSeverity,
      parts.location,
      parts.afterLocation,
      parts.name,
      parts.message,
    ].join('')
  );
};

describe('the translator’s line', () => {
  it('splits into the severity, where, the name and what is wrong', () => {
    expect(
      splitDriverError("ERROR: 0:42: 'uTim' : undeclared identifier"),
    ).toEqual({
      severity: 'ERROR:',
      afterSeverity: ' ',
      location: '0:42:',
      afterLocation: ' ',
      name: "'uTim'",
      message: ' : undeclared identifier',
    });
  });

  it('splits a warning the same way', () => {
    expect(
      splitDriverError("WARNING: 0:7: 'f' : unused variable")?.severity,
    ).toBe('WARNING:');
  });

  it('splits a line whose name is empty, as a syntax error at the end is', () => {
    expect(splitDriverError("ERROR: 0:118: '' : syntax error")?.name).toBe(
      "''",
    );
  });

  it.each([
    "ERROR: 0:42: 'uTim' : undeclared identifier",
    "ERROR:  0:3:   'vec5' : no matching overloaded function found",
    "WARNING: 12:300: 'x' :",
  ])('puts back together as exactly the line it was: %s', (line) => {
    expect(joined(line)).toBe(line);
  });
});

describe('anything else', () => {
  it.each([
    "0:42(5): error: `uTim' undeclared",
    'Shader link failed.',
    'ERROR: 0:42:',
    'ERROR: 0:42: undeclared identifier with no name quoted',
    "ERROR: 0:42 'uTim' : missing the location's colon",
    "error: 0:42: 'uTim' : lower case is another driver's",
    '',
  ])('stays one line: %s', (line) => {
    expect(splitDriverError(line)).toBeUndefined();
  });
});
