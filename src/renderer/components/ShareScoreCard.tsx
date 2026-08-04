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
  isEuphoricRun,
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

/** The spectrum euphoria mode sweeps, in the order the app runs it. */
const SPECTRUM = ['#00e5ff', '#54ff8a', '#ffe66d', '#ff3cac', '#8b5cff'];

const FONT_STACK =
  '"Segoe UI", system-ui, -apple-system, Helvetica, sans-serif';

/**
 * The bar of sliders along the bottom.
 *
 * The single most recognisable thing about the app, and the thing euphoria
 * mode does the most to: each band lit in its own colour, its own height. It
 * is what makes the card read as a screenshot of something rather than as a
 * scoreboard, which is the whole reason anyone would look twice at the post.
 *
 * Deterministic, like the waveform: a fixed shape rather than random heights,
 * so the card is the same picture every time it is generated.
 */
const drawBands = (
  context: CanvasRenderingContext2D,
  euphoric: boolean,
  baseline: number,
) => {
  const count = 31;
  const gap = 7;
  const margin = 90;
  const span = CARD_WIDTH - margin * 2;
  const width = (span - gap * (count - 1)) / count;
  for (let index = 0; index < count; index += 1) {
    const phase = index / (count - 1);
    // Two humps and a tilt: enough shape to look like music was playing rather
    // than like a test pattern.
    const height =
      22 +
      Math.abs(Math.sin(phase * 5.6)) * 52 +
      Math.abs(Math.sin(phase * 2.1 + 0.7)) * 34;
    const x = margin + index * (width + gap);
    if (euphoric) {
      // Each band on its own hue, walking the spectrum across the row —
      // exactly what the live UI does at the ceiling.
      const stop = phase * (SPECTRUM.length - 1);
      context.fillStyle = SPECTRUM[Math.round(stop)];
      context.globalAlpha = 0.92;
    } else {
      context.fillStyle = '#2ec5c0';
      context.globalAlpha = 0.5;
    }
    context.fillRect(x, baseline - height, width, height);
  }
  context.globalAlpha = 1;
};

/**
 * Paint the card.
 *
 * Canvas rather than rendering the DOM to an image: turning a live element
 * into a PNG means either a third-party rasteriser or an SVG foreignObject
 * round-trip, and both inherit whatever the app's stylesheet happens to be
 * doing that day. A card that is drawn on purpose looks the same in every
 * build.
 *
 * At the ceiling it stops being a scoreboard and becomes a picture of euphoria
 * mode: spectrum rim, the pill, and the band row lit hue by hue the way the
 * live UI lights it. That is the point of the post — somebody scrolling past
 * has never seen this app, and a number on a dark rectangle tells them nothing
 * about what they are looking at.
 */
const drawCard = (
  canvas: HTMLCanvasElement,
  score: number,
  multiplier: number,
  downloadUrl: string,
) => {
  const context = canvas.getContext('2d');
  if (!context) {
    return;
  }
  const euphoric = isEuphoricRun(multiplier);
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

  const sweep = context.createLinearGradient(0, 0, CARD_WIDTH, 0);
  SPECTRUM.forEach((color, index) => {
    sweep.addColorStop(index / (SPECTRUM.length - 1), color);
  });

  // The rim, at the ceiling only. A spectrum edge around the whole card is
  // what euphoria mode looks like from across the room, and it is the part
  // that survives being shown as a thumbnail in a feed.
  if (euphoric) {
    context.save();
    context.strokeStyle = sweep;
    context.lineWidth = 10;
    context.strokeRect(5, 5, CARD_WIDTH - 10, CARD_HEIGHT - 10);
    context.restore();
  }

  drawBands(context, euphoric, CARD_HEIGHT - 104);

  // A waveform, because that is what the app draws and what the game is
  // played against. Deterministic — a fixed sum of sines rather than random
  // noise, so two people who scored the same get the same card.
  context.save();
  context.globalAlpha = euphoric ? 0.85 : 0.45;
  context.strokeStyle = euphoric ? sweep : '#2ec5c0';
  context.lineWidth = euphoric ? 4 : 3;
  context.beginPath();
  for (let x = 0; x <= CARD_WIDTH; x += 4) {
    const phase = x / CARD_WIDTH;
    const envelope = Math.sin(phase * Math.PI);
    const wave =
      Math.sin(phase * 26) * 0.55 +
      Math.sin(phase * 61 + 1.1) * 0.28 +
      Math.sin(phase * 113 + 2.3) * 0.17;
    const y = 462 + wave * envelope * (euphoric ? 46 : 34);
    if (x === 0) {
      context.moveTo(x, y);
    } else {
      context.lineTo(x, y);
    }
  }
  context.stroke();
  context.restore();

  context.textAlign = 'center';

  // The pill, drawn the way the app draws it, because it is the badge the
  // whole post is about.
  if (euphoric) {
    const label = 'EUPHORIA MODE';
    context.font = `800 30px ${FONT_STACK}`;
    const pillWidth = context.measureText(label).width + 56;
    const pillX = (CARD_WIDTH - pillWidth) / 2;
    context.save();
    context.fillStyle = sweep;
    context.beginPath();
    context.roundRect(pillX, 92, pillWidth, 54, 27);
    context.fill();
    context.fillStyle = '#06131d';
    context.fillText(label, CARD_WIDTH / 2, 129);
    context.restore();
  } else {
    context.fillStyle = 'rgba(226, 240, 247, 0.55)';
    context.font = `600 26px ${FONT_STACK}`;
    context.fillText('FLUIDEQ · BEAT GAME', CARD_WIDTH / 2, 129);
  }

  context.fillStyle = '#ffffff';
  context.font = `800 172px ${FONT_STACK}`;
  context.fillText(String(Math.max(0, Math.floor(score))), CARD_WIDTH / 2, 306);

  context.fillStyle = euphoric ? '#ffe66d' : '#54ff8a';
  context.font = `750 56px ${FONT_STACK}`;
  context.fillText(
    `×${Math.max(1, Math.floor(multiplier))}`,
    CARD_WIDTH / 2,
    374,
  );

  // Where to get it. The point of the post is that somebody who has never
  // heard of FluidEQ sees the picture and can act on it, and a card that shows
  // off a mode without saying what the app is called or where it lives is an
  // advert for nothing. Drawn on the image rather than left to the link
  // preview, because the image is what gets reposted and screenshotted.
  context.fillStyle = 'rgba(226, 240, 247, 0.82)';
  context.font = `600 30px ${FONT_STACK}`;
  context.fillText(
    'FluidEQ — free system-wide EQ for Windows',
    CARD_WIDTH / 2,
    552,
  );

  context.fillStyle = 'rgba(226, 240, 247, 0.5)';
  context.font = `400 24px ${FONT_STACK}`;
  context.fillText(
    downloadUrl.replace(/^https?:\/\//, ''),
    CARD_WIDTH / 2,
    590,
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
  // The releases page, not the source tree. A share post is read by people
  // who have never seen FluidEQ, and sending them somewhere they have to work
  // out how to build it wastes the only click they were going to give.
  const url = SUPPORT_CONFIG.downloadUrl;

  useEffect(() => {
    if (canvasRef.current) {
      drawCard(canvasRef.current, score, multiplier, url);
    }
  }, [multiplier, score, url]);

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
    link.download = getShareFileName(score, multiplier);
    link.click();
  }, [multiplier, score]);

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
