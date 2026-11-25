/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The graphics driver's error line in its parts, as Chromium's shader
 * translator writes it: `ERROR: 0:42: 'uTim' : undeclared identifier` - the
 * severity, the source and line, the name it tripped on, and what is wrong.
 * The white window draws each in its own ink so the line number and the name
 * can be read at a glance (Ivan's pick, 2026-11-25); the dark window keeps the
 * one colour it always had.
 *
 * Every gap is kept, so the parts put back together are the line exactly.
 */
export interface IDriverErrorParts {
  severity: string;
  afterSeverity: string;
  location: string;
  afterLocation: string;
  name: string;
  message: string;
}

/**
 * Only the translator's own shape. Anything else - another driver's wording,
 * a link error, a line cut short - is not guessed at and stays one line.
 */
const TRANSLATOR_LINE = /^(ERROR:|WARNING:)(\s+)(\d+:\d+:)(\s+)('[^']*')(.*)$/;

export const splitDriverError = (
  line: string,
): IDriverErrorParts | undefined => {
  const match = TRANSLATOR_LINE.exec(line);
  if (!match) {
    return undefined;
  }
  const [, severity, afterSeverity, location, afterLocation, name, message] =
    match;
  return { severity, afterSeverity, location, afterLocation, name, message };
};
