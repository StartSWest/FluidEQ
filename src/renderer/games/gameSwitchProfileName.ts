/* FluidEQ — GPL-3.0-or-later */

import { AUTOMATIC_PRESET_PREFIX } from '../../common/constants';
import type { IYoursGamingProfile } from '../../common/gaming';
import { suggestGamingProfile } from '../../common/gaming';
import type { Translate } from '../../common/i18n';
import { isVoicingActive } from '../../common/voicing';
import { presetLayerName } from '../dsp/dspPresetCatalog';
import { gamingProfileEntry } from './gamingCatalog';
import type { IGameSwitch } from './useGameSound';

/** Names the confirmed sound, not the one the renderer happened to draw
 * before main finished the switch. Hidden automatic/copy file IDs stay hidden. */
export default function gameSwitchProfileName(
  switched: IGameSwitch,
  yours: readonly IYoursGamingProfile[],
  t: Translate,
): string {
  const { profile } = switched;
  if (switched.kind === 'loaded' && switched.copyName) {
    return switched.copyName;
  }
  const gaming =
    switched.kind === 'loaded'
      ? gamingProfileEntry(
          switched.profileId ?? suggestGamingProfile(switched.game),
          yours,
          t,
        )
      : undefined;
  // A Gaming profile owns the whole sound. Its curve may be named K-pop
  // or Competitive without being the name the listener loaded it under.
  if (gaming && gaming.kind !== 'gone') {
    return gaming.name;
  }
  if (
    switched.kind === 'restored' &&
    profile?.name &&
    !profile.name.startsWith(AUTOMATIC_PRESET_PREFIX)
  ) {
    return profile.name;
  }
  if (
    profile?.voicing &&
    !profile.voicingBypassed &&
    isVoicingActive(profile.voicing)
  ) {
    const name = presetLayerName(profile.voicing, t);
    if (name) {
      return name;
    }
  }
  return gaming?.name ?? t('output.mapping.live');
}
