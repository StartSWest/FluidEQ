/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import Glyph from '../../community/Glyph';
import AnimationView from '../../studio/animations/AnimationView';
import useAnimationPlayer from '../../studio/animations/useAnimationPlayer';
import type { IViewedAnimation } from '../../studio/animations/useStudioAnimations';
import { useTranslation } from '../../utils/I18nContext';
import useTourSwallow from './useTourSwallow';

/**
 * The Studio's Animations tab with the starter's swallow opened: the tab's
 * own view, its own player and its own frames (`AnimationView`), on the Sky
 * it was made for, every frame in the strip under it. Under it the scene's
 * own chat, which makes, fixes and checks a scene's animations: the ask,
 * the steps it takes - all eight frames looked at side by side, the one
 * that jumps found, that one put back in line - and its answer. The thread
 * comes in on the 2.1 chat picture's loop (`_tour-chat.scss`).
 *
 * Inert: the transport would play, but a picture on a slide is not a place
 * to work.
 */

/** The frame the chat finds out of line, counted from one. */
const JUMPING_FRAME = 4;

function Opened({ viewed }: { viewed: IViewedAnimation }) {
  const player = useAnimationPlayer(viewed);
  return <AnimationView viewed={viewed} player={player} />;
}

export default function StudioAnimationsVisual() {
  const { t } = useTranslation();
  const swallow = useTourSwallow();
  const name = 'swallow-flight';
  const steps = [
    t('tour.animations.stepLook', { count: 8 }),
    t('tour.animations.stepJump', { frame: JUMPING_FRAME }),
    t('tour.animations.stepFix', { frame: JUMPING_FRAME }),
  ];

  return (
    <div
      className="anim-visual"
      role="img"
      aria-label={t('tour.animations.imageAlt')}
    >
      <div className="anim-visual__tab" inert>
        <div className="anim-visual__tabs">
          <span>{t('studio.work.make')}</span>
          <span>{t('studio.work.pictures')}</span>
          <span className="is-on">{t('studio.work.animations')}</span>
          <span>{t('studio.work.tune')}</span>
        </div>
        <div className="anim-visual__crumb">
          <Glyph name="previous" />
          <span>{t('studio.animation.back')}</span>
          <strong>{name}</strong>
          <small>{t('studio.animation.meta', { count: 8, fps: 10 })}</small>
        </div>
        {swallow ? (
          <Opened viewed={swallow} />
        ) : (
          <span className="anim-visual__waiting" />
        )}
      </div>

      <div className="chat-visual__column anim-visual__chat">
        <span className="chat-visual__head">
          <i className="chat-visual__dot" />
          <span>
            <strong>{t('studioChat.title')}</strong>
            <small>{t('studioChat.wherePlan', { plan: 'Max' })}</small>
          </span>
          <Glyph name="more" className="chat-visual__more" />
        </span>

        <span className="chat-visual__thread">
          <span className="chat-visual__me anim-visual__task">
            {t('tour.animations.task')}
          </span>
          <span className="chat-visual__steps">
            {steps.map((step) => (
              <span key={step} className="chat-visual__step">
                <Glyph name="check" />
                {step}
              </span>
            ))}
          </span>
          <span className="chat-visual__reply">
            {t('tour.animations.reply')}
          </span>
        </span>

        <span className="chat-visual__box">
          <span className="chat-visual__placeholder">
            {t('studioChat.placeholder')}
          </span>
        </span>
      </div>
    </div>
  );
}
