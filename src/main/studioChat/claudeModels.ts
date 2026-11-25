/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import fs from 'fs';
import path from 'path';
import { createInterface } from 'readline';
import {
  accountEmailOf,
  claudePlanNameOf,
  compareStudioChatVersions,
  exactStudioChatModelOf,
  isStudioChatExactModel,
  isStudioChatFamily,
  isStudioChatModel,
  NO_STUDIO_CHAT_MODELS,
  type IStudioChatLine,
  type IStudioChatModels,
  type TStudioChatModel,
} from '../../common/studioChat';
import writeFileAtomically from '../atomicWrite';
import {
  findClaudeCode,
  startClaudeCode,
  systemEnv,
  type IClaudeCodeEnv,
} from './claudeCode';

/**
 * The models Claude Code offers this member, asked of Claude Code itself
 * once in each run of the app (\`IStudioChatModels\`): the same list its own
 * /model shows, each line's newest model under its own name, and the other
 * versions it lists beside them.
 *
 * Asked the way Claude Agent SDK asks it: Claude Code started for a stream,
 * an \`initialize\` control request written to it, and the answer's \`models\`
 * read - one entry per model, \`value\` the name Claude Code takes
 * (\`haiku\`), \`displayName\` what it is (\`Haiku 5.5\`). No message goes to
 * Claude, so nothing is spent; the member's own hooks are switched off for
 * it (\`disableAllHooks\`), because a lookup is not a session of theirs.
 *
 * Kept in \`claude-models.json\` beside the chats, so a run of the app with
 * Claude Code offline, missing or answering nothing readable still shows
 * the last list it gave. Never asked again within a run: a list that changed
 * under an open chat would rename the model a member is talking to. What
 * Claude Code refused in this run (\`refuse\`) rides on the list and is
 * never kept: a plan changes, and a refusal is only true of the run that
 * heard it.
 */

/** The control request's id, so its answer is told from anything else. */
const REQUEST_ID = 'fluideq-models';
/** No more lines than a list can show; Claude Code offers four or five. */
const MOST_LINES = 12;
/** The other versions, apart, so a long history never pushes a line out. */
const MOST_OTHERS = 24;

const isRecord = (raw: unknown): raw is Record<string, unknown> =>
  typeof raw === 'object' && raw !== null && !Array.isArray(raw);

/** A model's name as it may be shown: short and printable, or nothing. */
const nameOf = (raw: unknown) =>
  typeof raw === 'string' && /^[\p{L}\p{N} .()-]{1,40}$/u.test(raw)
    ? raw
    : undefined;

/** What a model is for, in Claude Code's words: a line of plain text, or nothing. */
const descriptionOf = (raw: unknown) =>
  typeof raw === 'string' && /^[\p{L}\p{N} .,·:;'’()/&+-]{1,120}$/u.test(raw)
    ? raw
    : undefined;

/** A line from its name for it and its words, when every part is one. */
const lineOf = (
  id: unknown,
  name: unknown,
  description: unknown,
): IStudioChatLine | undefined => {
  const shown = nameOf(name);
  if (!isStudioChatModel(id) || id === 'default' || !shown) {
    return undefined;
  }
  const words = descriptionOf(description);
  return { id, name: shown, ...(words ? { description: words } : {}) };
};

/** Each id once, at most `most` of them, in the order given. */
const distinct = (lines: (IStudioChatLine | undefined)[], most: number) =>
  lines
    .filter((line): line is IStudioChatLine => line !== undefined)
    .filter(
      (line, index, all) => all.findIndex(({ id }) => id === line.id) === index,
    )
    .slice(0, most);

/** A line by its own name: `opus`, `mythos`; never a version or a variant. */
const isLineName = (id: TStudioChatModel) =>
  !isStudioChatExactModel(id) && !id.endsWith('[1m]');

/**
 * The list from its lines and others: the lines by their own names, each
 * known line Claude Code named only by an exact model under its own name
 * (its newest such model's name and words), and every other version apart.
 *
 * A line is started by its own name, which Claude Code resolves to its
 * newest model, so `fable` stands for `claude-fable-5-2` and will stand for
 * 5.3 without a change here. An unknown family listed only by exact models
 * keeps them as versions: nothing says Claude Code takes its bare name.
 * `named` is every line Claude Code named, shown or not: a line whose own
 * entry was unreadable is offered under its bare name, never as an older
 * model its name would not start.
 */
const listOf = (
  given: IStudioChatLine[],
  named: Set<string>,
): Pick<IStudioChatModels, 'lines' | 'others'> & { folded: Set<string> } => {
  const newest = new Map<
    string,
    { line: IStudioChatLine; version: number[] }
  >();
  given.forEach((line) => {
    const exact = exactStudioChatModelOf(line.id);
    if (
      !exact ||
      !isStudioChatFamily(exact.family) ||
      named.has(exact.family)
    ) {
      return;
    }
    const best = newest.get(exact.family);
    if (!best || compareStudioChatVersions(exact.version, best.version) > 0) {
      newest.set(exact.family, { line, version: exact.version });
    }
  });
  const folded = new Set([...newest.values()].map(({ line }) => line.id));
  const lines: IStudioChatLine[] = [];
  const others: IStudioChatLine[] = [];
  given.forEach((line) => {
    if (isLineName(line.id)) {
      lines.push(line);
      return;
    }
    const family = folded.has(line.id)
      ? exactStudioChatModelOf(line.id)?.family
      : undefined;
    if (family) {
      lines.push({ ...line, id: family });
      return;
    }
    others.push(line);
  });
  return {
    lines: distinct(lines, MOST_LINES),
    others: distinct(others, MOST_OTHERS),
    folded,
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

/**
 * The list in Claude Code's answer to the `initialize` request, from one line
 * of what it wrote; undefined for any other line, or an answer of a shape
 * this does not know. Read as untrusted, like every line of its output.
 *
 * Every line it offers by its own name for it - `opus`, `haiku`, and a
 * family that did not exist when this was written alike - and the exact
 * models it lists beside them (`claude-haiku-4-5-...`) as the other
 * versions. Until 2026-11-25 the exact models were thrown away, and an
 * answer that named Fable only as `claude-fable-5-2` left Fable out of the
 * list altogether.
 */
export const readModelsAnswer = (
  line: string,
): IStudioChatModels | undefined => {
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
  if (!isRecord(outer) || outer.request_id !== REQUEST_ID) {
    return undefined;
  }
  const inner = isRecord(outer.response) ? outer.response : outer;
  if (!Array.isArray(inner.models)) {
    return undefined;
  }
  const entries = inner.models.filter(isRecord);
  const { lines, others, folded } = listOf(
    distinct(
      entries.map(({ value, displayName, description }) =>
        lineOf(value, displayName, description),
      ),
      entries.length,
    ),
    new Set(
      entries
        .map(({ value }) => value)
        .filter(
          (value): value is string =>
            isStudioChatModel(value) && isLineName(value),
        ),
    ),
  );
  const shown = new Set([
    ...lines.map(({ id }) => id),
    ...(others ?? []).map(({ id }) => id),
    ...folded,
  ]);
  // What `default` starts, by the name of an entry that starts the same model.
  const fallback = entries.find(({ value }) => value === 'default');
  const same =
    fallback &&
    entries.find(
      (entry) =>
        entry !== fallback &&
        typeof entry.value === 'string' &&
        shown.has(entry.value) &&
        entry.resolvedModel === fallback.resolvedModel,
    );
  const defaultName = same && nameOf(same.displayName);
  const account = accountOf(inner.account);
  return {
    checked: true,
    lines,
    ...(others && others.length > 0 ? { others } : {}),
    ...(defaultName ? { defaultName } : {}),
    ...(account ? { account } : {}),
  };
};

/** A list as it was kept, or nothing for a file of any other shape. */
export const readKeptModels = (text: string): IStudioChatModels | undefined => {
  try {
    const raw: unknown = JSON.parse(text);
    if (!isRecord(raw) || raw.checked !== true || !Array.isArray(raw.lines)) {
      return undefined;
    }
    const read = (items: unknown, most: number) =>
      distinct(
        (Array.isArray(items) ? items : [])
          .filter(isRecord)
          .map(({ id, name, description }) => lineOf(id, name, description)),
        most,
      );
    const lines = read(raw.lines, MOST_LINES).filter(({ id }) =>
      isLineName(id),
    );
    const others = read(raw.others, MOST_OTHERS).filter(
      ({ id }) => !lines.some((line) => line.id === id),
    );
    const defaultName = nameOf(raw.defaultName);
    return {
      checked: true,
      lines,
      ...(others.length > 0 ? { others } : {}),
      ...(defaultName ? { defaultName } : {}),
    };
  } catch {
    return undefined;
  }
};

interface IClaudeModelsDeps {
  /** Where the list is kept, and the lookup's settings file. */
  dir: string;
  where?: IClaudeCodeEnv;
  logger?: { warn(message: string): void };
}

export const createClaudeModels = ({
  dir,
  where = systemEnv(),
  logger,
}: IClaudeModelsDeps) => {
  const keptFile = path.join(dir, 'claude-models.json');
  const readKept = () => {
    try {
      return readKeptModels(fs.readFileSync(keptFile, 'utf8'));
    } catch {
      return undefined;
    }
  };
  let known: IStudioChatModels = readKept() ?? NO_STUDIO_CHAT_MODELS;
  let asked: Promise<IStudioChatModels> | undefined;
  const refused = new Set<TStudioChatModel>();
  const withRefused = (models: IStudioChatModels): IStudioChatModels =>
    refused.size > 0 ? { ...models, refused: [...refused] } : models;

  /** One lookup: Claude Code's answer, or undefined when it gave none. */
  const askClaudeCode = () =>
    new Promise<IStudioChatModels | undefined>((resolve) => {
      const executable = findClaudeCode(where);
      if (!executable) {
        resolve(undefined);
        return;
      }
      fs.mkdirSync(dir, { recursive: true });
      const settings = path.join(dir, 'claude-models-settings.json');
      writeFileAtomically(settings, '{"disableAllHooks":true}\n', 0o600);
      const child = startClaudeCode(
        executable,
        [
          '-p',
          '--input-format',
          'stream-json',
          '--output-format',
          'stream-json',
          '--verbose',
          '--setting-sources',
          'user',
          '--settings',
          settings,
          '--strict-mcp-config',
        ],
        { cwd: dir, stdio: ['pipe', 'pipe', 'ignore'], windowsHide: true },
      );
      let answer: IStudioChatModels | undefined;
      if (child.stdout) {
        createInterface({ input: child.stdout }).on('line', (line) => {
          const read = readModelsAnswer(line);
          if (read && !answer) {
            answer = read;
            // The answer is all that was wanted: its end of the stream is
            // what lets Claude Code go.
            child.stdin?.end();
          }
        });
      }
      child.stdin?.on('error', () => undefined);
      child.on('error', () => resolve(undefined));
      child.on('close', () => resolve(answer));
      child.stdin?.write(
        `${JSON.stringify({
          type: 'control_request',
          request_id: REQUEST_ID,
          request: { subtype: 'initialize' },
        })}\n`,
      );
    });

  /**
   * The list for this run of the app: asked of Claude Code the first time,
   * and that answer from then on. Without an answer, the last one kept.
   */
  const list = () => {
    asked ??= askClaudeCode().then((answer) => {
      if (!answer) {
        logger?.warn(
          'Claude Code gave no model list; the Studio keeps the last one.',
        );
        return known;
      }
      known = answer;
      // The account is this run's alone: whose it was is never kept.
      const { account, ...kept } = answer;
      try {
        writeFileAtomically(keptFile, `${JSON.stringify(kept)}\n`);
      } catch (error) {
        logger?.warn(`The Studio's model list could not be kept: ${error}`);
      }
      return answer;
    });
    return asked.then(withRefused);
  };

  return {
    list,
    /** The list as it stands now, for a chat started before the answer. */
    known: () => withRefused(known),
    /**
     * A model Claude Code refused to start for this account, from the error
     * it ended a reply with: marked unavailable for the rest of this run.
     */
    refuse: (model: TStudioChatModel) => {
      if (model !== 'default') {
        refused.add(model);
      }
    },
  };
};

export type TClaudeModels = ReturnType<typeof createClaudeModels>;
