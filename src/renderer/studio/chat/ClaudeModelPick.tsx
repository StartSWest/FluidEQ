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
 * Which Claude model a piece of work runs on: the Studio's chat (Ivan,
 * 2026-10-09: "user needs to be able to pick the model and effort there") and
 * the admin's scene check (2026-11-11: "make sure list works same as in the
 * chat for studio that auto updates when new models come") pick from this one
 * list: every line Claude Code offers,
 * under the names it gives them in this run of the app (Ivan, 2026-11-09:
 * "make sure model list gets updated when app is restarted", "claude can
 * launch new models and we want to pick up smartly automatically"), "Default"
 * leaving it to whatever the member set in Claude Code. A line this app knew
 * of says what it is for in the member's language; one Anthropic added
 * since says it in Claude Code's own words. A known line the member's plan
 * does not include is in the list, said to be unavailable, and cannot be
 * chosen; a choice saved before its line became unavailable falls back to
 * Default, and its row says so. The app's dropdown: open, each model stands
 * over a line saying what it is for, and the closed trigger keeps the name
 * alone. Its owner keeps the pick.
 */
export default function ClaudeModelPick({
  value: model,
  onPick,
  disabled,
  className,
  menuClassName,
  placement = 'up',
}: {
  /** The model chosen; one no longer offered is shown as Default. */
  value: TStudioChatModel;
  onPick: (model: TStudioChatModel) => void;
  disabled: boolean;
  className?: string;
  menuClassName?: string;
  placement?: 'up' | 'down';
}) {
  const { t } = useTranslation();
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
      className={className}
      menuClassName={menuClassName}
      placement={placement}
      isDisabled={disabled}
      value={shown}
      options={[
        option('default', t('studioChat.modelDefault'), defaultHint, true),
        ...rows.map((row) =>
          option(row.line.id, row.line.name, hintOf(row), row.offered),
        ),
      ]}
      handleChange={(next) => {
        if (isStudioChatModel(next) && isStudioChatModelOffered(models, next)) {
          onPick(next);
        }
      }}
    />
  );
}
