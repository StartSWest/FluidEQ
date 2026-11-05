/* FluidEQ — GPL-3.0-or-later */
import { DSP_DEFAULTS } from '../../../common/dsp/chain';
import { DE_ESSER_PRESETS } from '../../../common/dsp/deEsserPresets';
import { DE_ESSER_CATALOGUE } from '../../../common/dsp/stageCatalogues';
import { GENRE_RACKS, genreChainId } from '../../../common/dsp/genres';
import { inGenreChain } from '../../../common/dsp/genreRack';
import { dspPresetSettings } from '../../../common/dsp/presets';
import { genreNotesFor } from '../../../renderer/dsp/genreNotesModel';

describe('transparent Pop playback', () => {
  it('selects its named de-esser, with a restrained cut and no monitor inheritance', () => {
    const previous = {
      ...DSP_DEFAULTS,
      deEsser: {
        ...DSP_DEFAULTS.deEsser,
        enabled: true,
        isolate: true,
        rangeDb: 18,
        mode: 'whole' as const,
      },
    };
    const pop = dspPresetSettings('pop', previous);
    expect(pop?.deEsser).toMatchObject({
      enabled: true,
      presetId: 'pop',
      isolate: false,
      mode: 'spectral',
      centreOnly: true,
    });
    expect(pop?.deEsser.rangeDb).toBeLessThanOrEqual(1.5);
    expect(pop?.deEsser.sensitivity).toBeLessThanOrEqual(0.15);
    expect(DE_ESSER_CATALOGUE.settings('pop', true)).toEqual(pop?.deEsser);
    expect(genreNotesFor('pop')?.stagesOn).toContain('deEsser');
  });

  it('retains the approved body while leaving treble excitation and Dynamics off', () => {
    const pop = dspPresetSettings('pop');
    expect(pop?.exciter.enabled).toBe(true);
    expect(pop?.exciter.bands[2].enabled).toBe(false);
    expect(pop?.exciter.bands[1].mix).toBeLessThanOrEqual(0.12);
    expect(pop?.bassForge.enabled).toBe(false);
    expect(pop?.dynamics.enabled).toBe(false);
    expect(pop?.master.enabled).toBe(false);
    expect(pop?.maximizer.ceilingDb).toBe(-1);
    expect(genreNotesFor('pop')?.stagesOn).toContain('exciter');
  });

  it('selects another genre’s own de-esser instead of carrying Pop into it', () => {
    const previous = dspPresetSettings('pop');
    GENRE_RACKS.filter((rack) => rack.id !== 'pop').forEach((rack) => {
      expect(
        dspPresetSettings(genreChainId(rack), previous)?.deEsser.enabled,
      ).toBe(inGenreChain(rack, 'deEsser'));
      expect(dspPresetSettings(genreChainId(rack), previous)?.deEsser).toEqual(
        inGenreChain(rack, 'deEsser')
          ? DE_ESSER_CATALOGUE.settings(rack.id, true)
          : { ...DSP_DEFAULTS.deEsser, enabled: false },
      );
    });
    expect(dspPresetSettings('empty', previous)?.deEsser.enabled).toBe(false);
  });

  it('caps the music root profiles while keeping their frequency-selective processing', () => {
    DE_ESSER_PRESETS.filter((preset) => preset.group === 'music').forEach(
      (preset) => {
        expect(preset.settings.rangeDb).toBeLessThanOrEqual(3);
        expect(preset.settings.sensitivity).toBeLessThanOrEqual(0.35);
        expect(preset.settings.mode).toBe('spectral');
        expect(preset.settings.keepCymbals).toBeGreaterThanOrEqual(0.85);
      },
    );
  });
});
