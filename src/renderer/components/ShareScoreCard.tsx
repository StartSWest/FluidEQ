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

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  SHARE_NETWORKS,
  buildShareText,
  carriesShareText,
  getShareFileName,
  getShareUrl,
} from 'common/shareScore';
import { SUPPORT_CONFIG } from 'common/support';
import { useTranslation } from '../utils/I18nContext';
import '../styles/ShareScore.scss';

/**
 * Card size, in device-independent pixels.
 *
 * 1200×630 is the preview box every one of the three networks crops to. Any
 * other ratio gets cut somewhere, and it is never cut the same way twice.
 */
const CARD_WIDTH = 1200;
const CARD_HEIGHT = 630;

/** Drawn at 2x and scaled down, so the text is not soft on a HiDPI screen. */
const CARD_SCALE = 2;

/** How long the copy button stays confirmed before going back to its label. */
const COPIED_MS = 1600;

interface IShareScoreCardProps {
  score: number;
  /** Highest multiplier the run reached, for the line under the number. */
  multiplier: number;
  onClose: () => void;
}

/**
 * Paint the card.
 *
 * Canvas rather than rendering the DOM to an image: turning a live element
 * into a PNG means either a third-party rasteriser or an SVG foreignObject
 * round-trip, and both inherit whatever the app's stylesheet happens to be
 * doing that day. A card that is drawn on purpose looks the same in every
 * build, and it is about sixty lines.
 */
const drawCard = (
  canvas: HTMLCanvasElement,
  score: number,
  multiplier: number,
) => {
  const context = canvas.getContext('2d');
  if (!context) {
    return;
  }
  canvas.width = CARD_WIDTH * CARD_SCALE;
  canvas.height = CARD_HEIGHT * CARD_SCALE;
  context.scale(CARD_SCALE, CARD_SCALE);

  // The app's own background, so the card reads as coming from the thing it
  // is advertising rather than as a generic score graphic.
  const backdrop = context.createLinearGradient(0, 0, CARD_WIDTH, CARD_HEIGHT);
  backdrop.addColorStop(0, '#04090f');
  backdrop.addColorStop(1, '#0a1622');
  context.fillStyle = backdrop;
  context.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  // The spectrum, but as a band across the middle rather than over everything:
  // euphoria mode is the thing being shown off, and a full-bleed rainbow would
  // leave the number sitting on top of the brightest part of the card.
  const sweep = context.createLinearGradient(0, 0, CARD_WIDTH, 0);
  ['#00e5ff', '#54ff8a', '#ffe66d', '#ff3cac', '#8b5cff'].forEach(
    (color, index, all) => {
      sweep.addColorStop(index / (all.length - 1), color);
    },
  );

  // A waveform, because that is what the app draws and what the game is
  // played against. Deterministic — a fixed sum of sines rather than random
  // noise, so two people who scored the same get the same card.
  context.save();
  context.globalAlpha = 0.5;
  context.strokeStyle = sweep;
  context.lineWidth = 3;
  context.beginPath();
  for (let x = 0; x <= CARD_WIDTH; x += 4) {
    const phase = x / CARD_WIDTH;
    const envelope = Math.sin(phase * Math.PI);
    const wave =
      Math.sin(phase * 26) * 0.55 +
      Math.sin(phase * 61 + 1.1) * 0.28 +
      Math.sin(phase * 113 + 2.3) * 0.17;
    const y = CARD_HEIGHT * 0.72 + wave * envelope * 90;
    if (x === 0) {
      context.moveTo(x, y);
    } else {
      context.lineTo(x, y);
    }
  }
  context.stroke();
  context.restore();

  context.textAlign = 'center';

  context.fillStyle = 'rgba(226, 240, 247, 0.55)';
  context.font =
    '600 26px "Segoe UI", system-ui, -apple-system, Helvetica, sans-serif';
  context.fillText('FLUIDEQ · EUPHORIA MODE', CARD_WIDTH / 2, 132);

  context.fillStyle = '#ffffff';
  context.font =
    '800 190px "Segoe UI", system-ui, -apple-system, Helvetica, sans-serif';
  context.fillText(String(Math.max(0, Math.floor(score))), CARD_WIDTH / 2, 320);

  context.fillStyle = '#54ff8a';
  context.font =
    '750 54px "Segoe UI", system-ui, -apple-system, Helvetica, sans-serif';
  context.fillText(
    `×${Math.max(1, Math.floor(multiplier))}`,
    CARD_WIDTH / 2,
    392,
  );

  context.fillStyle = 'rgba(226, 240, 247, 0.7)';
  context.font =
    '400 28px "Segoe UI", system-ui, -apple-system, Helvetica, sans-serif';
  context.fillText(
    'Free, open-source system-wide EQ for Windows',
    CARD_WIDTH / 2,
    CARD_HEIGHT - 62,
  );
};

const ShareScoreCard = ({
  score,
  multiplier,
  onClose,
}: IShareScoreCardProps) => {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef<number | undefined>(undefined);

  const text = buildShareText(score, multiplier);
  const url = SUPPORT_CONFIG.repositoryUrl;

  useEffect(() => {
    if (canvasRef.current) {
      drawCard(canvasRef.current, score, multiplier);
    }
  }, [multiplier, score]);

  useEffect(
    () => () => {
      window.clearTimeout(copiedTimer.current);
    },
    [],
  );

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
    link.download = getShareFileName(score);
    link.click();
  }, [score]);

  const copy = useCallback(() => {
    navigator.clipboard
      .writeText(`${text} ${url}`)
      .then(() => {
        setCopied(true);
        window.clearTimeout(copiedTimer.current);
        copiedTimer.current = window.setTimeout(
          () => setCopied(false),
          COPIED_MS,
        );
        return undefined;
      })
      .catch(() => {
        // Nothing to recover: the text is on screen and selectable, so a
        // clipboard the browser refused is an inconvenience rather than a
        // dead end.
      });
  }, [text, url]);

  return (
    <div className="share-score">
      <div className="share-score__head">
        <h3>{t('support.game.shareTitle')}</h3>
        <button
          type="button"
          className="share-score__close"
          onClick={onClose}
          aria-label={t('support.close')}
        >
          <svg viewBox="0 0 12 12" aria-hidden="true">
            <path d="M3 3l6 6M9 3l-6 6" />
          </svg>
        </button>
      </div>

      {/* Shown at whatever width the dialog gives it. The canvas keeps its
          own 1200x630, so what is saved is the full-size card regardless of
          how small the preview is here.

          Hidden from assistive technology rather than labelled: everything
          drawn on it — the score, the multiplier, what the app is — is already
          on screen as text in the row above and in the note below, so
          announcing it again would read the same run out twice. */}
      <canvas ref={canvasRef} className="share-score__canvas" aria-hidden />

      <p className="share-score__note">{t('support.game.shareNote')}</p>

      <div className="share-score__actions">
        <button
          type="button"
          className="share-score__save"
          onClick={save}
          // Deliberately first and visually loudest. The image is the part
          // that cannot be automated, so it is the step most worth pointing
          // at before the network buttons take them away from the app.
        >
          {t('support.game.shareSave')}
        </button>
        <button type="button" className="share-score__copy" onClick={copy}>
          {copied ? t('support.game.shareCopied') : t('support.game.shareCopy')}
        </button>
      </div>

      <div className="share-score__networks">
        {SHARE_NETWORKS.map((network) => (
          <button
            key={network.id}
            type="button"
            className="share-score__network"
            // Opened through the window handler the shell already installs,
            // which denies the popup and hands the URL to the real browser.
            // A composer inside an equaliser would be asking to be logged
            // into, which is not a thing this app should ever want.
            onClick={() =>
              window.open(getShareUrl(network.id, text, url), '_blank')
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
    </div>
  );
};

export default ShareScoreCard;
