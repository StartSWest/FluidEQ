/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A stage's own saved profiles: what a save keeps, what putting one on the
 * stage does, and the list in storage.
 */
import { DSP_DEFAULTS } from '../../../common/dsp/chain';
import {
  PRESET_STAGES,
  applyStagePreset,
  isStagePresetId,
  stagePresetPrefix,
  stagePresetSettings,
} from '../../../common/dsp/stagePresets';
import {
  STAGE_PRESET_NAME_MAX,
  readStagePresets,
  removeStagePreset,
  saveStagePreset,
} from '../../../renderer/dsp/stagePresetStore';

const STORAGE_KEY = 'fluideq.dsp.stagePresets.v1';

beforeEach(() => {
  window.localStorage.clear();
  jest.restoreAllMocks();
});

describe('what a saved profile keeps', () => {
  it('keeps the sound, never the switch, the name showing or a monitor', () => {
    PRESET_STAGES.forEach((stage) => {
      const live = {
        ...DSP_DEFAULTS[stage],
        enabled: true,
        presetId: 'something',
        ...('isolate' in DSP_DEFAULTS[stage] ? { isolate: true } : {}),
      };
      const kept = stagePresetSettings(stage, live);
      expect({ stage, enabled: kept.enabled }).toEqual({
        stage,
        enabled: DSP_DEFAULTS[stage].enabled,
      });
      expect(kept.presetId).toBe('');
      // A stage with no monitor reads as one with it off.
      expect({
        stage,
        isolate: 'isolate' in kept ? kept.isolate : false,
      }).toEqual({ stage, isolate: false });
    });
  });

  it('brings a stored figure from another build back into range', () => {
    const kept = stagePresetSettings('deEsser', { rangeDb: 400 });
    expect(kept.rangeDb).toBe(18);
  });
});

describe('putting a saved profile on the stage', () => {
  it('switches the stage on and names the profile', () => {
    const saved = stagePresetSettings('exciter', {
      ...DSP_DEFAULTS.exciter,
      align: { enabled: true, amount: 0.8 },
    });
    const id = `${stagePresetPrefix('exciter')}x`;
    const on = applyStagePreset('exciter', saved, DSP_DEFAULTS.exciter, id);
    expect(on.enabled).toBe(true);
    expect(on.presetId).toBe(id);
    expect(on.isolate).toBe(false);
    expect(on.align).toEqual({ enabled: true, amount: 0.8 });
  });

  it('keeps the Master’s level-matched comparison where the listener left it', () => {
    const saved = stagePresetSettings('master', {
      ...DSP_DEFAULTS.master,
      matchedBypass: false,
    });
    const listening = { ...DSP_DEFAULTS.master, matchedBypass: true };
    const on = applyStagePreset('master', saved, listening, 'stage:master:a');
    expect(on.matchedBypass).toBe(true);
    // Control: from a stage with it off, it stays off.
    expect(
      applyStagePreset('master', saved, DSP_DEFAULTS.master, 'stage:master:a')
        .matchedBypass,
    ).toBe(false);
  });

  it('knows its own ids, and only its stage’s', () => {
    expect(isStagePresetId('bassForge', 'stage:bassForge:abc')).toBe(true);
    expect(isStagePresetId('bassForge', 'stage:bassPunch:abc')).toBe(false);
    expect(isStagePresetId('bassForge', 'user:abc')).toBe(false);
  });
});

describe('the saved list', () => {
  it('saves, reads back and deletes', () => {
    const saved = saveStagePreset('dimension', ' Wide room ', {
      ...DSP_DEFAULTS.dimension,
      enabled: true,
    });
    expect(saved?.name).toBe('Wide room');
    expect(saved?.id.startsWith(stagePresetPrefix('dimension'))).toBe(true);
    expect(readStagePresets('dimension').map((one) => one.name)).toEqual([
      'Wide room',
    ]);
    // Each stage keeps its own list.
    expect(readStagePresets('maximizer')).toEqual([]);
    expect(saved && removeStagePreset('dimension', saved.id)).toBe(true);
    expect(readStagePresets('dimension')).toEqual([]);
  });

  it('saves over a name already taken, whatever its case', () => {
    const first = saveStagePreset('bassPunch', 'Tight', DSP_DEFAULTS.bassPunch);
    const second = saveStagePreset('bassPunch', 'TIGHT', {
      ...DSP_DEFAULTS.bassPunch,
      attack: 0.9,
    });
    expect(second?.id).toBe(first?.id);
    const list = readStagePresets('bassPunch');
    expect(list).toHaveLength(1);
    expect(list[0]?.settings.attack).toBe(0.9);
  });

  it('caps the name, and refuses an empty one', () => {
    const long = saveStagePreset('master', 'x'.repeat(90), DSP_DEFAULTS.master);
    expect(long?.name).toHaveLength(STAGE_PRESET_NAME_MAX);
    expect(saveStagePreset('master', '   ', DSP_DEFAULTS.master)).toBe(
      undefined,
    );
  });

  it('reports a save storage refused, and keeps the list as it was', () => {
    saveStagePreset('denoise', 'Kept', DSP_DEFAULTS.denoise);
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('full');
    });
    expect(saveStagePreset('denoise', 'Lost', DSP_DEFAULTS.denoise)).toBe(
      undefined,
    );
    jest.restoreAllMocks();
    expect(readStagePresets('denoise').map((one) => one.name)).toEqual([
      'Kept',
    ]);
  });

  it('drops what it cannot read, and another stage’s ids', () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        exciter: [
          { id: 'stage:exciter:good', name: 'Good', settings: {} },
          { id: 'stage:dimension:wrong', name: 'Wrong', settings: {} },
          { id: 7, name: 'No id' },
          { id: 'stage:exciter:blank', name: '  ' },
          'nonsense',
        ],
      }),
    );
    expect(readStagePresets('exciter').map((one) => one.id)).toEqual([
      'stage:exciter:good',
    ]);
    window.localStorage.setItem(STORAGE_KEY, '{not json');
    expect(readStagePresets('exciter')).toEqual([]);
  });

  it('tells the bars a list changed', () => {
    const heard = jest.fn();
    window.addEventListener('fluideq-dsp-presets-changed', heard);
    saveStagePreset('maximizer', 'Loud', DSP_DEFAULTS.maximizer);
    window.removeEventListener('fluideq-dsp-presets-changed', heard);
    expect(heard).toHaveBeenCalledTimes(1);
  });
});
