/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import Glyph from '../../community/Glyph';
import { useTranslation } from '../../utils/I18nContext';

/**
 * The Studio's chat beside its stage: a request, the steps the reply takes
 * ticking in one by one, the new version landing with Bring back, and the
 * stage's lights starting to flash on the snare as version 2 plays — the
 * same exchange the Studio's own harness shows, in the chat's own words.
 * Under it the box, with the stage camera, the effort dots and the ring of
 * context used.
 *
 * One loop of CSS (`_tour-chat.scss`), each piece coming in at its own
 * share of it. Held on its last frame under reduced motion.
 */

/** The steps of the reply, in the order the harness's conversation takes them. */
const STEPS = [
  'studioChat.step.hear',
  'studioChat.step.write',
  'studioChat.step.look',
] as const;

export default function StudioChatVisual() {
  const { t } = useTranslation();
  return (
    <div
      className="chat-visual"
      role="img"
      aria-label={t('tour.chat.imageAlt')}
    >
      <div className="chat-visual__stage">
        <span className="chat-visual__scene" />
        <span className="chat-visual__lights" />
        <span className="chat-visual__v2-plays">
          <span className="chat-visual__flash" />
        </span>
        <span className="chat-visual__floor" />
        <span className="chat-visual__version">
          <span className="chat-visual__v1">v1</span>
          <span className="chat-visual__v2">v2</span>
        </span>
      </div>

      <div className="chat-visual__column">
        <span className="chat-visual__head">
          <i className="chat-visual__dot" />
          <span>
            <strong>{t('studioChat.title')}</strong>
            <small>{t('studioChat.wherePlan', { plan: 'Max' })}</small>
          </span>
          <Glyph name="more" className="chat-visual__more" />
        </span>

        <span className="chat-visual__thread">
          <span className="chat-visual__me">{t('tour.chat.ask')}</span>
          <span className="chat-visual__steps">
            {STEPS.map((step) => (
              <span key={step} className="chat-visual__step">
                <Glyph name="check" />
                {t(step, { file: 'scene.frag' })}
              </span>
            ))}
          </span>
          <span className="chat-visual__kept">
            <Glyph name="check" />
            <span>{t('studioChat.version', { version: 2 })}</span>
            <span className="chat-visual__back">
              {t('studioChat.bringBack')}
            </span>
          </span>
          <span className="chat-visual__reply">{t('tour.chat.reply')}</span>
        </span>

        <span className="chat-visual__box">
          <span className="chat-visual__placeholder">
            {t('studioChat.placeholder')}
          </span>
          <span className="chat-visual__tools">
            <Glyph name="camera" className="chat-visual__camera" />
            <span className="chat-visual__effort">
              <i />
              <i />
              <i />
              <i />
              <i />
              {t('studioChat.effortMedium')}
            </span>
            <span className="chat-visual__ring" />
          </span>
        </span>
      </div>
    </div>
  );
}
