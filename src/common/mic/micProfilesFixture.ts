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
 * racks a mic is actually given.
 */
import { encodeChainSettings } from '../dsp/chainWire';
import { MIC_PROFILE_IDS, micProfileSettings } from './micProfiles';

/** The ceiling each profile's limiter is set to, beside its line. */
const ceilingOf = (id: (typeof MIC_PROFILE_IDS)[number]): number => {
  const rack = micProfileSettings(id);
  return rack.maximizer.enabled ? rack.maximizer.ceilingDb : 0;
};

const micProfilesFixture = (): string => {
  const rows = MIC_PROFILE_IDS.map((id) => {
    const line = encodeChainSettings(micProfileSettings(id))
      .map((value) => String(value))
      .join(' ');
    const gate = micProfileSettings(id).voice?.gateEnabled ? 1 : 0;
    return `    {"${id}", ${ceilingOf(id)}, ${gate},\n     "${line}"},`;
  });
  return [
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
    ' * in dB (0 with no limiter), whether the gate is on, the rack line.',
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
    '  const char* line;',
    '};',
    '',
    'inline const MicProfileRow kMicProfiles[] = {',
    ...rows,
    '};',
    '',
    '}  // namespace fluideq_engine_test',
    '',
    '#endif  // FLUIDEQ_ENGINE_MIC_PROFILES_FIXTURE_H',
    '',
  ].join('\n');
};

export default micProfilesFixture;
