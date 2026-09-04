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
import { OFFICIAL_SITE_URL, PRODUCT_NAME } from 'common/branding';
import { EYE_WAVE_AMPLITUDE, EYE_WAVE_PERIOD } from '../SupportPet';
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
  /**
   * Whether to draw the euphoria card.
   *
   * Told rather than worked out from the multiplier, because the mode can also
   * be switched on by somebody who reached the ceiling on an earlier run — the
   * switch only exists once it has been earned — and a card that refused to
   * show the look in that case would make the one thing worth sharing
   * unshareable.
   */
  isEuphoric: boolean;
  onClose: () => void;
}

/** The spectrum euphoria mode sweeps, in the order the app runs it. */
const SPECTRUM = ['#00e5ff', '#54ff8a', '#ffe66d', '#ff3cac', '#8b5cff'];

const FONT_STACK =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Ubuntu, Cantarell, "Noto Sans", "DejaVu Sans", sans-serif';

/**
 * Keep long scores inside their column without making ordinary runs look
 * timid. The card is generated from real scores, not a fixed demo value, so a
 * layout tuned only against "100" eventually turns a strong run into clipped
 * digits.
 */
const setFittedFont = (
  context: CanvasRenderingContext2D,
  text: string,
  weight: number,
  preferredSize: number,
  minimumSize: number,
  maximumWidth: number,
) => {
  context.font = `${weight} ${preferredSize}px ${FONT_STACK}`;
  const measuredWidth = context.measureText(text).width;
  const size = Math.max(
    minimumSize,
    Math.min(preferredSize, (preferredSize * maximumWidth) / measuredWidth),
  );
  context.font = `${weight} ${size}px ${FONT_STACK}`;
};

/**
 * The creature, drawn from the same coordinates her SVG uses.
 *
 * Her markup is a 40×40 viewBox of plain circles, arcs and one polygon, so
 * these are the same numbers transcribed rather than a second design — she
 * cannot end up looking like a different animal on the card than she does in
 * the app.
 *
 * Rasterising the live element was the alternative and it is a trap: her
 * appearance leans on the stylesheet for the glow, the hop and the eye waves,
 * and getting CSS into a canvas means an SVG foreignObject round-trip that
 * renders differently depending on what the app happened to be doing when the
 * button was pressed.
 */
const drawPet = (
  context: CanvasRenderingContext2D,
  centreX: number,
  centreY: number,
  size: number,
  euphoric: boolean,
) => {
  const scale = size / 40;
  context.save();
  context.translate(centreX - size / 2, centreY - size / 2);
  context.scale(scale, scale);

  const body = context.createLinearGradient(0, 11, 0, 37);
  body.addColorStop(0, '#7ef7e6');
  body.addColorStop(1, '#17a5c4');

  // The ears are a little EQ curve — she is made of the thing the app does,
  // and at this size that reads.
  context.strokeStyle = body;
  context.lineWidth = 3;
  context.lineCap = 'round';
  context.lineJoin = 'round';
  context.beginPath();
  context.moveTo(11, 12);
  context.lineTo(14, 6);
  context.lineTo(17, 12);
  context.moveTo(23, 12);
  context.lineTo(26, 8);
  context.lineTo(29, 12);
  context.stroke();

  context.fillStyle = body;
  context.beginPath();
  context.arc(20, 24, 12.5, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = '#06131d';
  [15.4, 24.6].forEach((x) => {
    context.beginPath();
    context.arc(x, 22, 3.4, 0, Math.PI * 2);
    context.fill();
  });

  // Sound reflected in the eye, at the ceiling only.
  //
  // The live creature runs a little waveform across each pupil, invisible at
  // rest and brightening with the streak — at x10 it is one of the clearest
  // signs the mode is on, and a card celebrating euphoria with dead black eyes
  // was missing the part people actually notice.
  //
  // Clipped to the pupil so it reads as something seen IN the eye rather than
  // drawn over it, and built from the same period and amplitude the SVG uses
  // so the two cannot drift into being different creatures. Frozen mid-scroll:
  // the live one animates, and a still image gets the frame it would have been
  // caught at.
  if (euphoric) {
    [15.4, 24.6].forEach((eyeX) => {
      context.save();
      context.beginPath();
      context.arc(eyeX, 22, 3.4, 0, Math.PI * 2);
      context.clip();

      const quarter = EYE_WAVE_PERIOD / 4;
      const start = eyeX - EYE_WAVE_PERIOD * 1.5;
      context.beginPath();
      context.moveTo(start, 22);
      for (let cycle = 0; cycle < 3; cycle += 1) {
        const x = start + cycle * EYE_WAVE_PERIOD;
        context.quadraticCurveTo(
          x + quarter,
          22 - EYE_WAVE_AMPLITUDE,
          x + quarter * 2,
          22,
        );
        context.quadraticCurveTo(
          x + quarter * 3,
          22 + EYE_WAVE_AMPLITUDE,
          x + quarter * 4,
          22,
        );
      }
      // The width and opacity the live one reaches at full joy, which is the
      // only state this ever draws in.
      context.strokeStyle = '#9cfff4';
      context.lineWidth = 0.9;
      context.lineCap = 'round';
      context.globalAlpha = 0.95;
      context.stroke();
      context.restore();
    });
  }

  context.fillStyle = '#ffffff';
  [16.4, 25.6].forEach((x) => {
    context.beginPath();
    context.arc(x, 21, 1.15, 0, Math.PI * 2);
    context.fill();
  });

  // Wider at the ceiling. The face is the app's own reaction to the run, and a
  // card celebrating euphoria under a polite half-smile undersells it.
  context.strokeStyle = '#06131d';
  context.lineWidth = 1.8;
  context.beginPath();
  context.moveTo(16.6, 28.4);
  context.quadraticCurveTo(20, euphoric ? 32.6 : 31.4, 23.4, 28.4);
  context.stroke();

  // The supporter's star. Always drawn here: only a supporter can open the
  // game, so anyone with a card to share has earned it.
  context.fillStyle = '#ffe66d';
  context.beginPath();
  [
    [31.5, 8.2],
    [32.7, 11],
    [35.6, 11.3],
    [33.4, 13.2],
    [34.1, 16],
    [31.5, 14.5],
    [28.9, 16],
    [29.6, 13.2],
    [27.4, 11.3],
    [30.3, 11],
  ].forEach(([x, y], index) => {
    if (index === 0) {
      context.moveTo(x, y);
    } else {
      context.lineTo(x, y);
    }
  });
  context.closePath();
  context.fill();

  context.restore();
};

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
  siteUrl: string,
  euphoric: boolean,
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
  backdrop.addColorStop(0.55, '#07111b');
  backdrop.addColorStop(1, '#0b1928');
  context.fillStyle = backdrop;
  context.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  // Two soft pools of colour give the artwork depth at feed-thumbnail size
  // without competing with the score. Their edges end inside the card, so the
  // spectrum rim stays crisp instead of turning into a general neon haze.
  const petGlow = context.createRadialGradient(255, 230, 20, 255, 230, 310);
  petGlow.addColorStop(0, 'rgba(53, 225, 214, 0.18)');
  petGlow.addColorStop(1, 'rgba(53, 225, 214, 0)');
  context.fillStyle = petGlow;
  context.fillRect(0, 0, 580, CARD_HEIGHT);

  const scoreGlow = context.createRadialGradient(820, 220, 20, 820, 220, 330);
  scoreGlow.addColorStop(
    0,
    euphoric ? 'rgba(139, 92, 255, 0.14)' : 'rgba(46, 197, 192, 0.1)',
  );
  scoreGlow.addColorStop(1, 'rgba(139, 92, 255, 0)');
  context.fillStyle = scoreGlow;
  context.fillRect(500, 0, 700, 520);

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

  // Faint guides make the spectrum feel like part of an equaliser rather than
  // decorative confetti. They stop before the footer so the address remains
  // the cleanest secondary element on the card.
  context.save();
  context.strokeStyle = 'rgba(226, 240, 247, 0.055)';
  context.lineWidth = 1;
  [390, 432, 474, 516].forEach((y) => {
    context.beginPath();
    context.moveTo(58, y);
    context.lineTo(CARD_WIDTH - 58, y);
    context.stroke();
  });
  context.restore();

  drawBands(context, euphoric, 532);

  // The game's own waveform, not a line graph of one.
  //
  // Mirrored about a centre and closed into a filled shape, which is how both
  // the trace in the game and the meter in the titlebar draw. A single stroked
  // curve was a different picture of the same idea, and the card is supposed to
  // look like what was on screen.
  //
  // Deterministic - a fixed sum of sines rather than noise - so two people who
  // scored the same get the same card.
  const waveCentre = 430;
  const amplitude = euphoric ? 40 : 30;
  const upper = [];
  const lower = [];
  for (let x = 0; x <= CARD_WIDTH; x += 4) {
    const phase = x / CARD_WIDTH;
    const envelope = Math.sin(phase * Math.PI);
    const wave =
      Math.sin(phase * 26) * 0.55 +
      Math.sin(phase * 61 + 1.1) * 0.28 +
      Math.sin(phase * 113 + 2.3) * 0.17;
    const offset = wave * envelope * amplitude;
    upper.push([x, waveCentre - offset]);
    lower.push([x, waveCentre + offset]);
  }
  context.save();
  context.beginPath();
  upper.forEach(([x, y], index) => {
    if (index === 0) {
      context.moveTo(x, y);
    } else {
      context.lineTo(x, y);
    }
  });
  lower.reverse().forEach(([x, y]) => context.lineTo(x, y));
  context.closePath();
  context.fillStyle = euphoric ? sweep : '#2ec5c0';
  context.globalAlpha = euphoric ? 0.42 : 0.26;
  context.fill();
  context.globalAlpha = euphoric ? 0.95 : 0.6;
  context.strokeStyle = euphoric ? sweep : '#2ec5c0';
  context.lineWidth = 3;
  context.lineJoin = 'round';
  context.stroke();
  context.restore();

  // She goes on the left with the numbers to her right, rather than everything
  // stacked down one column. 1200x630 is a wide letterbox and a single centred
  // stack leaves two big empty margins - and she is the most recognisable
  // thing the app has, so she earns half the frame.
  // The small wordmark means the card still identifies the product when a
  // social feed crops its footer. Its waveform is the same visual language as
  // the full trace below, not a second logo competing for attention.
  context.save();
  context.strokeStyle = euphoric ? '#7ef7e6' : '#54d9d2';
  context.lineWidth = 5;
  context.lineCap = 'round';
  context.beginPath();
  context.moveTo(70, 74);
  context.bezierCurveTo(82, 48, 95, 48, 108, 74);
  context.bezierCurveTo(121, 100, 134, 100, 148, 74);
  context.stroke();
  context.fillStyle = '#ffffff';
  context.font = `700 40px ${FONT_STACK}`;
  context.textAlign = 'left';
  context.fillText(PRODUCT_NAME, 168, 88);
  context.fillStyle = 'rgba(226, 240, 247, 0.48)';
  context.font = `700 18px ${FONT_STACK}`;
  context.letterSpacing = '3px';
  context.fillText('BEAT GAME', 170, 117);
  context.restore();

  drawPet(context, 268, 250, 258, euphoric);

  const column = 824;
  context.textAlign = 'center';

  // The pill, drawn the way the app draws it, because it is the badge the
  // whole post is about.
  if (euphoric) {
    const label = 'RAINBOW MODE';
    context.font = `700 27px ${FONT_STACK}`;
    const pillWidth = context.measureText(label).width + 56;
    context.save();
    context.fillStyle = sweep;
    context.beginPath();
    context.roundRect(column - pillWidth / 2, 70, pillWidth, 52, 26);
    context.fill();
    context.fillStyle = '#06131d';
    context.fillText(label, column, 105);
    context.restore();
  } else {
    context.fillStyle = 'rgba(226, 240, 247, 0.55)';
    context.font = `700 24px ${FONT_STACK}`;
    context.fillText('GREAT RUN', column, 105);
  }

  context.fillStyle = 'rgba(226, 240, 247, 0.48)';
  context.font = `700 20px ${FONT_STACK}`;
  context.letterSpacing = '5px';
  context.fillText('SCORE', column, 163);

  const scoreText = String(Math.max(0, Math.floor(score)));
  context.fillStyle = '#ffffff';
  context.letterSpacing = '0px';
  setFittedFont(context, scoreText, 900, 150, 92, 500);
  context.fillText(scoreText, column, 295);

  context.fillStyle = euphoric ? '#ffe66d' : '#54ff8a';
  context.font = `900 48px ${FONT_STACK}`;
  context.fillText(`×${Math.max(1, Math.floor(multiplier))}`, column, 354);

  context.fillStyle = 'rgba(226, 240, 247, 0.52)';
  context.font = `700 17px ${FONT_STACK}`;
  context.letterSpacing = '3px';
  context.fillText('STREAK MULTIPLIER', column, 384);

  // Where to get it. The point of the post is that somebody who has never
  // heard of FluidEQ sees the picture and can act on it, and a card that shows
  // off a mode without saying what the app is called or where it lives is an
  // advert for nothing. Drawn on the image rather than left to the link
  // preview, because the image is what gets reposted and screenshotted.
  context.save();
  context.fillStyle = 'rgba(3, 8, 14, 0.84)';
  context.beginPath();
  context.roundRect(52, 548, CARD_WIDTH - 104, 58, 18);
  context.fill();
  context.strokeStyle = 'rgba(226, 240, 247, 0.11)';
  context.lineWidth = 1;
  context.stroke();

  context.textAlign = 'left';
  context.fillStyle = 'rgba(226, 240, 247, 0.78)';
  context.font = `600 24px ${FONT_STACK}`;
  context.letterSpacing = '0px';
  context.fillText('Free system-wide EQ for Windows', 82, 586);

  const displayUrl = siteUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
  context.textAlign = 'right';
  context.fillStyle = euphoric ? '#7ef7e6' : '#54d9d2';
  context.font = `700 30px ${FONT_STACK}`;
  context.fillText(displayUrl, CARD_WIDTH - 82, 587);
  context.restore();
};

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
  const copiedTimer = useRef<number | undefined>(undefined);

  const text = buildShareText(score, multiplier, isEuphoric);
  // The site, not a releases page. A share post is read by people who have
  // never seen FluidEQ: `fluideq.com` is a name they can read off a screenshot
  // and type back in, which a host and a repository path with `/releases/latest`
  // on the end is not. It is also the one address that stays right if the
  // downloads ever move.
  const url = OFFICIAL_SITE_URL;

  useEffect(() => {
    if (canvasRef.current) {
      drawCard(canvasRef.current, score, multiplier, url, isEuphoric);
    }
  }, [isEuphoric, multiplier, score, url]);

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
    link.download = getShareFileName(score, isEuphoric);
    link.click();
  }, [isEuphoric, score]);

  const confirm = useCallback((which: 'card' | 'text') => {
    setCopied(which);
    window.clearTimeout(copiedTimer.current);
    copiedTimer.current = window.setTimeout(() => setCopied(''), COPIED_MS);
  }, []);

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

      {/* Says why this card is the plain one, for anyone who has only ever
          seen it plain. The euphoric version is a different picture entirely —
          spectrum rim, the pill, the bands lit hue by hue — and without this
          there is nothing to suggest the card has another form, let alone what
          it costs. Only ever shown below the ceiling: at the ceiling they are
          looking at it. */}
      {!isEuphoric && (
        <p className="share-score__unlock">{t('support.game.shareUnlock')}</p>
      )}

      <p className="share-score__note">{t('support.game.shareNote')}</p>

      <div className="share-score__actions">
        <button
          type="button"
          className="share-score__save"
          onClick={copyCard}
          // First and loudest, because it is the shortest path there is. The
          // networks cannot be handed an image by a link, so the best that can
          // exist is the card already on the clipboard when the composer
          // opens — one paste instead of a save, a file dialog and a hunt
          // through a downloads folder.
        >
          {copied === 'card'
            ? t('support.game.shareCardCopied')
            : t('support.game.shareCopyCard')}
        </button>
        <button type="button" className="share-score__copy" onClick={save}>
          {t('support.game.shareSave')}
        </button>
        <button type="button" className="share-score__copy" onClick={copy}>
          {copied === 'text'
            ? t('support.game.shareCopied')
            : t('support.game.shareCopy')}
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
            // Each network gets the version written for it: X is the one on a
            // character budget, and the other two read nothing like it.
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
    </div>
  );
};

export default ShareScoreCard;
