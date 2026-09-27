/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useTranslation } from '../utils/I18nContext';

/** The name of the fade that takes the notice away (`Karaoke.scss`). */
export const SET_ASIDE_NOTICE_LEAVE = 'karaoke-notice-leave';

interface IKaraokeSetAsideNoticeProps {
  /** What the import could not use, already said in the reader's language. */
  text: string;
  onDismiss: () => void;
}

/**
 * What an import set aside, said once and then gone (Ivan, 2026-09-27: "this
 * warning needs to be closable and to auto disappear after a few seconds").
 *
 * Its own fade is what takes it away: the stylesheet holds it for a few
 * seconds and fades it, pausing while the pointer rests on it or a key is on
 * its button, and the fade's end is the event that removes it. No script
 * clock decides when. The cross removes it at once.
 */
export default function KaraokeSetAsideNotice({
  text,
  onDismiss,
}: IKaraokeSetAsideNoticeProps) {
  const { t } = useTranslation();
  return (
    <div
      className="karaoke-workspace__notice is-warning is-passing"
      role="status"
      onAnimationEnd={(event) => {
        if (event.animationName === SET_ASIDE_NOTICE_LEAVE) {
          onDismiss();
        }
      }}
    >
      <span className="karaoke-workspace__notice-text">{text}</span>
      <button
        type="button"
        className="karaoke-workspace__notice-close"
        aria-label={t('app.dismiss')}
        onClick={onDismiss}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M7 7l10 10M17 7L7 17" />
        </svg>
      </button>
    </div>
  );
}
