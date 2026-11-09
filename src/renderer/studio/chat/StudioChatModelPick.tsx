/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { TranslationKey } from 'common/i18n';
import {
  isStudioChatModelOffered,
  STUDIO_CHAT_MODELS,
  type TStudioChatFamily,
  type TStudioChatModel,
} from 'common/studioChat';
import { useTranslation } from '../../utils/I18nContext';
import Dropdown from '../../widgets/Dropdown';
import { setStudioChatModel, useStudioChat } from './studioChatStore';
import { useStudioChatModels } from './studioChatModels';

/** What each line is for, under its name in the list: by line, so it never ages. */
const MODEL_HINTS: Record<TStudioChatFamily, TranslationKey> = {
  fable: 'studioChat.modelHintFable',
  opus: 'studioChat.modelHintOpus',
  sonnet: 'studioChat.modelHintSonnet',
  haiku: 'studioChat.modelHintHaiku',
};

/**
 * A line's own name, before Claude Code has ever said which model it is:
 * a brand, the same in every language.
 */
const LINE_NAMES: Record<TStudioChatFamily, string> = {
  fable: 'Fable',
  opus: 'Opus',
  sonnet: 'Sonnet',
  haiku: 'Haiku',
};

/**
 * Which Claude model works on the scene (Ivan, 2026-10-09: "user needs to be
 * able to pick the model and effort there"): Claude Code's own choices,
 * under the names Claude Code gives them in this run of the app (Ivan,
 * 2026-11-09: "make sure model list gets updated when app is restarted"),
 * "Default" leaving it to whatever the member set in Claude Code. A line the
 * member's plan does not include is in the list, said to be unavailable,
 * and cannot be chosen; a choice saved before it became unavailable falls
 * back to Default, and its row says so. The app's dropdown, worn as a quiet
 * word in the message box's bar, as Claude's own box carries it; open, each
 * model stands over a line saying what it is for, and the closed trigger
 * keeps the name alone. A pick takes effect with the next message, on the
 * same conversation.
 */
export default function StudioChatModelPick({
  disabled,
}: {
  disabled: boolean;
}) {
  const { t } = useTranslation();
  const { model } = useStudioChat();
  const models = useStudioChatModels();
  const shown: TStudioChatModel = isStudioChatModelOffered(models, model)
    ? model
    : 'default';
  const label = (value: TStudioChatModel) =>
    value === 'default'
      ? t('studioChat.modelDefault')
      : (models.names[value] ?? LINE_NAMES[value]);
  const hint = (value: TStudioChatModel) => {
    if (value === 'default') {
      return models.defaultName
        ? t('studioChat.modelHintDefaultNamed', { model: models.defaultName })
        : t('studioChat.modelHintDefault');
    }
    if (!isStudioChatModelOffered(models, value)) {
      return t(
        value === model
          ? 'studioChat.modelUnavailableChosen'
          : 'studioChat.modelUnavailable',
      );
    }
    return t(MODEL_HINTS[value]);
  };
  return (
    <Dropdown
      name={t('studioChat.model')}
      className="studio-chat__model"
      menuClassName="studio-chat__model-menu"
      placement="up"
      isDisabled={disabled}
      value={shown}
      options={STUDIO_CHAT_MODELS.map((value) => ({
        value,
        label: label(value),
        display: (
          <span className="studio-chat__model-row">
            {label(value)}
            <small>{hint(value)}</small>
          </span>
        ),
        group: t('studioChat.model'),
        isUnavailable: !isStudioChatModelOffered(models, value),
      }))}
      handleChange={(value) => {
        const next = STUDIO_CHAT_MODELS.find((known) => known === value);
        if (next && isStudioChatModelOffered(models, next)) {
          setStudioChatModel(next);
        }
      }}
    />
  );
}
