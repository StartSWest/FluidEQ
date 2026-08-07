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

import { useEffect, useRef, useState } from 'react';
import { VOICING_PROFILES, getVoicingProfile } from 'common/voicing';
import VoicingIcon from '../icons/VoicingIcon';
import { useFluidEqContext } from '../utils/FluidEqContext';
import { useTranslation } from '../utils/I18nContext';
import AnchoredMenu, { isInsideAnchoredMenu } from '../widgets/AnchoredMenu';
import { setVoicing as setVoicingApi } from '../utils/equalizerApi';
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
  const { isBlockingError, isEnabled, voicing, setVoicing } =
    useFluidEqContext();
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const activeId = voicing?.profileId ?? '';
  const activeProfile = getVoicingProfile(activeId);

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
    const intensity = voicing?.intensity ?? 1;
    setVoicing({ profileId, intensity });
    try {
      await setVoicingApi(profileId, intensity);
    } catch {
      // Deliberately swallowed after reverting. This is an onClick handler, so
      // nothing is awaiting the rejection — rethrowing here would only produce
      // an unhandled promise rejection. Failing to switch voicing must also not
      // blank the workspace the way a global error would, and the trigger
      // snapping back to the previous profile is the feedback that matters.
      setVoicing(voicing ?? { profileId: '', intensity: 1 });
    }
  };

  return (
    <div className="voicing-pick" ref={rootRef}>
      <button
        type="button"
        className={`voicing-pick__trigger${activeProfile ? ' is-active' : ''}`}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label={
          activeProfile
            ? t('voicing.quickAria', { name: activeProfile.name })
            : t('voicing.quickNone')
        }
        title={
          activeProfile
            ? `${activeProfile.name} — ${activeProfile.tagline}`
            : t('voicing.quickTitle')
        }
        disabled={isBlockingError || !isEnabled}
        onClick={() => setIsOpen((current) => !current)}
      >
        <VoicingIcon profileId={activeProfile?.id} />
        <span>
          {activeProfile ? activeProfile.name : t('voicing.quickLabel')}
        </span>
        {/* It opens a menu, and nothing on it said so — it read as a button
            that does something, in a row of buttons that do. The same chevron
            the mode picker carries, turning over when it is open. */}
        <svg className="voicing-pick__caret" viewBox="0 0 16 16" aria-hidden>
          <path d="M4 6.5l4 4 4-4" />
        </svg>
      </button>

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

        {VOICING_PROFILES.map((profile) => (
          <button
            key={profile.id}
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
        ))}
      </AnchoredMenu>
    </div>
  );
};

export default VoicingQuickPick;
