/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  accountEmailOf,
  claudePlanNameOf,
  compareStudioChatVersions,
  exactStudioChatModelOf,
  isStudioChatExactModel,
  isStudioChatFamily,
  isStudioChatModel,
  type IStudioChatExactModel,
  type IStudioChatLine,
  type IStudioChatModels,
  type TStudioChatModel,
} from '../../common/studioChat';

/**
 * Claude Code's answer to the `initialize` request, read as the list the
 * Studio's pickers show (`claudeModels.ts` asks it).
 *
 * Claude Code answers in one of two shapes, and the same Claude Code gives
 * either from one run to the next. Answering from its served catalog (on
 * 2026-11-09 with 2.1.321, and at 23:56 on 2026-11-27 with 2.1.332), every
 * entry is named with its version ("Opus 5.5") and the older versions are
 * listed beside the lines. Without it (2.1.332 at 23:21 and 23:31 that
 * night, its own debug log saying `[servedCatalog] off (flag)`), the
 * answer is the list compiled into Claude Code: a line's name without its
 * version ("Opus", the version only at the head of its words, "Opus 5.5 ·
 * Best for everyday, complex tasks"), Fable listed only as
 * `claude-fable-5-2[1m]`, and nothing older.
 *
 * The cause of what Ivan saw that night: the picker showed the second
 * shape as it came - no version on any line, and Fable twice, once as the
 * app's own bare row for a line the answer seemed not to name and once
 * under "Other versions" - because a name was taken as given and a `[1m]`
 * id was not read as the line it stands for. Both shapes are read the same
 * way here: each entry by the model it starts (`resolvedModel`), named
 * with that model's version.
 */

/** The control request's id, so its answer is told from anything else. */
export const MODELS_REQUEST_ID = 'fluideq-models';
/** No more lines than a list can show; Claude Code offers four or five. */
const MOST_LINES = 12;
/** The other versions, apart, so a long history never pushes a line out. */
const MOST_OTHERS = 24;
/** What Claude Code puts between a model's name and its words. */
const HEAD = ' · ';
/** Claude Code's mark for a model's long-context variant. */
const LONG = /\[1m\]$/;
/** A version written as a word of its own: "4", "5.5", "Opus 4.8". */
const VERSION_WORD = /(?:^|\s)\d{1,3}(?:\.\d{1,3})*(?=$|[\s)])/;

export const isRecord = (raw: unknown): raw is Record<string, unknown> =>
  typeof raw === 'object' && raw !== null && !Array.isArray(raw);

/** A model's name as it may be shown: short and printable, or nothing. */
export const nameOf = (raw: unknown) =>
  typeof raw === 'string' && /^[\p{L}\p{N} .()-]{1,40}$/u.test(raw)
    ? raw
    : undefined;

/** What a model is for, in Claude Code's words: a line of plain text, or nothing. */
const descriptionOf = (raw: unknown) =>
  typeof raw === 'string' && /^[\p{L}\p{N} .,·:;'’()/&+-]{1,120}$/u.test(raw)
    ? raw
    : undefined;

/** A line by its own name: `opus`, `mythos`; never a version or a variant. */
export const isLineName = (id: TStudioChatModel) =>
  !isStudioChatExactModel(id) && !LONG.test(id);

/** The exact model an id starts, from Claude Code's word for it or the id. */
const startedBy = (id: string, resolved: unknown): string | undefined => {
  if (typeof resolved === 'string' && isStudioChatExactModel(resolved)) {
    return resolved.replace(LONG, '');
  }
  return isStudioChatExactModel(id) ? id.replace(LONG, '') : undefined;
};

/**
 * The head of a model's words where it is the model's name with its
 * version: "Opus 5.5" of "Opus 5.5 · Best for everyday, complex tasks".
 */
const headNameOf = (words: string | undefined) => {
  const [head] = words?.split(HEAD) ?? [];
  return head !== undefined && head !== words && VERSION_WORD.test(head)
    ? nameOf(head)
    : undefined;
};

/**
 * A model's name with its version: Claude Code's own name where it carries
 * one ("Haiku 4.5"); that name with the version of the model it starts
 * where its first word is that model's line ("Opus" starting
 * claude-opus-5-5 is "Opus 5.5", "Opus (1M context)" is "Opus 5.5 (1M
 * context)"); else the head of its words, where that is the name with a
 * version.
 */
const versionedName = (
  shown: string,
  model: IStudioChatExactModel | undefined,
  words: string | undefined,
) => {
  if (VERSION_WORD.test(shown)) {
    return shown;
  }
  const [first = '', ...rest] = shown.split(' ');
  if (model && first.toLowerCase() === model.family) {
    const named = nameOf([first, model.version.join('.'), ...rest].join(' '));
    if (named) {
      return named;
    }
  }
  const head = headNameOf(words);
  return head?.startsWith(`${shown} `) ? head : shown;
};

/** A model's words without the head its name already says. */
const wordsAfter = (name: string, words: string | undefined) => {
  const [head] = words?.split(HEAD) ?? [];
  if (
    head === undefined ||
    head === words ||
    (name !== head && !name.startsWith(`${head} `))
  ) {
    return words;
  }
  return words?.slice(head.length + HEAD.length) || undefined;
};

/** One entry of the answer: its line, and the model it starts. */
interface IEntry {
  line: IStudioChatLine;
  model?: IStudioChatExactModel;
  /** The exact model, to tell two entries that start one model. */
  started?: string;
}

/** An entry from Claude Code's fields for it, when every part is one. */
const entryOf = ({
  value,
  displayName,
  description,
  resolvedModel,
}: Record<string, unknown>): IEntry | undefined => {
  const shown = nameOf(displayName);
  if (!isStudioChatModel(value) || value === 'default' || !shown) {
    return undefined;
  }
  const started = startedBy(value, resolvedModel);
  const model = started ? exactStudioChatModelOf(started) : undefined;
  const words = descriptionOf(description);
  const name = versionedName(shown, model, words);
  const said = wordsAfter(name, words);
  return {
    line: { id: value, name, ...(said ? { description: said } : {}) },
    ...(model ? { model } : {}),
    ...(started ? { started } : {}),
  };
};

/**
 * Each id once and each name once, at most `most` of them, in the order
 * given, and none a row of `beside` already shows: two rows of one name
 * are one model to the member, whichever ids Claude Code gave them.
 */
const distinct = <T extends { line: IStudioChatLine }>(
  items: T[],
  most: number,
  beside: IStudioChatLine[] = [],
) =>
  items
    .filter(
      ({ line }) =>
        !beside.some(({ id, name }) => id === line.id || name === line.name),
    )
    .filter(
      ({ line }, index, all) =>
        all.findIndex(
          (other) => other.line.id === line.id || other.line.name === line.name,
        ) === index,
    )
    .slice(0, most);

/** The line and version an id belongs to, for putting versions in order. */
const placeOf = (id: TStudioChatModel) => {
  const exact = exactStudioChatModelOf(id.replace(LONG, ''));
  return exact ?? { family: id.replace(LONG, ''), version: [] };
};

/**
 * The other versions by line, in the order the lines stand, and newest
 * first within a line: Claude Code's own catalog lists them as Fable 5.1,
 * Haiku 4.5, Sonnet 5, Opus 5, Fable 5, Opus 4.8 ..., which is no order a
 * member can find a model in. A line not shown stands after, in the order
 * it first came.
 */
export const inVersionOrder = (
  lines: IStudioChatLine[],
  others: IStudioChatLine[],
) => {
  const families = lines.map(({ id }) => id);
  others.forEach(({ id }) => {
    const { family } = placeOf(id);
    if (!families.includes(family)) {
      families.push(family);
    }
  });
  return others
    .map((line, index) => ({ line, index, ...placeOf(line.id) }))
    .sort(
      (a, b) =>
        families.indexOf(a.family) - families.indexOf(b.family) ||
        compareStudioChatVersions(b.version, a.version) ||
        a.index - b.index,
    )
    .map(({ line }) => line);
};

/**
 * The list from the answer's entries: the lines by their own names, each
 * known line Claude Code listed only by another id under its own name (its
 * newest such model's name and words, the id kept as a stand-in), and
 * every other version apart.
 *
 * A line is started by its own name, which Claude Code resolves to its
 * newest model, so `fable` stands for `claude-fable-5-2` and will stand for
 * 5.3 without a change here. An unknown family listed only by exact models
 * keeps them as versions: nothing says Claude Code takes its bare name.
 * `named` is every line Claude Code named, shown or not: a line whose own
 * entry was unreadable is offered under its bare name, never as an older
 * model its name would not start.
 */
const listOf = (given: IEntry[], named: Set<string>) => {
  const newest = new Map<string, { id: string; version: number[] }>();
  given.forEach(({ line, model }) => {
    if (
      isLineName(line.id) ||
      !model ||
      !isStudioChatFamily(model.family) ||
      named.has(model.family)
    ) {
      return;
    }
    const best = newest.get(model.family);
    if (!best || compareStudioChatVersions(model.version, best.version) > 0) {
      newest.set(model.family, { id: line.id, version: model.version });
    }
  });
  const standIns = [...newest].map(([line, { id }]) => ({ id, line }));
  const lines: IEntry[] = [];
  const others: IEntry[] = [];
  given.forEach((entry) => {
    const standIn = standIns.find(({ id }) => id === entry.line.id);
    if (isLineName(entry.line.id) || standIn) {
      lines.push(
        standIn
          ? { ...entry, line: { ...entry.line, id: standIn.line } }
          : entry,
      );
      return;
    }
    others.push(entry);
  });
  const shownLines = distinct(lines, MOST_LINES);
  return {
    lines: shownLines,
    others: distinct(
      others,
      MOST_OTHERS,
      shownLines.map(({ line }) => line),
    ),
    standIns,
  };
};

/** The answer's account: its email and Claude Code's name for its plan. */
const accountOf = (raw: unknown): IStudioChatModels['account'] => {
  if (!isRecord(raw)) {
    return undefined;
  }
  const email = accountEmailOf(raw.email);
  const plan = claudePlanNameOf(raw.subscriptionType);
  return email || plan
    ? { ...(email ? { email } : {}), ...(plan ? { plan } : {}) }
    : undefined;
};

/** What Claude Code said, and which Claude Code said it ("2.1.332"). */
export interface IClaudeCodeAnswer {
  models: IStudioChatModels;
  version?: string;
}

/**
 * The list in Claude Code's answer to the `initialize` request, from one
 * line of what it wrote; undefined for any other line, or an answer of a
 * shape this does not know. Read as untrusted, like every line of its
 * output.
 */
export const readClaudeCodeAnswer = (
  line: string,
): IClaudeCodeAnswer | undefined => {
  let raw: unknown;
  try {
    raw = JSON.parse(line);
  } catch {
    return undefined;
  }
  if (!isRecord(raw) || raw.type !== 'control_response') {
    return undefined;
  }
  const outer = raw.response;
  if (!isRecord(outer) || outer.request_id !== MODELS_REQUEST_ID) {
    return undefined;
  }
  const inner = isRecord(outer.response) ? outer.response : outer;
  if (!Array.isArray(inner.models)) {
    return undefined;
  }
  const entries = inner.models.filter(isRecord);
  const { lines, others, standIns } = listOf(
    entries
      .map(entryOf)
      .filter((entry): entry is IEntry => entry !== undefined),
    new Set(
      entries
        .map(({ value }) => value)
        .filter(
          (value): value is string =>
            isStudioChatModel(value) && isLineName(value),
        ),
    ),
  );
  // What `default` starts, by the name of a row that starts the same model,
  // or by the head of its own words ("Opus 5.5 · Best for ...").
  const fallback = entries.find(({ value }) => value === 'default');
  const fallbackStarts =
    fallback && startedBy('default', fallback.resolvedModel);
  const same = fallbackStarts
    ? [...lines, ...others].find(({ started }) => started === fallbackStarts)
    : undefined;
  const defaultName =
    same?.line.name ?? headNameOf(descriptionOf(fallback?.description));
  const account = accountOf(inner.account);
  const shownLines = lines.map(({ line }) => line);
  const shownOthers = inVersionOrder(
    shownLines,
    others.map(({ line }) => line),
  );
  const version =
    typeof inner.claude_code_version === 'string' &&
    /^\d{1,4}(?:\.\d{1,6}){1,3}$/.test(inner.claude_code_version)
      ? inner.claude_code_version
      : undefined;
  return {
    models: {
      checked: true,
      lines: shownLines,
      ...(shownOthers.length > 0 ? { others: shownOthers } : {}),
      ...(standIns.length > 0 ? { standIns } : {}),
      ...(defaultName ? { defaultName } : {}),
      ...(account ? { account } : {}),
    },
    ...(version ? { version } : {}),
  };
};

/** The list alone in Claude Code's answer (`readClaudeCodeAnswer`). */
export const readModelsAnswer = (line: string) =>
  readClaudeCodeAnswer(line)?.models;

/**
 * The list with the older versions Claude Code's own catalog lists
 * (`claudeCatalog.ts`), each once, beside what its answer listed and in
 * version order.
 */
export const withOlderVersions = (
  models: IStudioChatModels,
  older: IStudioChatLine[],
): IStudioChatModels => {
  const others = inVersionOrder(
    models.lines,
    distinct(
      [...(models.others ?? []), ...older].map((line) => ({ line })),
      MOST_OTHERS,
      models.lines,
    ).map(({ line }) => line),
  );
  const next: IStudioChatModels = { ...models, others };
  if (others.length === 0) {
    delete next.others;
  }
  return next;
};

/** A row as it was kept, when every part of it is one. */
const keptLineOf = ({ id, name, description }: Record<string, unknown>) => {
  const shown = nameOf(name);
  if (!isStudioChatModel(id) || id === 'default' || !shown) {
    return undefined;
  }
  const words = descriptionOf(description);
  return { id, name: shown, ...(words ? { description: words } : {}) };
};

/** A list as it was kept, or nothing for a file of any other shape. */
export const readKeptModels = (text: string): IStudioChatModels | undefined => {
  try {
    const raw: unknown = JSON.parse(text);
    if (!isRecord(raw) || raw.checked !== true || !Array.isArray(raw.lines)) {
      return undefined;
    }
    const read = (items: unknown, most: number, beside: IStudioChatLine[]) =>
      distinct(
        (Array.isArray(items) ? items : [])
          .filter(isRecord)
          .map(keptLineOf)
          .filter((line): line is IStudioChatLine => line !== undefined)
          .map((line) => ({ line })),
        most,
        beside,
      ).map(({ line }) => line);
    const lines = read(raw.lines, MOST_LINES, []).filter(({ id }) =>
      isLineName(id),
    );
    const others = read(raw.others, MOST_OTHERS, lines);
    const standIns = (Array.isArray(raw.standIns) ? raw.standIns : [])
      .filter(isRecord)
      .flatMap(({ id, line }) =>
        isStudioChatModel(id) &&
        !isLineName(id) &&
        typeof line === 'string' &&
        lines.some((shown) => shown.id === line)
          ? [{ id, line }]
          : [],
      );
    const defaultName = nameOf(raw.defaultName);
    return {
      checked: true,
      lines,
      ...(others.length > 0 ? { others } : {}),
      ...(standIns.length > 0 ? { standIns } : {}),
      ...(defaultName ? { defaultName } : {}),
    };
  } catch {
    return undefined;
  }
};
