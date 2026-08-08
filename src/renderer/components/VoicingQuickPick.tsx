/*
<AQUA: System-wide parametric audio equalizer interface>
Copyright (C) <2023>  <AQUA Dev Team>

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

import { Fragment, useEffect, useRef, useState } from 'react';
import { VOICING_PROFILES, getVoicingProfile } from 'common/voicing';
import VoicingIcon from '../icons/VoicingIcon';
import { useFluidEqContext } from '../utils/FluidEqContext';
import { useTranslation } from '../utils/I18nContext';
import AnchoredMenu, { isInsideAnchoredMenu } from '../widgets/AnchoredMenu';
import {
  setLayerBypass,
  setVoicing as setVoicingApi,
} from '../utils/equalizerApi';
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
  const [isOpen, setIsOpen] = useState(false);
  /** A switch the engine refused, shown until the next attempt. */
  const [isRefused, setRefused] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }
    const close = (event: Event) => {
      // The menu is portalled out of the panel that clips, so it is no longer
      // inside the trigger and has to be asked about separately.
      if (
        !rootRef.current?.contains(event.target as Node) &&
        !isInsideAnchoredMenu(event.target)
      ) {
        setIsOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [isOpen]);

  const apply = async (profileId: string) => {
    setIsOpen(false);
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

  return (
    <div className="voicing-pick" ref={rootRef}>
      <button
        type="button"
        className={`voicing-pick__trigger${activeProfile ? ' is-active' : ''}${
          activeProfile && isVoicingBypassed ? ' is-bypassed' : ''
        }`}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label={
          activeProfile
            ? t('voicing.quickAria', {
                name: `${activeProfile.name} ${strengthPercent}%`,
              })
            : t('voicing.quickNone')
        }
        title={
          activeProfile
            ? `${activeProfile.name} · ${strengthPercent}% — ${activeProfile.tagline}`
            : t('voicing.quickTitle')
        }
        disabled={isBlockingError || !isEnabled}
        onClick={() => setIsOpen((current) => !current)}
      >
        <VoicingIcon profileId={activeProfile?.id} />
        <span>
          {activeProfile ? activeProfile.name : t('voicing.quickLabel')}
          {/* In a cell of a reserved width, which is the only reason it can be
              here at all. Appended as plain text it changed this button's width
              on every step of a drag, and this button sits in a row of eleven —
              so the whole toolbar shuffled sideways while you were aiming at
              one of them. */}
          {activeProfile && (
            <small className="voicing-pick__strength">{strengthPercent}%</small>
          )}
        </span>
        {/* It opens a menu, and nothing on it said so — it read as a button
            that does something, in a row of buttons that do. The same chevron
            the mode picker carries, turning over when it is open. */}
        <svg className="voicing-pick__caret" viewBox="0 0 16 16" aria-hidden>
          <path d="M4 6.5l4 4 4-4" />
        </svg>
      </button>

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

      {/* Out of the panel, because the panel clips — see AnchoredMenu. This one
          is as tall as the profile list, so near the bottom of a scrolled
          editor it was losing its last entries entirely. */}
      <AnchoredMenu
        anchor={rootRef.current}
        isOpen={isOpen}
        className="voicing-pick__menu"
      >
        <button
          type="button"
          role="menuitemradio"
          aria-checked={activeId === ''}
          className={`voicing-pick__item${activeId === '' ? ' is-active' : ''}`}
          onClick={() => apply('')}
        >
          <VoicingIcon profileId="none" />
          <span>
            <strong>{t('voicing.none')}</strong>
            <small>{t('voicing.quickNoneHint')}</small>
          </span>
        </button>

        {VOICING_PROFILES.map((profile, index) => (
          <Fragment key={profile.id}>
            {/* A heading at each change of group, rather than a fixed pair of
                sections, so adding a profile to either one cannot leave it
                filed under the wrong header. */}
            {profile.group !== VOICING_PROFILES[index - 1]?.group && (
              <span className="voicing-pick__group" role="presentation">
                {profile.group === 'genre'
                  ? t('voicing.groupGenre')
                  : t('voicing.groupPurpose')}
              </span>
            )}
            <button
              type="button"
              role="menuitemradio"
              aria-checked={activeId === profile.id}
              className={`voicing-pick__item${
                activeId === profile.id ? ' is-active' : ''
              }`}
              onClick={() => apply(profile.id)}
            >
              <VoicingIcon profileId={profile.id} />
              <span>
                <strong>{profile.name}</strong>
                <small>{profile.tagline}</small>
              </span>
            </button>
          </Fragment>
        ))}
      </AnchoredMenu>
    </div>
  );
};

export default VoicingQuickPick;
