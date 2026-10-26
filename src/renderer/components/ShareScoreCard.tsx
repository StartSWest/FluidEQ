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

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  SHARE_NETWORKS,
  buildShareText,
  carriesShareText,
  getShareFileName,
  getShareUrl,
} from 'common/shareScore';
import { OFFICIAL_SITE_URL } from 'common/branding';
import MenuIcon from '../icons/MenuIcon';
import { useTranslation } from '../utils/I18nContext';
import isOwnAnimationEnd from '../utils/ownAnimationEnd';
import { useRainbowStops } from '../utils/rainbowPalette';
import { useLiveSurface } from '../utils/theme';
import DialogFrame from './DialogFrame';
import { drawShareCard, loadCardBackdrop } from './shareCardArt';
import '../styles/ShareScore.scss';

interface IShareScoreCardProps {
  score: number;
  /** Highest multiplier the run reached, for the line under the number. */
  multiplier: number;
  /**
   * Whether Colourful mode is on, which puts its palette in the card.
   *
   * Told rather than worked out from the multiplier, because the mode is a
   * switch of its own — on from the start since 2.0.
   */
  isEuphoric: boolean;
  onClose: () => void;
}

const ShareScoreCard = ({
  score,
  multiplier,
  isEuphoric,
  onClose,
}: IShareScoreCardProps) => {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Which button was pressed, not merely that one was. Two things can be
  // copied now and a shared boolean confirmed the wrong one.
  const [copied, setCopied] = useState<'card' | 'text' | ''>('');
  // Bumped per copy, so copying again while confirmed holds the word for its
  // own full moment rather than for what the last one had left.
  const [copiedSeq, setCopiedSeq] = useState(0);

  const text = buildShareText(score, multiplier, isEuphoric);
  // The site, not a releases page. A share post is read by people who have
  // never seen FluidEQ: `fluideq.com` is a name they can read off a screenshot
  // and type back in, which a host and a repository path with `/releases/latest`
  // on the end is not. It is also the one address that stays right if the
  // downloads ever move.
  const url = OFFICIAL_SITE_URL;

  // Drawn at once on its own gradient, and again over the artwork once that
  // is decoded — the first card of a session waits on nothing. Drawn again
  // when the window's colours change under it, since every colour on the
  // card is the window's.
  const stops = useRainbowStops();
  const accent = useLiveSurface('--accent', '');
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return undefined;
    }
    let isCurrent = true;
    drawShareCard(canvas, score, multiplier, url, isEuphoric, undefined);
    loadCardBackdrop()
      .then((artwork) =>
        isCurrent
          ? drawShareCard(canvas, score, multiplier, url, isEuphoric, artwork)
          : undefined,
      )
      .catch(() => {
        // The card on its own gradient is a whole card; nothing to recover.
      });
    return () => {
      isCurrent = false;
    };
  }, [isEuphoric, multiplier, score, url, stops, accent]);

  const save = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    // A data URL on a download link, rather than an IPC round-trip to write
    // the file from the main process. Chromium already knows where this user's
    // downloads go and will ask if they have said to ask, which is a better
    // answer than picking a directory for them.
    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    link.download = getShareFileName(score, isEuphoric);
    link.click();
  }, [isEuphoric, score]);

  const confirm = useCallback((which: 'card' | 'text') => {
    setCopied(which);
    setCopiedSeq((seq) => seq + 1);
  }, []);

  /**
   * The word that says it worked, for its moment.
   *
   * How long it stays is its own hold (`share-score-copied` in
   * `ShareScore.scss`), and the end of that is what puts the button's label
   * back. It was a timer beside it, which ran on behind a covered window and
   * took the word down before it could be read.
   */
  const confirmation = (text: string) => (
    <span
      key={copiedSeq}
      className="share-score__confirmed"
      onAnimationEnd={(event) => {
        if (isOwnAnimationEnd(event, 'share-score-copied')) {
          setCopied('');
        }
      }}
    >
      {text}
    </span>
  );

  /**
   * The image itself, on the clipboard.
   *
   * As close to automatic as any of the three allows. None of them will accept
   * an image through a share URL — they read the link and render their own
   * preview of it, and nothing in the query string can change that — so an
   * "attach automatically" button is not a thing that can be built. What can
   * be removed is every step between here and the composer: with the PNG on
   * the clipboard it goes in with one paste, no file dialog, no hunting
   * through a downloads folder for something saved thirty seconds ago.
   */
  const copyCard = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    canvas.toBlob((blob) => {
      if (!blob) {
        return;
      }
      navigator.clipboard
        .write([new ClipboardItem({ 'image/png': blob })])
        .then(() => confirm('card'))
        .catch(() => {
          // Refused clipboards are not a dead end: the card is on screen and
          // Save is right there, so this falls back to the manual path rather
          // than reporting a failure nobody can act on.
        });
    }, 'image/png');
  }, [confirm]);

  const copy = useCallback(() => {
    navigator.clipboard
      .writeText(`${text} ${url}`)
      .then(() => confirm('text'))
      .catch(() => {
        // Nothing to recover: the text is on screen and selectable, so a
        // clipboard the browser refused is an inconvenience rather than a
        // dead end.
      });
  }, [confirm, text, url]);

  return (
    <DialogFrame
      className="share-score"
      icon={<MenuIcon name="image" />}
      title={t('support.game.shareTitle')}
      titleId="share-score-title"
      description={t('support.game.shareNote')}
      closeLabel={t('support.close')}
      onClose={onClose}
      rail={
        // Where it goes, under what it is: each network gets the version
        // written for it — X is the one on a character budget, and the other
        // two read nothing like it.
        <div className="share-score__networks">
          {SHARE_NETWORKS.map((network) => (
            <button
              key={network.id}
              type="button"
              className="button small subtle"
              // Opened through the window handler the shell already
              // installs, which denies the popup and hands the URL to the
              // real browser. A composer inside an equaliser would be asking
              // to be logged into, which is not a thing this app should ever
              // want.
              onClick={() =>
                window.open(
                  getShareUrl(
                    network.id,
                    buildShareText(score, multiplier, isEuphoric, network.id),
                    url,
                  ),
                  '_blank',
                )
              }
              title={
                carriesShareText(network.id)
                  ? undefined
                  : t('support.game.shareLinkOnly')
              }
            >
              {network.label}
            </button>
          ))}
        </div>
      }
      footer={
        <div className="dialog-frame__actions">
          <button type="button" className="button small subtle" onClick={save}>
            {t('support.game.shareSave')}
          </button>
          <button type="button" className="button small subtle" onClick={copy}>
            {copied === 'text'
              ? confirmation(t('support.game.shareCopied'))
              : t('support.game.shareCopy')}
          </button>
          {/* The loud one, last: the shortest path there is. The networks
              cannot be handed an image by a link, so the best that can exist
              is the card already on the clipboard when the composer opens —
              one paste instead of a save, a file dialog and a hunt through a
              downloads folder. */}
          <button type="button" className="button small" onClick={copyCard}>
            {copied === 'card'
              ? confirmation(t('support.game.shareCardCopied'))
              : t('support.game.shareCopyCard')}
          </button>
        </div>
      }
    >
      {/* Shown at whatever width the dialog gives it. The canvas keeps its
          own 1200x630, so what is saved is the full-size card regardless of
          how small the preview is here.

          Hidden from assistive technology rather than labelled: everything
          drawn on it — the score, the multiplier, what the app is — is already
          on screen as text around it, so announcing it again would read the
          same run out twice. */}
      <canvas ref={canvasRef} className="share-score__canvas" aria-hidden />
    </DialogFrame>
  );
};

export default ShareScoreCard;
