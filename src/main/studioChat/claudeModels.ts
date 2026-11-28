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
  type IStudioChatModels,
  type TStudioChatModel,
} from '../../common/studioChat';
import writeFileAtomically from '../atomicWrite';
import {
  catalogPlaceOf,
  isCatalogFileOf,
  readOlderVersions,
  type ICatalogPlace,
} from './claudeCatalog';
import {
  askAuthStatus,
  claudeConfigFolder,
  findClaudeCode,
  startClaudeCode,
  systemEnv,
  type IClaudeCodeEnv,
} from './claudeCode';
import {
  MODELS_REQUEST_ID,
  readClaudeCodeAnswer,
  readKeptModels,
  withOlderVersions,
  type IClaudeCodeAnswer,
} from './claudeModelsAnswer';

/**
 * The models Claude Code offers this member (`IStudioChatModels`), asked of
 * Claude Code itself: the same list its own /model shows, each line under
 * its model's name with its version, and the older versions it offers
 * beside them.
 *
 * Asked the way Claude Agent SDK asks it: Claude Code started for a stream,
 * an `initialize` control request written to it, and the answer's `models`
 * read (`claudeModelsAnswer.ts`) - one entry per model, `value` the name
 * Claude Code takes (`haiku`), `resolvedModel` the model it starts. No
 * message goes to Claude, so nothing is spent; the member's own hooks are
 * switched off for it (`disableAllHooks`), because a lookup is not a
 * session of theirs. The older versions come from the catalog Claude Code
 * keeps as well, which its answer carries only in some runs
 * (`claudeCatalog.ts`).
 *
 * Asked at the first picker of a run, and again whenever Claude Code
 * changes, with no restart (Ivan, 2026-11-27, about a list that had gone
 * wrong under him): when its program is replaced by an update, when it
 * writes a new catalog for the account, and when anyone signs in to it, in
 * the Studio or anywhere else. A list that changes reaches every picker at
 * once (`onChange`). It used to be asked once in a run, so a chat would not
 * see its model renamed under it; the price was a list that stayed as the
 * run's first answer left it until the app restarted, and Claude Code
 * updated itself under the running app that night.
 *
 * Kept in `claude-models.json` beside the chats, so a run of the app with
 * Claude Code offline, missing or answering nothing readable still shows
 * the last list it gave. What Claude Code refused in this run (`refuse`)
 * rides on the list and is never kept: a plan changes, and a refusal is
 * only true of the run that heard it.
 */

/** Claude Code's sign-in, in its config folder (`signInWindow.ts` waits on it too). */
const CREDENTIALS = '.credentials.json';

/** Watches a folder: `changed` hears each name that changed in it. */
export type TWatchFolder = (
  folder: string,
  changed: (name: string | undefined) => void,
) => (() => void) | undefined;

/** `fs.watch`, holding nothing open that would keep the app from quitting. */
const watchFolder: TWatchFolder = (folder, changed) => {
  try {
    const watcher = fs.watch(folder, { persistent: false }, (_event, name) =>
      changed(typeof name === 'string' ? name : undefined),
    );
    // A folder taken away mid-watch: nothing more to hear from it.
    watcher.on('error', () => watcher.close());
    return () => watcher.close();
  } catch {
    return undefined;
  }
};

interface IClaudeModelsDeps {
  /** Where the list is kept, and the lookup's settings file. */
  dir: string;
  where?: IClaudeCodeEnv;
  logger?: { warn(message: string): void };
  /** Told the list each time it changes, refusals included. */
  onChange?: (models: IStudioChatModels) => void;
  watch?: TWatchFolder;
}

/** One watch, replaced only when what it watches moves. */
const createWatch = (watch: TWatchFolder) => {
  let watched: { key: string; stop: () => void } | undefined;
  return (
    folder: string | undefined,
    changed: (name: string | undefined) => void,
  ) => {
    if (watched?.key === folder) {
      return;
    }
    watched?.stop();
    const stop = folder ? watch(folder, changed) : undefined;
    watched = folder && stop ? { key: folder, stop } : undefined;
  };
};

export const createClaudeModels = ({
  dir,
  where = systemEnv(),
  logger,
  onChange,
  watch = watchFolder,
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
  /** Claude Code's last answer, before the catalog's older versions. */
  let answered: IClaudeCodeAnswer | undefined;
  let place: ICatalogPlace | undefined;
  /** Claude Code's program file, by name in its folder, lower case. */
  let program: string | undefined;
  const refused = new Set<TStudioChatModel>();
  const withRefused = (models: IStudioChatModels): IStudioChatModels =>
    refused.size > 0 ? { ...models, refused: [...refused] } : models;

  /** One lookup: Claude Code's answer, or undefined when it gave none. */
  const askClaudeCode = (executable: string) =>
    new Promise<IClaudeCodeAnswer | undefined>((resolve) => {
      const settings = path.join(dir, 'claude-models-settings.json');
      try {
        fs.mkdirSync(dir, { recursive: true });
        writeFileAtomically(settings, '{"disableAllHooks":true}\n', 0o600);
      } catch (error) {
        logger?.warn(`The Studio's model lookup could not start: ${error}`);
        resolve(undefined);
        return;
      }
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
      let answer: IClaudeCodeAnswer | undefined;
      if (child.stdout) {
        createInterface({ input: child.stdout }).on('line', (line) => {
          const read = readClaudeCodeAnswer(line);
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
          request_id: MODELS_REQUEST_ID,
          request: { subtype: 'initialize' },
        })}\n`,
      );
    });

  /** The list from the last answer and the catalog as it stands now. */
  const settle = () => {
    if (!answered) {
      return;
    }
    const next = withOlderVersions(
      answered.models,
      place ? readOlderVersions(place, answered.version) : [],
    );
    if (JSON.stringify(next) === JSON.stringify(known)) {
      return;
    }
    known = next;
    // The account is this run's alone: whose it was is never kept.
    const { account, ...kept } = next;
    try {
      writeFileAtomically(keptFile, `${JSON.stringify(kept)}\n`);
    } catch (error) {
      logger?.warn(`The Studio's model list could not be kept: ${error}`);
    }
    onChange?.(withRefused(known));
  };

  const watchProgram = createWatch(watch);
  const watchCatalog = createWatch(watch);
  const watchAccount = createWatch(watch);

  const lookup = async () => {
    const executable = findClaudeCode(where);
    const answer = executable ? await askClaudeCode(executable) : undefined;
    if (!executable || !answer) {
      logger?.warn(
        'Claude Code gave no model list; the Studio keeps the last one.',
      );
      return;
    }
    place = catalogPlaceOf(
      await askAuthStatus(executable),
      claudeConfigFolder(where),
    );
    answered = answer;
    settle();
    // An update replaces Claude Code's program, and a sign-in its
    // credentials, in the Studio or anywhere else: each is followed by a
    // new answer. A new catalog is read again on its own. The config folder
    // changes with every session's history, so only its sign-in counts
    // there, and a change it cannot name counts for nothing. Each watch
    // reads the program and the organization as they are when it hears
    // something: a watch outlives the lookup that set it while its folder
    // stays the same, and a sign-in to another organization keeps the
    // folder.
    program = path.basename(executable).toLowerCase();
    watchProgram(path.dirname(executable), (name) => {
      if (name === undefined || name.toLowerCase() === program) {
        look().catch(() => undefined);
      }
    });
    watchAccount(place?.config ?? claudeConfigFolder(where), (name) => {
      if (name === CREDENTIALS) {
        look().catch(() => undefined);
      }
    });
    watchCatalog(place?.folder, (name) => {
      const organization = place?.organization;
      if (
        organization &&
        (name === undefined || isCatalogFileOf(organization, name))
      ) {
        settle();
      }
    });
  };

  // One lookup at a time; any change heard during one asks once more after
  // it, so the last answer is read after the last change.
  let looking: Promise<void> | undefined;
  let lookAgain = false;
  const look = (): Promise<void> => {
    if (looking) {
      lookAgain = true;
      return looking;
    }
    looking = lookup().finally(() => {
      looking = undefined;
      if (lookAgain) {
        lookAgain = false;
        look().catch(() => undefined);
      }
    });
    return looking;
  };

  let first: Promise<void> | undefined;

  return {
    /**
     * The list: asked of Claude Code the first time, and as it stands from
     * then on. Without an answer, the last one kept.
     */
    list: () => {
      first ??= look();
      return first.then(() => withRefused(known));
    },
    /** The list as it stands now, for a chat started before the answer. */
    known: () => withRefused(known),
    /** Ask Claude Code again: the member signed in, maybe as somebody else. */
    refresh: () => {
      look().catch(() => undefined);
    },
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
