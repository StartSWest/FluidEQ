/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import moon from '../../../../assets/tour/studio-moon.png';
import Glyph from '../../community/Glyph';
import { useTranslation } from '../../utils/I18nContext';

/**
 * A picture the AI made, opened from the chat and zoomed in: the moon every
 * new project starts with in its orb (`starterScene.ts`). On it the member's
 * marks draw themselves - a ring round a crater, an arrow, a word - and the
 * crop box closes in on them; the viewer's own tools and buttons stand
 * round it, Copy image and Attach to chat among them. Beside it the chat,
 * where the picture arrived and where the marked copy goes back with the
 * next message.
 *
 * One loop of CSS (`_tour-release24.scss`).
 */

const INKS = ['red', 'yellow', 'cyan', 'white'] as const;

export default function StudioPicturesVisual() {
  const { t } = useTranslation();
  return (
    <div
      className="pictures-visual"
      role="img"
      aria-label={t('tour.pictures.imageAlt')}
    >
      <div className="pictures-visual__viewer">
        <div className="pictures-visual__tools">
          <span className="pictures-visual__tool is-on">
            {t('studioChat.sketch.pen')}
          </span>
          <span className="pictures-visual__tool">
            <Glyph name="arrow-mark" />
            {t('studioChat.sketch.arrow')}
          </span>
          <span className="pictures-visual__tool">
            <Glyph name="text-mark" />
            {t('studioChat.sketch.text')}
          </span>
          <span className="pictures-visual__tool">
            <Glyph name="crop" />
            {t('studioChat.sketch.crop')}
          </span>
          <span className="pictures-visual__inks">
            {INKS.map((ink) => (
              <i key={ink} className={`is-${ink}`} />
            ))}
          </span>
        </div>

        <div className="pictures-visual__frame">
          <img className="pictures-visual__moon" src={moon} alt="" />
          <svg
            className="pictures-visual__marks"
            viewBox="0 0 160 90"
            preserveAspectRatio="xMidYMid slice"
            aria-hidden="true"
          >
            <ellipse
              className="pictures-visual__ring"
              cx="96"
              cy="54"
              rx="21"
              ry="17"
              pathLength={1}
            />
            <path
              className="pictures-visual__arrow"
              d="M30 22 C 46 26, 58 34, 70 45 M70 45 l-9 -1 M70 45 l-2 -8"
              pathLength={1}
            />
          </svg>
          <span className="pictures-visual__word">
            {t('tour.pictures.mark')}
          </span>
          <span className="pictures-visual__crop" />
          <span className="pictures-visual__zoom">
            <Glyph name="zoom-in" />
            220%
          </span>
        </div>

        <div className="pictures-visual__actions">
          <span className="button small subtle">
            <Glyph name="copy" />
            {t('studio.picture.copy')}
          </span>
          <span className="pictures-visual__copied">
            <Glyph name="check" />
            {t('studio.picture.copied')}
          </span>
          <span className="button small pictures-visual__attach">
            {t('studioChat.sketch.attach')}
          </span>
        </div>
      </div>

      <div className="pictures-visual__chat">
        <span className="chat-visual__thread pictures-visual__thread">
          <span className="chat-visual__me">{t('tour.pictures.ask')}</span>
          <span className="chat-visual__reply pictures-visual__made">
            <span className="pictures-visual__thumb">
              <img src={moon} alt="" />
              <Glyph name="expand" />
            </span>
            {t('tour.pictures.reply')}
          </span>
          <span className="chat-visual__me pictures-visual__back">
            <span className="pictures-visual__thumb is-marked">
              <img src={moon} alt="" />
            </span>
            {t('tour.pictures.followUp')}
          </span>
        </span>
      </div>
    </div>
  );
}
