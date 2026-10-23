/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { TranslationKey } from 'common/i18n';
import {
  STUDIO_CHAT_MODEL_VERSIONS,
  STUDIO_CHAT_MODELS,
  type TStudioChatModel,
} from 'common/studioChat';
import { useTranslation } from '../../utils/I18nContext';
import Dropdown from '../../widgets/Dropdown';
import { setStudioChatModel, useStudioChat } from './studioChatStore';

/** What each is for, under its name in the list. */
const MODEL_HINTS: Record<TStudioChatModel, TranslationKey> = {
  default: 'studioChat.modelHintDefault',
  fable: 'studioChat.modelHintFable',
  opus: 'studioChat.modelHintOpus',
  sonnet: 'studioChat.modelHintSonnet',
  haiku: 'studioChat.modelHintHaiku',
};

/**
 * Which Claude model works on the scene (Ivan, 2026-10-09: "user needs to be
 * able to pick the model and effort there"): Claude Code's own choices,
 * under their own names, "Default" leaving it to whatever the member set in
 * Claude Code. The app's dropdown, worn as a quiet word in the message box's
 * bar, as Claude's own box carries it; open, each model stands over a line
 * saying what it is for, and the closed trigger keeps the name alone. A pick takes effect with the next
 * message, on the same conversation.
 */
export default function StudioChatModelPick({
  disabled,
}: {
  disabled: boolean;
}) {
  const { t } = useTranslation();
  const { model } = useStudioChat();
  const label = (value: TStudioChatModel) =>
    value === 'default'
      ? t('studioChat.modelDefault')
      : STUDIO_CHAT_MODEL_VERSIONS[value].name;
  return (
    <Dropdown
      name={t('studioChat.model')}
      className="studio-chat__model"
      menuClassName="studio-chat__model-menu"
      placement="up"
      isDisabled={disabled}
      value={model}
      options={STUDIO_CHAT_MODELS.map((value) => ({
        value,
        label: label(value),
        display: (
          <span className="studio-chat__model-row">
            {label(value)}
            <small>{t(MODEL_HINTS[value])}</small>
          </span>
        ),
        group: t('studioChat.model'),
      }))}
      handleChange={(value) => {
        const next = STUDIO_CHAT_MODELS.find((known) => known === value);
        if (next) {
          setStudioChatModel(next);
        }
      }}
    />
  );
}
