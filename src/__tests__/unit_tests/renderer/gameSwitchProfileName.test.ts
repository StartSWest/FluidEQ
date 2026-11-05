/* FluidEQ — GPL-3.0-or-later */

import { AUTOMATIC_PRESET_PREFIX } from '../../../common/constants';
import { yoursGamingProfileId } from '../../../common/gaming';
import { DSP_PRESETS, dspPresetCurve } from '../../../common/dsp/presets';
import { dspPresetVoicing } from '../../../common/dsp/presetVoicing';
import { translate, type Translate } from '../../../common/i18n';
import gameSwitchProfileName from '../../../renderer/games/gameSwitchProfileName';
import type { IGameSwitch } from '../../../renderer/games/useGameSound';

const t: Translate = (key, vars) => translate('en', key, vars);
const preset = DSP_PRESETS.find((one) => one.id === 'kPop');
if (!preset) {
  throw new Error('Missing K-pop preset');
}
const curve = dspPresetCurve(preset.id);
if (!curve) {
  throw new Error('Missing K-pop curve');
}
const voicing = dspPresetVoicing(preset.id, curve);
const loaded: IGameSwitch = {
  id: 1,
  game: 'A game',
  kind: 'loaded',
  profileId: 'ready:competitive',
  profile: { voicing },
};

it('names the whole Gaming profile or copy rather than its differently named curve', () => {
  expect(gameSwitchProfileName(loaded, [], t)).toBe('Competitive');
  expect(
    gameSwitchProfileName({ ...loaded, copyName: 'Ranked nights' }, [], t),
  ).toBe('Ranked nights');
});

it('keeps a saved Gaming profile name while its curve has another name', () => {
  expect(
    gameSwitchProfileName(
      { ...loaded, profileId: yoursGamingProfileId('my-mix') },
      [{ id: 'my-mix', name: 'Quiet nights', from: 'A game', savedAt: 1 }],
      t,
    ),
  ).toBe('Quiet nights');
});

it('can still name the sound after its original Gaming profile was removed', () => {
  expect(
    gameSwitchProfileName(
      { ...loaded, profileId: yoursGamingProfileId('removed') },
      [],
      t,
    ),
  ).toBe('K-pop');
});

it('names the actual restored music profile and hides automatic file IDs', () => {
  const restored = {
    ...loaded,
    kind: 'restored' as const,
    profile: { name: 'My headphones', voicing },
  };
  expect(gameSwitchProfileName(restored, [], t)).toBe('My headphones');
  expect(
    gameSwitchProfileName(
      {
        ...restored,
        profile: { name: `${AUTOMATIC_PRESET_PREFIX}abc`, voicing },
      },
      [],
      t,
    ),
  ).toBe('K-pop');
});

it('keeps a useful label when the Preset layer is bypassed or metadata is unavailable', () => {
  expect(
    gameSwitchProfileName(
      { ...loaded, profile: { voicing, voicingBypassed: true } },
      [],
      t,
    ),
  ).toBe('Competitive');
  expect(
    gameSwitchProfileName(
      { ...loaded, kind: 'restored', profile: undefined },
      [],
      t,
    ),
  ).toBe(t('output.mapping.live'));
});
