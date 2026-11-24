/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The mic profiles as the text of `mic_profiles_fixture.h`.
 *
 * One function for the two that need it: the script that writes the header
 * and the test that holds the header to the profiles. Each line is the one
 * encoder's (`encodeChainSettings`), so `mic_profiles_test.cpp` measures the
 * racks a mic is actually given — and beside each, the same rack with Voice
 * level off, the control every Voice level check is measured against.
 */
import type { IDspSettings } from '../dsp/chainSettings';
import { encodeChainSettings } from '../dsp/chainWire';
import {
  MIC_PROFILE_IDS,
  micProfileSettings,
  TMicProfileId,
} from './micProfiles';

/** The ceiling each profile's limiter is set to, beside its line. */
const ceilingOf = (rack: IDspSettings): number =>
  rack.maximizer.enabled ? rack.maximizer.ceilingDb : 0;

/**
 * How far the rack may lift a steady room with Voice level off: the
 * compressor's make-up and the limiter's drive are plain gain under their
 * thresholds, and an EQ's shelves tilt white noise up by about 3 dB.
 */
const roomAllowanceOf = (rack: IDspSettings): number => {
  const makeup = rack.dynamics.enabled
    ? Math.max(0, rack.dynamics.makeupDb)
    : 0;
  const drive = rack.maximizer.enabled
    ? Math.max(0, rack.maximizer.driveDb)
    : 0;
  return makeup + drive + 3;
};

const lineOf = (rack: IDspSettings): string =>
  encodeChainSettings(rack)
    .map((value) => String(value))
    .join(' ');

const rowOf = (id: TMicProfileId): string => {
  const rack = micProfileSettings(id);
  const levelOff: IDspSettings = {
    ...rack,
    voice: rack.voice ? { ...rack.voice, levelEnabled: false } : rack.voice,
  };
  const gate = rack.voice?.gateEnabled ? 1 : 0;
  return [
    `    {"${id}", ${ceilingOf(rack)}, ${gate}, ${roomAllowanceOf(rack)},`,
    `     "${lineOf(rack)}",`,
    `     "${lineOf(levelOff)}"},`,
  ].join('\n');
};

const micProfilesFixture = (): string =>
  [
    '/*',
    '<FluidEQ: System-wide parametric audio equalizer interface>',
    'Copyright (C) <2026>  <Ivan Carmenates Garcia>',
    'SPDX-License-Identifier: GPL-3.0-or-later',
    '*/',
    '',
    '/**',
    ' * The mic profiles, as `micProfiles.ts` builds them and the encoder writes',
    ' * them, for `mic_profiles_test.cpp`. Written by',
    ' * `generate-mic-profiles-fixture.ts`; `micProfiles.test.ts` fails when this',
    ' * header and the profiles part ways. Each row: the id, the limiter ceiling',
    ' * in dB (0 with no limiter), whether the gate is on, how far the rack may',
    ' * lift a steady room with Voice level off (make-up, drive and 3 dB of EQ',
    ' * tilt), the rack line, and the same rack with Voice level off.',
    ' */',
    '#ifndef FLUIDEQ_ENGINE_MIC_PROFILES_FIXTURE_H',
    '#define FLUIDEQ_ENGINE_MIC_PROFILES_FIXTURE_H',
    '',
    'namespace fluideq_engine_test {',
    '',
    'struct MicProfileRow {',
    '  const char* id;',
    '  double ceiling_db;',
    '  int gate;',
    '  double room_allowance_db;',
    '  const char* line;',
    '  const char* level_off_line;',
    '};',
    '',
    'inline const MicProfileRow kMicProfiles[] = {',
    ...MIC_PROFILE_IDS.map(rowOf),
    '};',
    '',
    '}  // namespace fluideq_engine_test',
    '',
    '#endif  // FLUIDEQ_ENGINE_MIC_PROFILES_FIXTURE_H',
    '',
  ].join('\n');

export default micProfilesFixture;
