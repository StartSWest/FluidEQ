/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import fs from 'fs';
import os from 'os';
import path from 'path';
import { PassThrough } from 'stream';
import { EventEmitter } from 'events';
import type { IStudioChatModels } from '../../../common/studioChat';
import {
  ANSWER_2_1_321,
  ANSWER_2_1_332,
  CATALOG_ROWS,
  LIST_2_1_321,
  ORGANIZATION,
  catalogFile,
} from '../../utils/claudeCodeAnswers';

/**
 * The Studio chat's model list, read from Claude Code itself (Ivan,
 * 2026-11-09: "make sure model list gets updated when app is restarted"):
 * never a table of versions in the app, which went on offering Haiku 4.5
 * after Haiku 5.5 shipped. Asked at the first picker, and again whenever
 * Claude Code changes, with no restart (2026-11-27: "where are the other
 * models and why not showing the version"); the older versions from the
 * catalog Claude Code keeps, which its answer no longer carries.
 */

/** What the stand-in Claude Code answers when asked, or `nothing`. */
let mockAnswer: object | 'nothing' = ANSWER_2_1_321;
let mockInstalled = true;
/** What the stand-in `claude auth status --json` prints. */
let mockAuth = '';
const mockStarted: string[][] = [];

jest.mock('../../../main/studioChat/claudeCode', () => ({
  systemEnv: () => ({}),
  findClaudeCode: () => (mockInstalled ? '/bin/claude' : undefined),
  claudeConfigFolder: () => '/nowhere',
  askAuthStatus: () => Promise.resolve(mockAuth),
  startClaudeCode: (_executable: string, args: string[]) => {
    mockStarted.push(args);
    const child = new EventEmitter() as EventEmitter & {
      stdout: PassThrough;
      stdin: { write: jest.Mock; end: jest.Mock; on: jest.Mock };
    };
    child.stdout = new PassThrough();
    child.stdin = {
      write: jest.fn(() => {
        if (mockAnswer === 'nothing') {
          child.stdout.end();
          child.emit('close', 1);
        } else {
          child.stdout.write('{"type":"system","subtype":"hook_started"}\n');
          child.stdout.write(`${JSON.stringify(mockAnswer)}\n`);
        }
        return true;
      }),
      end: jest.fn(() => {
        child.stdout.end();
        child.emit('close', 0);
      }),
      on: jest.fn(),
    };
    return child;
  },
}));

// eslint-disable-next-line import/first -- the mock above has to be in place first
import {
  createClaudeModels,
  type TWatchFolder,
} from '../../../main/studioChat/claudeModels';

const LIST = LIST_2_1_321;

/** The watches the list set, by folder, each told a name when asked. */
let watched: Map<string, (name: string | undefined) => void>;
const watch: TWatchFolder = (folder, changed) => {
  watched.set(folder, changed);
  return () => watched.delete(folder);
};

/** Where the next change the window is told of goes. */
let told: (models: IStudioChatModels) => void;
/** The next list the window is told of. */
const nextChange = () =>
  new Promise<IStudioChatModels>((resolve) => {
    told = resolve;
  });

let dir: string;
let config: string;
let catalogs: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-models-'));
  config = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-config-'));
  catalogs = path.join(config, 'cache', 'model-catalog');
  mockAnswer = ANSWER_2_1_321;
  mockInstalled = true;
  mockAuth = '';
  mockStarted.length = 0;
  watched = new Map();
  told = () => undefined;
});
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.rmSync(config, { recursive: true, force: true });
});

const make = (extra: Partial<Parameters<typeof createClaudeModels>[0]> = {}) =>
  createClaudeModels({
    dir,
    watch,
    onChange: (models) => told(models),
    ...extra,
  });

/** Claude Code signed in to `ORGANIZATION`, its catalog kept in `config`. */
const signedIn = () => {
  mockAuth = JSON.stringify({
    loggedIn: true,
    orgId: ORGANIZATION,
    configDirectory: config,
    email: 'member@example.com',
  });
  fs.mkdirSync(catalogs, { recursive: true });
};

describe('the list', () => {
  it('asks Claude Code once, without its hooks, and keeps the answer', async () => {
    const models = make();
    expect(await models.list()).toEqual(LIST);
    expect(await models.list()).toEqual(LIST);
    expect(mockStarted).toHaveLength(1);
    const [args] = mockStarted;
    const settings = args[args.indexOf('--settings') + 1];
    expect(JSON.parse(fs.readFileSync(settings, 'utf8'))).toEqual({
      disableAllHooks: true,
    });
    expect(models.known()).toEqual(LIST);
    // The next run of the app starts from it before it asks again.
    expect(make().known()).toEqual(LIST);
  });

  it('marks what Claude Code refused for the rest of the run, and never keeps it', async () => {
    const models = make();
    await models.list();
    models.refuse('fable');
    models.refuse('default');
    expect((await models.list()).refused).toEqual(['fable']);
    expect(models.known().refused).toEqual(['fable']);
    // The next run of the app has heard no refusal.
    expect(make().known()).toEqual(LIST);
  });

  it('keeps the list, never the account it came from', async () => {
    mockAnswer = ANSWER_2_1_332;
    const models = make();
    expect((await models.list()).account?.plan).toBe('Max');
    const kept = fs.readFileSync(path.join(dir, 'claude-models.json'), 'utf8');
    expect(kept).not.toContain('member@example.com');
    expect(make().known().account).toBeUndefined();
    expect(make().known().standIns).toEqual([
      { id: 'claude-fable-5-2[1m]', line: 'fable' },
    ]);
  });

  it('keeps the last list when Claude Code answers nothing', async () => {
    await make().list();
    mockAnswer = 'nothing';
    const warn = jest.fn();
    expect(await make({ logger: { warn } }).list()).toEqual(LIST);
    expect(warn).toHaveBeenCalled();
  });

  it('keeps the last list when Claude Code is not installed', async () => {
    await make().list();
    mockInstalled = false;
    expect(await make().list()).toEqual(LIST);
  });

  // The control: with nothing ever kept, nothing is known, and every line is
  // offered under its bare name rather than called unavailable.
  it('knows nothing before Claude Code has ever answered', async () => {
    mockAnswer = 'nothing';
    expect(await make().list()).toEqual({ checked: false, lines: [] });
  });
});

// Claude Code 2.1.332 stopped listing the older versions; its own "More
// models" reads them from the catalog it keeps, and so does the Studio.
describe("the older versions, from Claude Code's catalog", () => {
  it("lists them by line, newest first, from the signed-in organization's newest catalog", async () => {
    mockAnswer = ANSWER_2_1_332;
    signedIn();
    const write = (name: string, text: string) =>
      fs.writeFileSync(path.join(catalogs, name), text);
    // Beside it an older one, another organization's newer one, and the
    // retry marker Claude Code keeps: none of them is read. Nor is a row
    // that needs a newer Claude Code than the one that answered, or one its
    // own picker no longer offers.
    write(
      `${ORGANIZATION}-0ec732dde858-ccd.json`,
      catalogFile([
        ...CATALOG_ROWS,
        {
          id: 'claude-opus-6',
          name: 'Opus 6',
          section: 'overflow',
          min_claude_code_version: '2.2.0',
        },
        { id: 'claude-opus-4-1', name: 'Opus 4.1', section: 'deprecated' },
      ]),
    );
    write(
      `${ORGANIZATION}-0ec732dde858-cc.json`,
      catalogFile(
        [{ id: 'claude-opus-4-1', name: 'Opus 4.1', section: 'overflow' }],
        1,
      ),
    );
    write(
      '00000000-0000-4000-8000-0000000000bb-0ec732dde858-ccd.json',
      catalogFile(
        [{ id: 'claude-opus-4-5', name: 'Opus 4.5', section: 'overflow' }],
        9e12,
      ),
    );
    write(
      `${ORGANIZATION}-0ec732dde858-cc.headless-failed.json`,
      '{"failedAt":1,"failures":1}',
    );
    const listed = await make().list();
    expect(listed.others?.map(({ name }) => name)).toEqual([
      'Opus 5',
      'Opus 4.8',
      'Opus 4.7',
      'Opus 4.6',
      'Fable 5.1',
      'Fable 5',
      'Sonnet 5',
      'Sonnet 4.6',
      'Haiku 4.5',
    ]);
    // The lines are the answer's, every one once and with its version.
    expect(listed.lines.map(({ name }) => name)).toEqual([
      'Opus 5.5',
      'Fable 5.2',
      'Sonnet 5.5',
      'Haiku 5.5',
    ]);
  });

  // The control: the same answer, nobody's catalog to read.
  it('lists none where Claude Code keeps no catalog', async () => {
    mockAnswer = ANSWER_2_1_332;
    signedIn();
    expect((await make().list()).others).toBeUndefined();
  });
});

describe('a change in Claude Code', () => {
  it('reaches the window when Claude Code is updated, with no restart', async () => {
    const models = make();
    await models.list();
    const program = watched.get(path.dirname('/bin/claude'));
    expect(program).toBeDefined();
    // Another file beside it is not Claude Code: nothing is asked.
    program?.('claude.exe.old.1795839249138');
    expect(mockStarted).toHaveLength(1);
    mockAnswer = ANSWER_2_1_332;
    const changed = nextChange();
    program?.('claude');
    expect(mockStarted).toHaveLength(2);
    expect((await changed).lines.map(({ name }) => name)).toEqual([
      'Opus 5.5',
      'Fable 5.2',
      'Sonnet 5.5',
      'Haiku 5.5',
    ]);
    expect((await models.list()).standIns).toHaveLength(1);
  });

  it('reads a new catalog when Claude Code writes one, without asking it again', async () => {
    signedIn();
    const models = make();
    await models.list();
    const catalog = watched.get(catalogs);
    expect(catalog).toBeDefined();
    const name = `${ORGANIZATION}-0ec732dde858-ccd.json`;
    fs.writeFileSync(path.join(catalogs, name), catalogFile(CATALOG_ROWS));
    const changed = nextChange();
    catalog?.(name);
    expect((await changed).others).toHaveLength(9);
    expect(mockStarted).toHaveLength(1);
  });

  it('asks again when anyone signs in to Claude Code, and for nothing else in its folder', async () => {
    const models = make();
    await models.list();
    const account = watched.get('/nowhere');
    expect(account).toBeDefined();
    // Every session's history is written beside the sign-in.
    account?.('history.jsonl');
    account?.(undefined);
    expect(mockStarted).toHaveLength(1);
    mockAnswer = ANSWER_2_1_332;
    const changed = nextChange();
    account?.('.credentials.json');
    expect(mockStarted).toHaveLength(2);
    expect((await changed).account?.plan).toBe('Max');
  });

  it('asks again on a sign-in in the Studio', async () => {
    const models = make();
    await models.list();
    mockAnswer = ANSWER_2_1_332;
    const changed = nextChange();
    models.refresh();
    expect((await changed).account?.plan).toBe('Max');
  });
});
