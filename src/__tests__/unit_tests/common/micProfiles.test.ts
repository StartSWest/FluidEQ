/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  encodeChainSettings,
  hasVoice,
  isChainWirePayload,
} from '../../../common/dsp/chainWire';
import { MAXIMIZER_MIN_LOOK_AHEAD_MS } from '../../../common/dsp/chainStageSettings';
import {
  isMicProfileId,
  MIC_PROFILE_IDS,
  micProfileGroup,
  micProfileSettings,
  micRackDelayMs,
} from '../../../common/dsp/micProfiles';
import { clampMicSettings } from '../../../common/micSound';
import en from '../../../common/i18n/en';

describe('the mic profiles', () => {
  it.each(MIC_PROFILE_IDS)(
    '%s is a valid mic rack the engine reads, low lag, Voice on',
    (id) => {
      const rack = micProfileSettings(id);
      expect(rack.gameMode).toBe(true);
      expect(rack.voice?.enabled).toBe(true);
      const line = encodeChainSettings(rack);
      expect(isChainWirePayload(line)).toBe(true);
      expect(hasVoice(line)).toBe(true);
      // Read back through the store's clamp, nothing moves.
      expect(clampMicSettings(rack)).toEqual(rack);
    },
  );

  it.each(MIC_PROFILE_IDS)('%s has a name and a hint in English', (id) => {
    const words = en as Record<string, string>;
    expect(words[`mic.profile.${id}`]).toBeTruthy();
    expect(words[`mic.profile.${id}.hint`]).toBeTruthy();
  });

  it('keeps the limiter at its shortest look-ahead wherever it is on', () => {
    MIC_PROFILE_IDS.map(micProfileSettings)
      .filter((rack) => rack.maximizer.enabled)
      .forEach((rack) =>
        expect(rack.maximizer.lookAheadMs).toBe(MAXIMIZER_MIN_LOOK_AHEAD_MS),
      );
  });

  it('leaves the voice cleaner and the gate off for singing', () => {
    const sing = micProfileSettings('sing');
    expect(sing.denoise.voice.enabled).toBe(false);
    expect(sing.voice?.gateEnabled).toBe(false);
    // Control: streaming has both.
    const stream = micProfileSettings('stream');
    expect(stream.denoise.voice.enabled).toBe(true);
    expect(stream.voice?.gateEnabled).toBe(true);
  });

  it('says what each adds in delay: the cleaner, the De-esser, the limiter', () => {
    expect(micRackDelayMs(micProfileSettings('stream'))).toBe(23);
    expect(micRackDelayMs(micProfileSettings('sing'))).toBe(3);
    expect(micRackDelayMs(micProfileSettings('meet'))).toBe(21);
    expect(
      micRackDelayMs({ ...micProfileSettings('stream'), enabled: false }),
    ).toBe(0);
  });

  it('groups them by use and by mic, and knows its own ids', () => {
    expect(micProfileGroup('chat')).toBe('use');
    expect(micProfileGroup('laptop')).toBe('mic');
    expect(isMicProfileId('stream')).toBe(true);
    expect(isMicProfileId('nope')).toBe(false);
  });

  it('gives every profile arrays of its own', () => {
    const first = micProfileSettings('stream');
    first.eq.bands[0].gainDb = 99;
    expect(micProfileSettings('stream').eq.bands[0].gainDb).not.toBe(99);
  });
});
