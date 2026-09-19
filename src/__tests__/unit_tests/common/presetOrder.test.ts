import { DSP_PRESETS } from 'common/dsp/presets';
import { EQ_PRESETS } from 'common/dsp/eqPresets';

it.each([
  ['DSP and quick selection', DSP_PRESETS],
  ['EQ stage', EQ_PRESETS],
])('keeps related styles adjacent in %s', (_name, presets) => {
  const styles = presets
    .filter((preset) => preset.group === 'genre')
    .map((preset) => preset.labelKey.replace('dsp.eqPreset.', ''));
  [
    ['country', 'modernCountry'],
    ['rock', 'classicRock', 'alternativeRock', 'indieRock', 'progressiveRock'],
    ['pop', 'indiePop', 'synthPop'],
    ['hiphop', 'rap', 'trap'],
    ['jazz', 'smoothJazz', 'fusion'],
    ['classical', 'orchestra', 'opera'],
    ['regionalMexican', 'corridos'],
    ['afrobeat', 'afrobeats', 'amapiano', 'highlife'],
  ].forEach((family) => {
    const start = styles.indexOf(family[0]);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(styles.slice(start, start + family.length)).toEqual(family);
  });
});

it('keeps the three primary choices first', () => {
  expect(DSP_PRESETS.slice(0, 3).map((preset) => preset.id)).toEqual([
    'balanced',
    'reference',
    'music',
  ]);
});
