/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { useState } from 'react';
import { VOICING_PROFILES, getVoicingProfile } from 'common/voicing';
import VoicingIcon from '../icons/VoicingIcon';
import { useFluidEqContext } from '../utils/FluidEqContext';
import { useTranslation } from '../utils/I18nContext';
import RichPick, { IRichPickEntry } from '../widgets/RichPick';
import {
  setLayerBypass,
  setVoicing as setVoicingApi,
} from '../utils/equalizerApi';
import '../styles/RichPick.scss';
import '../styles/VoicingQuickPick.scss';

/**
 * Voicing without leaving the EQ.
 *
 * The Voicing tab is where you compare curves and read what each one does;
 * this is for the far more common case of switching between them while you are
 * already tuning. It collapses to a single icon because the EQ toolbar has no
 * room for six cards — the menu carries the names.
 */
const VoicingQuickPick = () => {
  const {
    isBlockingError,
    isEnabled,
    voicing,
    setVoicing,
    bypassed,
    refreshState,
  } = useFluidEqContext();
  const { t } = useTranslation();
  /** A switch the engine refused, shown until the next attempt. */
  const [isRefused, setRefused] = useState(false);

  const activeId = voicing?.profileId ?? '';
  const activeProfile = getVoicingProfile(activeId);
  const strengthPercent = Math.round((voicing?.intensity ?? 1) * 100);
  /**
   * The layer's A/B switch, which lives on the applied-layer chip.
   *
   * Shown here as well because this button is the one that names the voicing,
   * and it was naming one that was not in the chain — "Music" in full colour
   * over a config with no voicing in it. The chip said so and this did not, and
   * they are at opposite ends of the toolbar.
   */
  const isVoicingBypassed = bypassed.includes('voicing');

  const apply = async (profileId: string) => {
    // A new voicing arrives at full strength, always.
    //
    // Strength used to carry over from whatever was chosen before, which is
    // defensible and wrong in practice: somebody turns Music down to 20%,
    // switches to Rock to hear what it does, and hears almost nothing — because
    // they are listening to a fifth of it. The obvious conclusion is that the
    // voicing does nothing, and the control that would show otherwise is a
    // slider they are not looking at on a chip at the other end of the toolbar.
    //
    // Picking a profile is asking what it sounds like. Full is the answer to
    // that question, and turning it down afterwards is one drag away.
    const intensity = profileId ? 1 : (voicing?.intensity ?? 1);
    setVoicing({ profileId, intensity });
    setRefused(false);
    try {
      await setVoicingApi(profileId, intensity);
      // Choosing a voicing switches the layer back on.
      //
      // Picking one while it is bypassed is not a request to change which
      // voicing is not being applied. Without this the new choice landed in the
      // config and stayed out of the chain, so the button changed, the chip
      // changed, and the sound did not.
      if (profileId && bypassed.includes('voicing')) {
        await setLayerBypass('voicing', false);
      }
      await refreshState();
    } catch {
      // Not raised globally, and not silent either — both extremes are wrong
      // here, and the app has now been each of them.
      //
      // Raising blanks the workspace over a layer that will not switch, which
      // is out of all proportion. Saying nothing is what this used to do, and
      // the result was a genre entry that simply could not be selected: the
      // trigger snapped back and nothing anywhere said why. It took a restart
      // and a read of the IPC handler to find out that the main process was
      // refusing the id.
      //
      // So it reverts, and it says so, on the control that was pressed.
      setVoicing(voicing ?? { profileId: '', intensity: 1 });
      setRefused(true);
    }
  };

  const entries: IRichPickEntry[] = [
    {
      // Pickable, and never what the pill reports — see RichPick. Choosing it
      // is how somebody turns voicing off from the same control they turned it
      // on with, which is where they look for it.
      id: '',
      name: t('voicing.none'),
      hint: t('voicing.quickNoneHint'),
      group: '',
      icon: <VoicingIcon profileId="none" className="rich-pick__glyph" />,
    },
    ...VOICING_PROFILES.map((profile) => ({
      id: profile.id,
      name: profile.name,
      hint: profile.tagline,
      group: profile.group,
      icon: <VoicingIcon profileId={profile.id} className="rich-pick__glyph" />,
    })),
  ];

  return (
    <RichPick
      className="voicing-pick"
      entries={entries}
      groupLabel={(group) => {
        if (group === 'genre') {
          return t('voicing.groupGenre');
        }
        return group === 'purpose' ? t('voicing.groupPurpose') : '';
      }}
      activeId={activeId}
      onPick={apply}
      placeholder={t('voicing.quickLabel')}
      placeholderIcon={<VoicingIcon className="rich-pick__glyph" />}
      triggerAriaLabel={
        activeProfile
          ? t('voicing.quickAria', {
              name: `${activeProfile.name} ${strengthPercent}%`,
            })
          : t('voicing.quickNone')
      }
      triggerTitle={
        activeProfile
          ? `${activeProfile.name} · ${strengthPercent}% — ${activeProfile.tagline}`
          : t('voicing.quickTitle')
      }
      triggerClassName={
        activeProfile && isVoicingBypassed ? 'is-bypassed' : undefined
      }
      /* In a cell of a reserved width, which is the only reason it can be here
         at all. Appended as plain text it changed this button's width on every
         step of a drag, and this button sits in a row of eleven — so the whole
         toolbar shuffled sideways while you were aiming at one of them. */
      triggerExtra={
        activeProfile ? (
          <small className="voicing-pick__strength">{strengthPercent}%</small>
        ) : undefined
      }
      disabled={isBlockingError || !isEnabled}
    >
      {/* On the control, not over the workspace. It stays until the next
          attempt rather than fading, because the thing it is reporting is that
          nothing changed — and a message about nothing having happened that
          disappears on its own is indistinguishable from never having been
          there. */}
      {isRefused && (
        <span className="voicing-pick__refused" role="status">
          {t('voicing.refused')}
        </span>
      )}
    </RichPick>
  );
};

export default VoicingQuickPick;
