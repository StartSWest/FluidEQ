/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import alpine from '../../../../assets/tour/scene-alpine.jpg';
import aurora from '../../../../assets/tour/scene-aurora.jpg';
import neonCity from '../../../../assets/tour/scene-neon-city.jpg';
import type { TranslationKey } from '../../../common/i18n';
import Glyph from '../../community/Glyph';
import { useTranslation } from '../../utils/I18nContext';

/**
 * The Studio's AI at work on three scenes at once, each its own chat: two
 * still working, one just kept as a new version. In the open chat, the
 * card that asks before ChatGPT paints a picture for the scene - the one
 * question the chat puts to the member, since the AI is held to the scene's
 * own files (`chatSandbox.ts`) - and beside it the menu that picks the model and the effort - the models
 * as Claude Code names them. Under the scenes, the skills FluidEQ ships
 * with the app, which every chat reads.
 *
 * One loop of CSS (`_tour-release24b.scss`).
 */

interface IScene {
  name: string;
  picture: string;
  /** Still working, or kept as this version. */
  version?: number;
}

const SCENES: readonly IScene[] = [
  { name: 'Alpine', picture: alpine },
  { name: 'Neon City', picture: neonCity },
  { name: 'Aurora', picture: aurora, version: 7 },
];

const MODELS: readonly { name: string; hint: TranslationKey }[] = [
  { name: 'Fable 5.1', hint: 'studioChat.modelHintFable' },
  { name: 'Opus 5.5', hint: 'studioChat.modelHintOpus' },
  { name: 'Sonnet 5.5', hint: 'studioChat.modelHintSonnet' },
  { name: 'Haiku 5.5', hint: 'studioChat.modelHintHaiku' },
];

const SKILLS: readonly TranslationKey[] = [
  'tour.ai.skillWorlds',
  'tour.ai.skillPhotos',
  'tour.ai.skillAnimation',
];

export default function StudioAiVisual() {
  const { t } = useTranslation();
  return (
    <div className="ai-visual" role="img" aria-label={t('tour.ai.imageAlt')}>
      <div className="ai-visual__scenes">
        {SCENES.map((scene) => (
          <span
            key={scene.name}
            className={`ai-visual__scene${scene.version ? ' is-kept' : ''}`}
          >
            <img src={scene.picture} alt="" />
            <span className="ai-visual__scene-text">
              <strong>{scene.name}</strong>
              {scene.version ? (
                <small>
                  <Glyph name="check" />
                  {t('studioChat.version', { version: scene.version })}
                </small>
              ) : (
                <small>
                  <i className="ai-visual__spinner" />
                  {t('studioChat.step.otherNow')}
                </small>
              )}
            </span>
          </span>
        ))}
        <span className="ai-visual__skills">
          <span className="ai-visual__skills-title">{t('tour.ai.skills')}</span>
          {SKILLS.map((skill) => (
            <span key={skill} className="ai-visual__skill">
              {t(skill)}
            </span>
          ))}
        </span>
      </div>

      <div className="ai-visual__chat">
        <span className="ai-visual__ask">
          <strong>{t('studioChat.ask.pictureTitle')}</strong>
          <small>
            {t('studioChat.ask.pictureSize', { width: 1024, height: 1024 })}
            {' · '}
            {t('studioChat.ask.transparent')}
          </small>
          <small>{t('studioChat.ask.cost')}</small>
          <span className="ai-visual__ask-buttons">
            <span className="button small">{t('studioChat.ask.makeIt')}</span>
            <span className="button small subtle">
              {t('studioChat.ask.allowChat')}
            </span>
            <span className="button small subtle">
              {t('studioChat.ask.notNow')}
            </span>
          </span>
        </span>

        <span className="ai-visual__menu">
          <span className="ai-visual__menu-title">{t('studioChat.model')}</span>
          {MODELS.map((model, index) => (
            <span
              key={model.name}
              className={`ai-visual__model${index === 1 ? ' is-chosen' : ''}`}
            >
              <strong>{model.name}</strong>
              <small>{t(model.hint)}</small>
              {index === 1 && <Glyph name="check" />}
            </span>
          ))}
          <span className="ai-visual__menu-title">
            {t('studioChat.effort')}
          </span>
          <span className="ai-visual__effort">
            <i className="is-on" />
            <i className="is-on" />
            <i className="is-on" />
            <i className="is-on" />
            <i />
            {t('studioChat.effortHigh')}
          </span>
        </span>
      </div>
    </div>
  );
}
