/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import type { Dictionary } from '../en';

const dspOff = {
  'dspOff.switchedOff': 'FluidEQ가 꺼져 있으므로 DSP도 꺼집니다.',
  'dspOff.engineOff':
    'FluidEQ 엔진은 이 출력에서 실행되지 않으므로 DSP도 꺼집니다.',
  'dspOff.turnOn': 'FluidEQ 켜기',
} satisfies Partial<Dictionary>;

export default dspOff;
