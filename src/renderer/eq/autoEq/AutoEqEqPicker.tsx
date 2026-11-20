/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useState } from 'react';
import log from 'electron-log/renderer';
import Chevron from '../../icons/Chevron';
import AnchoredMenu, { isInsideAnchoredMenu } from '../../widgets/AnchoredMenu';
import { useTranslation } from '../../utils/I18nContext';
import { countText } from '../../library/libraryFormat';
import { useSongSoundIndex } from '../../audio/songSoundIndex';
import { giveSavedEqToSong } from '../../audio/savedEqActions';
import AutoEqMiniCurve from './AutoEqMiniCurve';

/**
 * "Use a saved EQ", beside Save for this song while a song plays: the song
 * follows the saved EQ picked from here — Update the EQ and the song plays the
 * new sound too. The quiet style, Save for this song keeping the loud one; not
 * there at all until something is saved.
 */
const AutoEqEqPicker = ({ isDisabled }: { isDisabled: boolean }) => {
  const { t } = useTranslation();
  const { eqs } = useSongSoundIndex();
  const [isOpen, setIsOpen] = useState(false);
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }
    const onPointerDown = (event: MouseEvent) => {
      if (
        !isInsideAnchoredMenu(event.target) &&
        !anchor?.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    // Before the panel's own Escape, so only the list closes.
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopImmediatePropagation();
        setIsOpen(false);
        anchor?.focus();
      }
    };
    window.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      window.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown, true);
    };
  }, [anchor, isOpen]);

  if (eqs.length === 0) {
    return null;
  }

  return (
    <>
      <button
        ref={setAnchor}
        type="button"
        className="button small subtle"
        disabled={isDisabled}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
      >
        {t('autoEq.eqs.use')}
        <Chevron />
      </button>
      <AnchoredMenu
        anchor={anchor}
        isOpen={isOpen}
        className="band-menu eq-auto-eq-pick"
        ariaLabel={t('autoEq.eqs.use')}
      >
        {[...eqs]
          .sort((a, b) => b.updatedAt - a.updatedAt)
          .map((eq) => (
            <button
              key={eq.id}
              type="button"
              role="menuitem"
              onClick={() => {
                setIsOpen(false);
                giveSavedEqToSong(eq.id).catch((error: unknown) =>
                  log.error('A saved EQ could not be given to a song', error),
                );
              }}
            >
              <AutoEqMiniCurve
                filters={eq.sound.filters}
                width={44}
                height={18}
                className="eq-auto-eq-pick__curve"
              />
              <span className="eq-auto-eq-pick__name">{eq.name}</span>
              {eq.songCount > 0 && (
                <span className="eq-auto-eq-pick__count">
                  {countText(t, 'library.trackCount', eq.songCount)}
                </span>
              )}
            </button>
          ))}
      </AnchoredMenu>
    </>
  );
};

export default AutoEqEqPicker;
