/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { DSP_DEFAULTS } from '../../../common/dsp/chainDefaults';
import { hasVoice, encodeChainSettings } from '../../../common/dsp/chainWire';
import {
  clampMicSettings,
  clampMicSoundFile,
  EMPTY_MIC_SOUND,
} from '../../../common/micSound';
import { parseFluidEngineStatus } from '../../../main/engineStatus';

const KRAKEN = '{68C4C60D-B79B-4787-99F5-4C5A20173247}';

describe('a microphone rack', () => {
  it('is always low lag, whatever was stored', () => {
    expect(
      clampMicSettings({ ...DSP_DEFAULTS, gameMode: false }).gameMode,
    ).toBe(true);
    expect(clampMicSettings(undefined).gameMode).toBe(true);
  });

  it('keeps its Voice stage, made valid, and carries it on the wire', () => {
    const rack = clampMicSettings({
      ...DSP_DEFAULTS,
      voice: { enabled: true, lowCutHz: 500, gateEnabled: true },
    });
    expect(rack.voice?.lowCutHz).toBe(300);
    expect(rack.voice?.gateEnabled).toBe(true);
    expect(hasVoice(encodeChainSettings(rack))).toBe(true);
  });
});

describe('the microphones’ sound read back from disk', () => {
  it('keeps every mic under a valid id and drops the rest', () => {
    const file = clampMicSoundFile({
      selected: KRAKEN.toLowerCase(),
      mics: {
        [KRAKEN.toLowerCase()]: { name: 'Kraken', profileId: 'stream' },
        'not-an-id': { name: 'nope' },
      },
    });
    expect(Object.keys(file.mics)).toEqual([KRAKEN]);
    expect(file.selected).toBe(KRAKEN);
    expect(file.mics[KRAKEN].name).toBe('Kraken');
    expect(file.mics[KRAKEN].settings.gameMode).toBe(true);
  });

  it('reads anything else as no mics at all', () => {
    expect(clampMicSoundFile('garbage')).toEqual(EMPTY_MIC_SOUND);
    expect(clampMicSoundFile({ mics: 7 }).mics).toEqual({});
  });
});

describe('the helper’s microphones in the status document', () => {
  it('are read apart from the outputs, each with its name', () => {
    const status = parseFluidEngineStatus(
      JSON.stringify({
        installed: true,
        endpoints: [
          { guid: '{11111111-1111-1111-1111-111111111111}', attached: true },
        ],
        microphones: [
          {
            guid: KRAKEN,
            name: 'Microphone (Kraken)',
            attached: false,
            slot: null,
          },
        ],
      }),
    );
    expect(status.endpoints.map((endpoint) => endpoint.guid)).toEqual([
      '{11111111-1111-1111-1111-111111111111}',
    ]);
    expect(status.microphones).toEqual([
      {
        guid: KRAKEN,
        name: 'Microphone (Kraken)',
        attached: false,
        backupExists: false,
      },
    ]);
  });

  it('are absent, not empty, from a helper that does not list them', () => {
    const status = parseFluidEngineStatus(
      JSON.stringify({ installed: true, endpoints: [] }),
    );
    expect(status.microphones).toBeUndefined();
  });
});
