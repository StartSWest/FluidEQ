/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/
import type { IHostAnalysis } from './analysisWire';

export const ENGINE_ANALYSIS_CHANNEL = 'dsp-engine-analysis';
export interface IEngineAnalysis {
  sampleRate: number;
  frame: IHostAnalysis;
}
