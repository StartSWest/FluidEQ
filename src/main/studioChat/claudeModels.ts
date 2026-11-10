/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import fs from 'fs';
import path from 'path';
import { createInterface } from 'readline';
import {
  isStudioChatModel,
  NO_STUDIO_CHAT_MODELS,
  type IStudioChatLine,
  type IStudioChatModels,
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
 * /model shows, each line's newest model under its own name, and only the
 * lines this account can use.
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
 * under an open chat would rename the model a member is talking to.
 */

/** The control request's id, so its answer is told from anything else. */
const REQUEST_ID = 'fluideq-models';
/** No more lines than a list can show; Claude Code offers four or five. */
const MOST_LINES = 12;

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

/** Each id once, at most MOST_LINES of them, in the order given. */
const distinct = (lines: (IStudioChatLine | undefined)[]) =>
  lines
    .filter((line): line is IStudioChatLine => line !== undefined)
    .filter(
      (line, index, all) => all.findIndex(({ id }) => id === line.id) === index,
    )
    .slice(0, MOST_LINES);

/**
 * The list in Claude Code's answer to the `initialize` request, from one line
 * of what it wrote; undefined for any other line, or an answer of a shape
 * this does not know. Read as untrusted, like every line of its output.
 *
 * Every line it offers by its own name for it - `opus`, `haiku`, and a
 * family that did not exist when this was written alike - and none of the
 * exact models it lists beside them (`claude-haiku-4-5-...`), each an older
 * one of a line whose own name already reaches its newest.
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
  const lines = distinct(
    entries.map(({ value, displayName, description }) =>
      lineOf(value, displayName, description),
    ),
  );
  // What `default` starts, by the line's name that resolves to the same model.
  const fallback = entries.find(({ value }) => value === 'default');
  const same =
    fallback &&
    entries.find(
      (entry) =>
        entry !== fallback &&
        lines.some(({ id }) => id === entry.value) &&
        entry.resolvedModel === fallback.resolvedModel,
    );
  const defaultName = same && nameOf(same.displayName);
  return {
    checked: true,
    lines,
    ...(defaultName ? { defaultName } : {}),
  };
};

/** A list as it was kept, or nothing for a file of any other shape. */
export const readKeptModels = (text: string): IStudioChatModels | undefined => {
  try {
    const raw: unknown = JSON.parse(text);
    if (!isRecord(raw) || raw.checked !== true || !Array.isArray(raw.lines)) {
      return undefined;
    }
    const lines = distinct(
      raw.lines
        .filter(isRecord)
        .map(({ id, name, description }) => lineOf(id, name, description)),
    );
    const defaultName = nameOf(raw.defaultName);
    return { checked: true, lines, ...(defaultName ? { defaultName } : {}) };
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
          // It is only asked a question and sent no message, so nothing it
          // could do should exist: no tools at all (`chatSandbox.ts`).
          '--tools',
          '',
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
      try {
        writeFileAtomically(keptFile, `${JSON.stringify(answer)}\n`);
      } catch (error) {
        logger?.warn(`The Studio's model list could not be kept: ${error}`);
      }
      return answer;
    });
    return asked;
  };

  return {
    list,
    /** The list as it stands now, for a chat started before the answer. */
    known: () => known,
  };
};

export type TClaudeModels = ReturnType<typeof createClaudeModels>;
