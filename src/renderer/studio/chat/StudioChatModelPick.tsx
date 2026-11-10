/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { TranslationKey } from 'common/i18n';
import {
  isStudioChatFamily,
  isStudioChatModel,
  isStudioChatModelOffered,
  STUDIO_CHAT_FAMILIES,
  type IStudioChatLine,
  type IStudioChatModels,
  type TStudioChatFamily,
  type TStudioChatModel,
} from 'common/studioChat';
import { useTranslation } from '../../utils/I18nContext';
import Dropdown from '../../widgets/Dropdown';
import { setChatModel, useChatPicks } from './chatPicks';
import { useStudioChatModels } from './studioChatModels';

/** What each line this app knows of is for, in the member's language. */
const MODEL_HINTS: Record<TStudioChatFamily, TranslationKey> = {
  fable: 'studioChat.modelHintFable',
  opus: 'studioChat.modelHintOpus',
  sonnet: 'studioChat.modelHintSonnet',
  haiku: 'studioChat.modelHintHaiku',
};

/**
 * A known line's own name, before Claude Code has ever said which model it
 * is, or where the member's plan does not include it: a brand, the same in
 * every language.
 */
const LINE_NAMES: Record<TStudioChatFamily, string> = {
  fable: 'Fable',
  opus: 'Opus',
  sonnet: 'Sonnet',
  haiku: 'Haiku',
};

/** A row of the list: a line, and whether it is one this member can use. */
interface IRow {
  line: IStudioChatLine;
  offered: boolean;
}

/**
 * The rows, in Claude Code's own order: every line it offered - a family
 * added after this app was built among them - and then each line this app
 * knows of that it did not offer, which this account cannot use. Before it
 * has ever answered, the known lines under their bare names.
 */
const rowsOf = ({ checked, lines }: IStudioChatModels): IRow[] => {
  if (!checked) {
    return STUDIO_CHAT_FAMILIES.map((id) => ({
      line: { id, name: LINE_NAMES[id] },
      offered: true,
    }));
  }
  const missing = STUDIO_CHAT_FAMILIES.filter(
    (id) => !lines.some((line) => line.id === id),
  );
  return [
    ...lines.map((line) => ({ line, offered: true })),
    ...missing.map((id) => ({
      line: { id, name: LINE_NAMES[id] },
      offered: false,
    })),
  ];
};

/**
 * Which Claude model works on the scene (Ivan, 2026-10-09: "user needs to be
 * able to pick the model and effort there"): every line Claude Code offers,
 * under the names it gives them in this run of the app (Ivan, 2026-11-09:
 * "make sure model list gets updated when app is restarted", "claude can
 * launch new models and we want to pick up smartly automatically"), "Default"
 * leaving it to whatever the member set in Claude Code. A line this app knew
 * of says what it is for in the member's language; one Anthropic added
 * since says it in Claude Code's own words. A known line the member's plan
 * does not include is in the list, said to be unavailable, and cannot be
 * chosen; a choice saved before its line became unavailable falls back to
 * Default, and its row says so. The app's dropdown, worn as a quiet word in
 * the message box's bar, as Claude's own box carries it; open, each model
 * stands over a line saying what it is for, and the closed trigger keeps the
 * name alone. A pick takes effect with the next message, on the same
 * conversation.
 */
export default function StudioChatModelPick({
  chatKey,
  disabled,
}: {
  /** The chat whose model this is: each chat keeps its own. */
  chatKey?: string;
  disabled: boolean;
}) {
  const { t } = useTranslation();
  const { model } = useChatPicks(chatKey);
  const models = useStudioChatModels();
  const rows = rowsOf(models);
  const shown: TStudioChatModel = isStudioChatModelOffered(models, model)
    ? model
    : 'default';
  const hintOf = ({ line, offered }: IRow) => {
    if (!offered) {
      return t(
        line.id === model
          ? 'studioChat.modelUnavailableChosen'
          : 'studioChat.modelUnavailable',
      );
    }
    return isStudioChatFamily(line.id)
      ? t(MODEL_HINTS[line.id])
      : line.description;
  };
  const defaultHint = models.defaultName
    ? t('studioChat.modelHintDefaultNamed', { model: models.defaultName })
    : t('studioChat.modelHintDefault');
  const option = (
    value: TStudioChatModel,
    label: string,
    hint: string | undefined,
    offered: boolean,
  ) => ({
    value,
    label,
    display: (
      <span className="studio-chat__model-row">
        {label}
        {hint && <small>{hint}</small>}
      </span>
    ),
    group: t('studioChat.model'),
    isUnavailable: !offered,
  });
  return (
    <Dropdown
      name={t('studioChat.model')}
      className="studio-chat__model"
      menuClassName="studio-chat__model-menu"
      placement="up"
      isDisabled={disabled}
      value={shown}
      options={[
        option('default', t('studioChat.modelDefault'), defaultHint, true),
        ...rows.map((row) =>
          option(row.line.id, row.line.name, hintOf(row), row.offered),
        ),
      ]}
      handleChange={(value) => {
        if (
          isStudioChatModel(value) &&
          isStudioChatModelOffered(models, value)
        ) {
          setChatModel(chatKey, value);
        }
      }}
    />
  );
}
