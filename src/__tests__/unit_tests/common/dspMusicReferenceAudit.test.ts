/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import audit from '../../../../docs/dsp/music-reference-audit.json';
import { GENRE_NOTES } from '../../../common/dsp/genreNotes';
import { GENRE_RACKS, genreChainId } from '../../../common/dsp/genres';
import { DSP_PRESETS } from '../../../common/dsp/presets';
import { DSP_DEFAULTS } from '../../../common/dsp/chain';
import { normalizerGainDb } from '../../../renderer/dsp/inputNormalizer';

const reviewed = GENRE_RACKS.filter(
  (rack) => !['pop', 'kPop'].includes(rack.id),
);
const presetOf = (id: string) => {
  const preset = DSP_PRESETS.find((one) => one.id === id);
  if (!preset) {
    throw new Error(`No preset for ${id}`);
  }
  return preset;
};

describe('music reference calibration', () => {
  it('covers both named references for every remaining genre without device correction', () => {
    expect(audit.genres.map((genre) => genre.id).sort()).toEqual(
      reviewed.map((rack) => rack.id).sort(),
    );
    expect(audit.headphoneCorrection).toBe(false);
    expect(audit.liveApplicationSettings).toBe(false);
    expect(audit.outputDevicesOpened).toBe(false);
    audit.genres.forEach((genre) => {
      expect(genre.references.map((reference) => reference.reference)).toEqual(
        GENRE_NOTES[genre.id].listen,
      );
      expect(genre.references).toHaveLength(2);
      genre.references.forEach((reference) => {
        expect(reference.sourceUrl).toBe(
          `https://music.apple.com/us/song/${reference.trackId}`,
        );
        expect(reference.mediaSha256).toMatch(/^[a-f0-9]{64}$/);
        expect(reference.excerptSeconds).toBeGreaterThan(10);
      });
    });
  });

  it('holds the audible factory configuration to what was rendered and measured', () => {
    audit.genres.forEach((genre) => {
      const preset = presetOf(genre.chainId);
      expect(preset.curve?.bands.map((band) => band.gainDb)).toEqual(
        genre.gains,
      );
      Object.entries(genre.processing).forEach(([stage, settings]) => {
        expect(preset.settings[stage as keyof typeof genre.processing]).toEqual(
          settings,
        );
      });
      expect(preset.settings.master.enabled).toBe(false);
      expect(preset.settings.dynamics.enabled).toBe(false);
      expect(preset.settings.normalizer.mode).toBe('loudness');
      expect(preset.settings.normalizer.truePeakDbtp).toBeLessThanOrEqual(-1);
      expect(preset.settings.normalizer.truePeakDbtp).toBeGreaterThanOrEqual(
        -3,
      );
      expect(preset.settings.maximizer.ceilingDb).toBe(-1);
    });
  });

  it('actually reaches a common input level on both references with peak headroom', () => {
    audit.genres.forEach((genre) => {
      const { normalizer } = presetOf(genre.chainId).settings;
      genre.references.forEach((reference) => {
        const facts = {
          version: 2 as const,
          integratedLufs: reference.sourceLufs,
          truePeakDbtp: reference.sourceTruePeakDbtp,
        };
        const gain = normalizerGainDb(normalizer, facts);
        expect(facts.integratedLufs + gain).toBeCloseTo(
          genre.inputTargetLufs,
          2,
        );
        expect(facts.truePeakDbtp + gain).toBeLessThanOrEqual(
          normalizer.truePeakDbtp,
        );
        // A louder copy must receive correspondingly less input gain;
        // no compressor or output-stage workaround is involved.
        const louder = normalizerGainDb(normalizer, {
          ...facts,
          integratedLufs: facts.integratedLufs + 6,
          truePeakDbtp: facts.truePeakDbtp + 6,
        });
        expect(louder).toBeCloseTo(gain - 6, 5);
      });
    });
    expect(
      normalizerGainDb(
        { ...DSP_DEFAULTS.normalizer, mode: 'off' },
        {
          version: 2,
          integratedLufs: -8,
          truePeakDbtp: 0,
        },
      ),
    ).toBe(0);
  });

  it('keeps final peaks, inter-reference loudness and limiting within the measured bounds', () => {
    audit.genres.forEach((genre) => {
      const [first, second] = genre.references;
      expect(
        Math.abs(first.outputLufs - second.outputLufs),
      ).toBeLessThanOrEqual(1.5);
      const budgets = [
        [0.2, 1.75, 0.65],
        [0.5, 3, 1],
        [1, 4, 1.5],
      ];
      const budget = budgets.find(
        ([limit]) => genre.limiterLossBudgetLu < limit,
      );
      if (!budget) {
        throw new Error(`No dynamics budget for ${genre.id}`);
      }
      const [, crestBudget, contrastBudget] = budget;
      genre.references.forEach((reference) => {
        expect(Number.isFinite(reference.outputLufs)).toBe(true);
        expect(reference.outputTruePeakDbtp).toBeLessThanOrEqual(-0.99);
        expect(reference.limiterLossLu).toBeLessThanOrEqual(
          genre.limiterLossBudgetLu + 0.036,
        );
        expect(reference.crestLossDb).toBeLessThanOrEqual(crestBudget + 0.055);
        expect(reference.blockRangeLossDb).toBeLessThanOrEqual(
          contrastBudget + 0.055,
        );
      });
      genre.stageEffects.forEach((effect) => {
        expect(effect.loudnessDeltaLu).toHaveLength(2);
      });
      expect(genre.stageEffects.map((effect) => effect.stage).sort()).toEqual(
        genre.stagesOn.filter((stage) => stage !== 'maximizer').sort(),
      );
      genre.stageEffects
        .filter((effect) => effect.stage === 'deEsser')
        .flatMap((effect) => effect.loudnessDeltaLu)
        .forEach((change) => {
          expect(Math.abs(change)).toBeLessThanOrEqual(0.15);
        });
    });
  });

  it('keeps None transparent and leaves de-essing gentle and out of Isolate', () => {
    const none = presetOf('empty').settings;
    expect(none.normalizer.mode).toBe('off');
    expect(none.deEsser.enabled).toBe(false);
    expect(none.maximizer.enabled).toBe(false);
    const stages = reviewed.map(
      (rack) => presetOf(genreChainId(rack)).settings.deEsser,
    );
    stages.forEach((deEsser) => {
      expect(deEsser.isolate).toBe(false);
    });
    expect(stages.filter((stage) => stage.enabled).length).toBeGreaterThan(40);
    expect(stages.filter((stage) => !stage.enabled).length).toBeGreaterThan(10);
    stages
      .filter((stage) => stage.enabled)
      .forEach((deEsser) => {
        expect(deEsser.mode).toBe('spectral');
        expect(deEsser.rangeDb).toBeLessThanOrEqual(1.5);
        expect(deEsser.sensitivity).toBeLessThanOrEqual(0.1);
        expect(deEsser.centreOnly).toBe(true);
        expect(deEsser.keepCymbals).toBeGreaterThanOrEqual(0.9);
      });
  });
});
