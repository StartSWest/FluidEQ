/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A model the member may pick in the chat (Ivan, 2026-10-09: "user needs to
 * be able to pick the model and effort"): `default`, which passes nothing
 * and leaves Claude Code on whatever the member set for it; a line by
 * Claude Code's own name for it - `haiku` - which Claude Code resolves to
 * that line's newest model; or an exact model - `claude-haiku-4-5-20251001`
 * - from the other versions Claude Code lists. Any line Claude Code offers,
 * not only the ones this app knew of when it was built (Ivan, 2026-11-09:
 * "claude can launch new models and we want to pick up smartly
 * automatically"), held to one of those two shapes everywhere it crosses
 * into a command line.
 */
export type TStudioChatModel = string;

/**
 * A line's name as Claude Code takes it: lower case, a word or two, no
 * version, and Claude Code's own `[1m]` for the long-context variant.
 */
const LINE_NAME = /^[a-z][a-z0-9-]{0,31}(\[1m\])?$/;
/** An exact model as Claude Code takes it (`claude-fable-5-2`). */
const EXACT_NAME = /^claude-[a-z0-9-]{1,60}(\[1m\])?$/;

/** Whether `value` names one exact model rather than a line. */
export const isStudioChatExactModel = (value: string) => EXACT_NAME.test(value);

export const isStudioChatModel = (value: unknown): value is TStudioChatModel =>
  typeof value === 'string' &&
  (value.startsWith('claude-')
    ? EXACT_NAME.test(value)
    : LINE_NAME.test(value));

/**
 * The lines there were when this was written, each with its own words in
 * every language (`studioChat.modelHint*`). Each is always offered under
 * its own name, which Claude Code resolves to the line's newest model -
 * Fable 5.3 needs nothing here - whatever Claude Code's list held: a list
 * without `fable` in it is not a plan without Fable. A line Claude Code
 * adds later is offered all the same, in Claude Code's own words.
 */
export const STUDIO_CHAT_FAMILIES = [
  'fable',
  'opus',
  'sonnet',
  'haiku',
] as const;
export type TStudioChatFamily = (typeof STUDIO_CHAT_FAMILIES)[number];

export const isStudioChatFamily = (value: string): value is TStudioChatFamily =>
  (STUDIO_CHAT_FAMILIES as readonly string[]).includes(value);

/** An exact model's line and version: `claude-fable-5-2` is Fable 5.2. */
export interface IStudioChatExactModel {
  family: string;
  /** Each part of the version, most significant first: `[5, 2]`. */
  version: number[];
}

/** `claude-fable-5-2`, `claude-haiku-4-5-20251001`, `claude-opus-4`. */
const EXACT_NEW = /^claude-([a-z]+)-(\d{1,3})(?:-(\d{1,2}))?(?:-\d{8})?$/;
/** The older order: `claude-3-5-sonnet-20241022`, `claude-3-opus-20240229`. */
const EXACT_OLD = /^claude-(\d{1,3})(?:-(\d{1,2}))?-([a-z]+)(?:-\d{8})?$/;

const versionOf = (major: string, minor: string | undefined) =>
  minor === undefined ? [Number(major)] : [Number(major), Number(minor)];

/**
 * The line and version an exact model belongs to, or undefined for a name
 * of neither known order (or a long-context `[1m]` variant, which is not
 * the line's own model).
 */
export const exactStudioChatModelOf = (
  id: string,
): IStudioChatExactModel | undefined => {
  const recent = EXACT_NEW.exec(id);
  if (recent) {
    return { family: recent[1], version: versionOf(recent[2], recent[3]) };
  }
  const old = EXACT_OLD.exec(id);
  return old
    ? { family: old[3], version: versionOf(old[1], old[2]) }
    : undefined;
};

/** Which of two versions is newer: positive when `a` is. */
export const compareStudioChatVersions = (a: number[], b: number[]) => {
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    const step = (a[index] ?? 0) - (b[index] ?? 0);
    if (step !== 0) {
      return step;
    }
  }
  return 0;
};

/** One line Claude Code offers: its name for it, and the model's name and words. */
export interface IStudioChatLine {
  id: TStudioChatModel;
  name: string;
  description?: string;
}

/**
 * What Claude Code says it offers (Ivan, 2026-11-09: "make sure model list
 * gets updated when app is restarted"; and 2026-10-09: "we need to show
 * models version, like opus 5.5"): each line's model under its own name -
 * "Haiku 5.5" - read from Claude Code at the first picker of each run of
 * the app and again whenever Claude Code changes
 * (`main/studioChat/claudeModels.ts`), so the list names the model that
 * answers and never ages. It used to be a table of exact versions written
 * into the app, and it went on offering Haiku 4.5 after 5.5 shipped.
 *
 * `lines` are the lines Claude Code offered, in its own order, a family it
 * added after this app was built among them; a known line it listed only by
 * another id stands there under its own name, named for that model, and the
 * id it was listed by is one of its `standIns`. `others` are the other
 * versions Claude Code offers (Ivan, 2026-11-25: "the other models ... in
 * every version"), by line and newest first. `checked`: Claude Code has
 * answered at least once, ever.
 *
 * Nothing here says a model is out of the member's plan except `refused`:
 * the models Claude Code itself refused in this run of the app, from the
 * error it ended a reply with (`chatStop.ts`). A known line missing from
 * the answer used to be read as one the plan lacked, and on a Max account
 * whose answer listed Fable by its exact model the chat called Fable "not on
 * your Claude plan" and would not start it (2026-11-25).
 */
export interface IStudioChatModels {
  checked: boolean;
  lines: IStudioChatLine[];
  others?: IStudioChatLine[];
  /**
   * The ids Claude Code listed a line by, where it gave the line's own name
   * no entry: `claude-fable-5-2[1m]` for Fable. The line's name starts the
   * same model (`fable` and that id both start Fable 5.2 with a million
   * tokens of context, asked of Claude Code 2.1.332), so a chat that chose
   * one of them chose the line, and the picker shows it on the line's row.
   */
  standIns?: { id: TStudioChatModel; line: TStudioChatModel }[];
  /** The model `default` starts, by its name, where Claude Code said it. */
  defaultName?: string;
  /** Refused by Claude Code in this run of the app; never kept. */
  refused?: TStudioChatModel[];
  /**
   * The account the answer came from, as Claude Code named it in the same
   * answer; never kept, so it is only ever this run's. `plan` is Claude
   * Code's own name for the plan ("Ultra"), which `claude auth status`
   * does not carry: it reports the plan's kind ("max"), and an Ultra
   * account read as "Max plan" in the chat's head (2026-11-25).
   */
  account?: { email?: string; plan?: string };
}

/**
 * A plan's name as Claude Code's `initialize` answer gives it ("Claude
 * Ultra", "Claude Max"), without the brand: "Ultra". Undefined for anything
 * else, and for "Claude API", which is what it says of an account with no
 * plan at all.
 */
export const claudePlanNameOf = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }
  const named = /^Claude ([\p{L}\p{N}][\p{L}\p{N} +.-]{0,29})$/u.exec(value);
  return named && named[1] !== 'API' ? named[1] : undefined;
};

export const NO_STUDIO_CHAT_MODELS: IStudioChatModels = {
  checked: false,
  lines: [],
};

/**
 * The model a choice stands for: the line, for an id Claude Code listed
 * that line by (`standIns`); the choice itself otherwise.
 */
export const studioChatLineOf = (
  models: IStudioChatModels,
  model: TStudioChatModel,
): TStudioChatModel =>
  (models.standIns ?? []).find(({ id }) => id === model)?.line ?? model;

/**
 * Whether `model` can be started here: `default` always; anything Claude
 * Code refused in this run, never; a line this app knows of, or anything
 * Claude Code listed, otherwise.
 */
export const isStudioChatModelOffered = (
  models: IStudioChatModels,
  model: TStudioChatModel,
) =>
  model === 'default' ||
  (!(models.refused ?? []).includes(model) &&
    (isStudioChatFamily(model) ||
      models.lines.some(({ id }) => id === model) ||
      (models.others ?? []).some(({ id }) => id === model) ||
      (models.standIns ?? []).some(({ id }) => id === model)));
