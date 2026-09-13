/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

// Windows keyboard MakeCode/KEY_E0 -> Razer's logical RZKEY positions.
// These are key identities, not positions in a device's spatial LED matrix.
// https://assets.razerzone.com/dev_portal/C%2B%2B/en/_rz_chroma_s_d_k_types_8h_source.html
const STANDARD: Readonly<Record<number, number>> = {
  1: 0x0001,
  14: 0x010e,
  15: 0x0201,
  28: 0x030e,
  29: 0x0501,
  41: 0x0101,
  42: 0x0401,
  43: 0x020e,
  54: 0x040e,
  55: 0x0114,
  56: 0x0503,
  57: 0x0507,
  58: 0x0301,
  69: 0x0112,
  70: 0x0010,
  71: 0x0212,
  72: 0x0213,
  73: 0x0214,
  74: 0x0115,
  75: 0x0312,
  76: 0x0313,
  77: 0x0314,
  78: 0x0215,
  79: 0x0412,
  80: 0x0413,
  81: 0x0414,
  82: 0x0513,
  83: 0x0514,
  84: 0x000f,
  86: 0x0402,
  87: 0x000d,
  88: 0x000e,
};
const EXTENDED: Readonly<Record<number, number>> = {
  28: 0x0415,
  29: 0x050e,
  53: 0x0113,
  55: 0x000f,
  56: 0x050b,
  71: 0x0110,
  72: 0x0410,
  73: 0x0111,
  75: 0x050f,
  77: 0x0511,
  79: 0x0210,
  80: 0x0510,
  81: 0x0211,
  82: 0x010f,
  83: 0x020f,
  91: 0x0502,
  93: 0x050d,
};
const RANGES = [
  [2, 13, 0x0102], // Number row, minus and equals.
  [16, 27, 0x0202], // Q through right bracket.
  [30, 40, 0x0302], // A through apostrophe.
  [44, 53, 0x0403], // Z through slash.
  [59, 68, 0x0003], // F1 through F10.
] as const;

export const chromaKeyIndex = (
  scan: number,
  flags: number,
  row?: number,
): number | undefined => {
  let key: number | undefined;
  if (flags === 0) {
    const range = RANGES.find(([first, last]) => scan >= first && scan <= last);
    key = range ? range[2] + scan - range[0] : STANDARD[scan];
    if (scan === 43 && row === 3) {
      key = 0x030d; // ISO key beside Enter, rather than ANSI backslash.
    }
  } else if (flags === 2) {
    key = EXTENDED[scan];
  } else if (flags === 4 && scan === 29) {
    key = 0x0011; // Pause.
  }
  return key === undefined
    ? undefined
    : Math.floor(key / 256) * 22 + (key % 256);
};
