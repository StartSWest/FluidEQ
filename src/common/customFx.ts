/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.
*/

import { parseEqText } from './apoText';
import { FILTER_LINE_PREFIX_REGEX, ICustomFxSettings } from './constants';

/**
 * Read the useful description of a user-owned custom APO file.
 *
 * The file may contain commands FluidEQ cannot draw (Plugin, Copy, Delay,
 * and so on). Those still make it an applied effect, while Filter/GraphicEQ
 * commands are carried separately so the response graph can show their curve.
 * Comments and blank lines are ignored; the file is left byte-for-byte alone.
 */
export const parseCustomFx = (
  fileName: string,
  contents: string,
): ICustomFxSettings | undefined => {
  const hasCommand = contents.split(/\r?\n/).some((rawLine) => {
    const line = rawLine.split('#')[0].trim();
    return line.length > 0;
  });
  if (!hasCommand) {
    return undefined;
  }

  const parsed = parseEqText(contents);
  // parseEqText creates editable peak-band projections for a GraphicEQ-only
  // file. Those projections are useful to the editor, but they are not extra
  // APO stages in this user-owned file. Keep real Filter commands when a file
  // intentionally contains both forms so auto-normalize protects both.
  const hasFilterCommand = contents.split(/\r?\n/).some((rawLine) => {
    const line = rawLine.split('#')[0].trim();
    return FILTER_LINE_PREFIX_REGEX.test(line);
  });
  const filters =
    parsed.graphicEq?.length && !hasFilterCommand ? {} : parsed.filters;
  return {
    fileName,
    preAmp: parsed.preAmp,
    filters,
    ...(parsed.graphicEq?.length ? { graphicEq: parsed.graphicEq } : {}),
  };
};

/** Whether the parsed custom file has a curve the response graph can draw. */
export const hasCustomFxCurve = (
  customFx: ICustomFxSettings | undefined,
): boolean =>
  Boolean(
    customFx &&
    (Math.abs(customFx.preAmp) > 0.001 ||
      Object.keys(customFx.filters).length > 0 ||
      (customFx.graphicEq?.length ?? 0) > 0),
  );
