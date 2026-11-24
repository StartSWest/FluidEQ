/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The text of `voice_line_fixture.h`: a microphone's racks with the Voice
 * stage on, and one with its Reverb, as the encoder writes them. One
 * function for the two that need it: the script that writes the header and
 * the test that holds the header to the encoder (`dspVoice.test.ts`).
 *
 * Every value is one no other field carries, so a value read from the
 * wrong place cannot pass for the right one.
 */
import { FilterTypeEnum } from '../constants';
import { DSP_DEFAULTS } from './chainDefaults';
import type { IDspSettings } from './chainSettings';
import { appendPresetTone, encodeChainSettings } from './chainWire';
import type { IReverbSettings } from './reverbStage';
import type { IVoiceSettings } from './voiceStage';

export const FIXTURE_VOICE: IVoiceSettings = {
  enabled: true,
  lowCutHz: 95,
  proximityDb: 3.5,
  deplosive: 0.6,
  gateEnabled: true,
  gateThresholdDb: -47,
  gateRangeDb: 22,
  gateHoldMs: 180,
  gateAttackMs: 1.5,
  gateReleaseMs: 140,
  levelEnabled: true,
  levelTargetDb: -20,
  levelMaxLiftDb: 15,
};

export const FIXTURE_REVERB: IReverbSettings = {
  enabled: true,
  type: 'chamber',
  mixDb: -21,
  decayS: 2.3,
  predelayMs: 37,
  toneHz: 6100,
  lowCutHz: 230,
  width: 0.45,
  duck: true,
  duckDb: 7.5,
};

const rack = (patch: Partial<IDspSettings>): IDspSettings => ({
  ...DSP_DEFAULTS,
  enabled: true,
  ...patch,
});

const TONE = {
  matched: true,
  bands: [
    { type: FilterTypeEnum.PK, frequency: 3150, gain: 2.8, quality: 1.4 },
  ],
};

/** The fixture's lines, by the name the header gives each. */
export const voiceFixtureLines = (): Record<string, number[]> => ({
  kVoiceAloneLine: encodeChainSettings(rack({ voice: FIXTURE_VOICE })),
  kVoiceLowLagLine: encodeChainSettings(
    rack({ gameMode: true, voice: FIXTURE_VOICE }),
  ),
  kVoiceDynamicsToneLine: appendPresetTone(
    encodeChainSettings(
      rack({
        gameMode: true,
        dynamics: { ...DSP_DEFAULTS.dynamics, enabled: true },
        voice: FIXTURE_VOICE,
      }),
    ),
    TONE,
  ),
  kVoiceReverbToneLine: appendPresetTone(
    encodeChainSettings(
      rack({
        gameMode: true,
        dynamics: { ...DSP_DEFAULTS.dynamics, enabled: true },
        voice: FIXTURE_VOICE,
        reverb: FIXTURE_REVERB,
      }),
    ),
    TONE,
  ),
});

/** A line as C string literals of about 80 columns. */
const cString = (values: readonly number[]): string => {
  const words = values.map((value) => String(value));
  const lines: string[] = [];
  let current = '';
  words.forEach((word) => {
    const next = current ? `${current} ${word}` : word;
    if (next.length > 76) {
      lines.push(`${current} `);
      current = word;
    } else {
      current = next;
    }
  });
  lines.push(current);
  return lines.map((line) => `    "${line}"`).join('\n');
};

const voiceLineFixture = (): string => {
  const lines = Object.entries(voiceFixtureLines()).map(
    ([name, values]) =>
      `inline const char* const ${name} =\n${cString(values)};\n`,
  );
  return [
    '/*',
    '<FluidEQ: System-wide parametric audio equalizer interface>',
    'Copyright (C) <2026>  <Ivan Carmenates Garcia>',
    'SPDX-License-Identifier: GPL-3.0-or-later',
    '*/',
    '',
    '/**',
    ' * Microphone racks with the Voice stage on, and one with its Reverb, as',
    ' * the app writes them, for `voice_line_test.cpp`. Written by',
    ' * `generate-voice-line-fixture.ts` from the one encoder there is',
    ' * (`voiceLineFixture.ts`); `dspVoice.test.ts` fails when this header and',
    ' * the encoder part ways. The Voice: low cut 95 Hz, proximity 3.5 dB, pop',
    ' * guard 0.6, gate on at -47 dB, range 22 dB, hold 180 ms, attack 1.5 ms,',
    ' * release 140 ms, Voice level on at -20 dB with 15 dB most lift. The',
    ' * Reverb: Chamber, mix -21 dB, decay 2.3 s, pre-delay 37 ms, tone',
    ' * 6100 Hz, low cut 230 Hz, width 0.45, ducking on by 7.5 dB. Lines: the',
    ' * defaults with Voice alone; the same in low lag; low lag with Dynamics',
    ' * on at its defaults and a 3150 Hz +2.8 dB bell at Q 1.4 appended; and',
    ' * that with the Reverb too.',
    ' */',
    '#ifndef FLUIDEQ_ENGINE_VOICE_LINE_FIXTURE_H',
    '#define FLUIDEQ_ENGINE_VOICE_LINE_FIXTURE_H',
    '',
    'namespace fluideq_engine_test {',
    '',
    ...lines,
    '}  // namespace fluideq_engine_test',
    '',
    '#endif  // FLUIDEQ_ENGINE_VOICE_LINE_FIXTURE_H',
    '',
  ].join('\n');
};

export default voiceLineFixture;
