/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import fs from 'fs';
import path from 'path';
import { createInterface } from 'readline';
import {
  NO_STUDIO_CHAT_MODELS,
  STUDIO_CHAT_MODELS,
  type IStudioChatModels,
  type TStudioChatFamily,
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
const FAMILIES = STUDIO_CHAT_MODELS.filter(
  (model): model is TStudioChatFamily => model !== 'default',
);

const isRecord = (raw: unknown): raw is Record<string, unknown> =>
  typeof raw === 'object' && raw !== null && !Array.isArray(raw);

/** A model's name as it may be shown: short and printable, or nothing. */
const nameOf = (raw: unknown) =>
  typeof raw === 'string' && /^[\p{L}\p{N} .()-]{1,40}$/u.test(raw)
    ? raw
    : undefined;

/**
 * The list in Claude Code's answer to the \`initialize\` request, from one line
 * of what it wrote; undefined for any other line, or an answer of a shape
 * this does not know. Read as untrusted, like every line of its output.
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
  const names: IStudioChatModels['names'] = {};
  FAMILIES.forEach((family) => {
    const entry = entries.find(({ value }) => value === family);
    const name = entry && nameOf(entry.displayName);
    if (name) {
      names[family] = name;
    }
  });
  // What \`default\` starts, by the line's name that resolves to the same model.
  const fallback = entries.find(({ value }) => value === 'default');
  const same =
    fallback &&
    entries.find(
      (entry) =>
        entry !== fallback &&
        typeof entry.value === 'string' &&
        (FAMILIES as readonly string[]).includes(entry.value) &&
        entry.resolvedModel === fallback.resolvedModel,
    );
  const defaultName = same && nameOf(same.displayName);
  return {
    checked: true,
    names,
    ...(defaultName ? { defaultName } : {}),
  };
};

/** A list as it was kept, or nothing for a file of any other shape. */
export const readKeptModels = (text: string): IStudioChatModels | undefined => {
  try {
    const raw: unknown = JSON.parse(text);
    if (!isRecord(raw) || raw.checked !== true || !isRecord(raw.names)) {
      return undefined;
    }
    const { names: kept } = raw;
    const names: IStudioChatModels['names'] = {};
    FAMILIES.forEach((family) => {
      const name = nameOf(kept[family]);
      if (name) {
        names[family] = name;
      }
    });
    const defaultName = nameOf(raw.defaultName);
    return { checked: true, names, ...(defaultName ? { defaultName } : {}) };
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
