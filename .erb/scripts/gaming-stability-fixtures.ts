/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { writeFileSync } from 'fs';
import path from 'path';
import {
  appendPresetTone,
  encodeChainSettings,
} from '../../src/common/dsp/chainWire';
import { DSP_PRESETS, IDspPreset } from '../../src/common/dsp/presets';
import { FOOTSTEPS_PRESET_BY_ID } from '../../src/common/dsp/footstepsPresets';
import { pickGame } from '../../src/common/dsp/gameRoom';
import {
  gameCurveForProfile,
  gameCurveSettings,
} from '../../src/common/dsp/gameCurves';
import { readyGamingChain } from '../../src/common/gaming';
import { presetToneOf } from '../../src/common/dsp/presetTone';
import { dspPresetVoicing } from '../../src/common/dsp/presetVoicing';

const lines: string[] = [];
const presets: IDspPreset[] = DSP_PRESETS.filter(
  (preset) => preset.group === 'gaming',
);
// The ready-made titles replace the chain's curve and Game settings, just
// as gameSeedFor does. No Room is assumed for an original stereo mix.
(['cs2', 'cod', 'tarkov', 'wow', 'alien', 'valorant'] as const).forEach(
  (id) => {
    const game = FOOTSTEPS_PRESET_BY_ID[id];
    const chain = DSP_PRESETS.find(
      (preset) => preset.id === readyGamingChain(game),
    );
    if (!chain) throw new Error(`No chain for ${id}`);
    const curve = gameCurveForProfile(game);
    presets.push({
      ...chain,
      id: `title-${id}`,
      settings: { ...chain.settings, ...pickGame(chain.settings, game, true) },
      curve: curve ? gameCurveSettings(curve) : undefined,
    });
  },
);
presets.forEach((preset) => {
  const tone = preset.curve
    ? presetToneOf(
        {
          isEnabled: true,
          voicing: dspPresetVoicing(preset.id, preset.curve),
          bypassed: [],
          eqMode: 'normal',
          curveEqMode: 'normal',
          isEqDoubleOn: false,
          eqBandQ: undefined,
          curveBandQ: undefined,
        },
        { eq: true, curves: true },
      )
    : undefined;
  const variants = {
    full: preset.settings,
    noDynamics: {
      ...preset.settings,
      dynamics: { ...preset.settings.dynamics, enabled: false },
    },
    liftOnly: {
      ...preset.settings,
      footsteps: {
        ...preset.settings.footsteps,
        calm: 0,
        environment: 0,
        voices: 0,
        duck: false,
      },
      dynamics: { ...preset.settings.dynamics, enabled: false },
      bassForge: { ...preset.settings.bassForge, enabled: false },
      bassPunch: { ...preset.settings.bassPunch, enabled: false },
      dimension: { ...preset.settings.dimension, enabled: false },
      maximizer: { ...preset.settings.maximizer, driveDb: 0 },
    },
  };
  Object.entries(variants).forEach(([variant, settings]) => {
    if (variant !== 'full' && !process.argv.includes('--diagnose')) return;
    const wire = appendPresetTone(encodeChainSettings(settings), tone);
    lines.push(`${preset.id}-${variant} ${wire.length} ${wire.join(' ')}`);
  });
});
writeFileSync(
  process.argv[2] ??
    path.join(__dirname, '../../native/.build/gaming-stability-fixtures.txt'),
  lines.join('\n'),
);
