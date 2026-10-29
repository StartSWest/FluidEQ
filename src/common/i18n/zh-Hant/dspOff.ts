/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import type { Dictionary } from '../en';

const dspOff = {
  'dspOff.switchedOff': 'FluidEQ 已關閉，因此 DSP 也已關閉。',
  'dspOff.engineOff': 'FluidEQ 引擎未在此輸出上執行，因此 DSP 也關閉。',
  'dspOff.turnOn': '開啟 FluidEQ',
} satisfies Partial<Dictionary>;

export default dspOff;
