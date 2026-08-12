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

import { useRef, useState } from 'react';
import {
  DISCLAIMER_ACCEPTED_KEY,
  DISCLAIMER_ACCEPT_LABEL,
  DISCLAIMER_DECLINE_LABEL,
  DISCLAIMER_HEADING,
  DISCLAIMER_PARAGRAPHS,
  buildAcceptance,
  readAcceptance,
} from 'common/disclaimer';
import { PRODUCT_VERSION } from 'common/branding';
import { useFocusLock } from '../utils/useFocusLock';
import '../styles/OverlayCard.scss';

/**
 * The first-run acknowledgement of the warranty and liability disclaimer.
 *
 * Shown once, before the app can be used, and not again unless the wording
 * itself changes. GPL-3.0 sections 15 and 16 have always been in `LICENSE`, in
 * every file header and on the installer's licence page; what none of those
 * gave was a moment where somebody read them and said so.
 *
 * ## The same words, in two places
 *
 * The text comes from `common/disclaimer`, which is also what the About panel's
 * disclaimer section renders. One array, so what a user agreed to and what they
 * can go back and re-read cannot drift apart. Untranslated, for the reason
 * given in that module and in the About panel: a mistranslated legal statement
 * still looks authoritative.
 *
 * ## What is recorded
 *
 * The wording's version, the app version that displayed it, and an ISO
 * timestamp — not a boolean. A boolean would stop the dialog reappearing and be
 * worth nothing afterwards; those three fields say which text was shown, by
 * which build, and when.
 *
 * Keyed on the wording's version so that changing what is being agreed to
 * asks again, and shipping an ordinary release does not.
 *
 * ## Both failure directions
 *
 * A record that cannot be read — absent, truncated, hand-edited, from a newer
 * wording — means the notice is shown. That is the opposite bias to the
 * mandatory-update check, on purpose: there the cheap mistake is not blocking,
 * here it is showing this twice.
 *
 * If storage refuses the write, the user is let through anyway. Being unable to
 * record the acknowledgement is not a reason to make the app unusable — but it
 * does mean the next launch asks again, which is the honest outcome.
 *
 * ## Quit
 *
 * Present because a notice you can only agree to is not a notice. It is the
 * quiet button, next to the one being asked for.
 *
 * ## Why this one keeps its focus lock and the update notice does not
 *
 * They are not the same kind of interruption. The update notice is about a
 * release that can be installed in ten minutes' time, so it closes and comes
 * back. This is the moment the terms are put in front of somebody, and a
 * version of it that could be tabbed past or dismissed with Escape would be a
 * notice nobody was shown. It is shown once per wording, so the cost of the
 * lock is paid once.
 */
const DisclaimerGate = () => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [isAccepted, setIsAccepted] = useState(() => {
    try {
      return (
        readAcceptance(window.localStorage.getItem(DISCLAIMER_ACCEPTED_KEY)) !==
        undefined
      );
    } catch {
      // Private mode, a locked-down profile, a test environment without
      // storage. Showing the notice is the right answer for all of them.
      return false;
    }
  });

  useFocusLock(dialogRef, !isAccepted);

  if (isAccepted) {
    return null;
  }

  const handleAccept = () => {
    try {
      window.localStorage.setItem(
        DISCLAIMER_ACCEPTED_KEY,
        JSON.stringify(buildAcceptance(PRODUCT_VERSION)),
      );
    } catch {
      // Recorded nowhere, so the next launch will ask again. Refusing to let
      // somebody in because their profile will not take a write would be
      // punishing them for the wrong thing.
    }
    setIsAccepted(true);
  };

  const handleDecline = () => {
    try {
      window.electron.ipcRenderer.closeApp();
    } catch {
      // Nothing sensible is left to do; the notice stays where it is.
    }
  };

  return (
    // `--locked` puts this above the update notice, which is the other user of
    // this stylesheet and which can be closed. When both are on screen the one
    // that cannot be dismissed has to be in front, or this component's focus
    // lock spends its time dragging focus out of a dialog drawn over the top
    // of it — and swallowing the Escape that dialog now closes on.
    <div
      className="overlay-card__backdrop overlay-card__backdrop--locked"
      role="presentation"
    >
      <div
        ref={dialogRef}
        className="overlay-card"
        // See the note in MandatoryUpdateModal: somewhere for focus to live
        // that is inside the dialog rather than on the document body.
        tabIndex={-1}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="disclaimer-title"
        aria-describedby="disclaimer-body"
      >
        <div className="overlay-card__header">
          <h2 id="disclaimer-title">{DISCLAIMER_HEADING}</h2>
        </div>

        <div className="overlay-card__body" id="disclaimer-body">
          {DISCLAIMER_PARAGRAPHS.map((paragraph) => (
            <p key={paragraph.slice(0, 40)}>{paragraph}</p>
          ))}
        </div>

        <div className="overlay-card__footer">
          <button
            type="button"
            className="overlay-card__button overlay-card__button--quiet"
            onClick={handleDecline}
          >
            {DISCLAIMER_DECLINE_LABEL}
          </button>
          <button
            type="button"
            className="overlay-card__button"
            onClick={handleAccept}
          >
            {DISCLAIMER_ACCEPT_LABEL}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DisclaimerGate;
