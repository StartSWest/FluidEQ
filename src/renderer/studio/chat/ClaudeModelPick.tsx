/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect } from 'react';
import type { TranslationKey } from 'common/i18n';
import {
  isStudioChatFamily,
  isStudioChatModel,
  isStudioChatModelOffered,
  studioChatLineOf,
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
 * A known line's own name, where Claude Code has not said which model it
 * is: a brand, the same in every language.
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
 * The main rows, in Claude Code's own order: every line it offered - a
 * family added after this app was built among them - and then each line
 * this app knows of that it did not name, under its bare name. Every one of
 * them can be picked: Claude Code resolves a line's own name to its newest
 * model, and only Claude Code refusing one (`refused`) marks it unavailable.
 */
const rowsOf = (models: IStudioChatModels): IRow[] => {
  const missing = STUDIO_CHAT_FAMILIES.filter(
    (id) => !models.lines.some((line) => line.id === id),
  );
  return [
    ...models.lines,
    ...missing.map((id) => ({ id, name: LINE_NAMES[id] })),
  ].map((line) => ({
    line,
    offered: isStudioChatModelOffered(models, line.id),
  }));
};

/** The other versions Claude Code listed, each once and apart from the rows. */
const othersOf = (models: IStudioChatModels, rows: IRow[]): IRow[] =>
  (models.others ?? [])
    .filter(({ id }) => !rows.some((row) => row.line.id === id))
    .map((line) => ({
      line,
      offered: isStudioChatModelOffered(models, line.id),
    }));

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
 * since says it in Claude Code's own words. The other versions Claude Code
 * lists stand under their own heading below the lines (Ivan, 2026-11-25:
 * "the other models ... in every version"). A model Claude Code refused in
 * this run is in the list, said to be unavailable, and cannot be chosen; a
 * choice of it falls back to Default, and its row says so. Nothing else
 * makes a row unavailable: a line missing from Claude Code's answer was
 * read as one the plan lacked, and a Max account was told Fable was not on
 * its plan (2026-11-25). A choice of an id Claude Code listed a line by
 * (`standIns`: `claude-fable-5-2[1m]`, which the picker once showed as a
 * second Fable under the other versions) is that line's row, and is kept
 * as the line from then on. The app's dropdown: open, each model stands
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
  const others = othersOf(models, rows);
  const chosen = studioChatLineOf(models, model);
  const shown: TStudioChatModel = isStudioChatModelOffered(models, chosen)
    ? chosen
    : 'default';
  // A chat that chose the id Claude Code listed a line by keeps the line
  // itself from now on: it then follows the line to its next model, where
  // the id would be dropped from the list and the chat moved to Default.
  useEffect(() => {
    if (chosen !== model) {
      onPick(chosen);
    }
  }, [chosen, model, onPick]);
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
    group = t('studioChat.model'),
  ) => ({
    value,
    label,
    display: (
      <span className="studio-chat__model-row">
        {label}
        {hint && <small>{hint}</small>}
      </span>
    ),
    group,
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
        ...others.map((row) =>
          option(
            row.line.id,
            row.line.name,
            hintOf(row),
            row.offered,
            t('studioChat.modelOthers'),
          ),
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
