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

/**
 * The Studio chat's model list, read from Claude Code itself once in each run
 * of the app (Ivan, 2026-11-09: "make sure model list gets updated when app is
 * restarted"): never a table of versions in the app, which went on offering
 * Haiku 4.5 after Haiku 5.5 shipped.
 */

/** Claude Code's answer to `initialize`, as 2.1.321 wrote it (trimmed). */
const ANSWER = {
  type: 'control_response',
  response: {
    subtype: 'success',
    request_id: 'fluideq-models',
    response: {
      models: [
        {
          value: 'default',
          resolvedModel: 'claude-opus-5-5',
          displayName: 'Default (recommended)',
        },
        {
          value: 'opus',
          resolvedModel: 'claude-opus-5-5',
          displayName: 'Opus 5.5',
          description: 'Best for everyday, complex tasks',
        },
        {
          value: 'fable',
          resolvedModel: 'claude-fable-5-2',
          displayName: 'Fable 5.2',
        },
        {
          value: 'sonnet',
          resolvedModel: 'claude-sonnet-5-5',
          displayName: 'Sonnet 5.5',
        },
        {
          value: 'haiku',
          resolvedModel: 'claude-haiku-5-5',
          displayName: 'Haiku 5.5',
        },
        {
          value: 'claude-haiku-4-5-20251001',
          resolvedModel: 'claude-haiku-4-5-20251001',
          displayName: 'Haiku 4.5',
        },
      ],
    },
  },
};

/** What the stand-in Claude Code does when asked: answer, or end with nothing. */
let mockReply: 'answer' | 'nothing' = 'answer';
let mockInstalled = true;
const mockStarted: string[][] = [];

jest.mock('../../../main/studioChat/claudeCode', () => ({
  systemEnv: () => ({}),
  findClaudeCode: () => (mockInstalled ? 'claude' : undefined),
  startClaudeCode: (_executable: string, args: string[]) => {
    mockStarted.push(args);
    const child = new EventEmitter() as EventEmitter & {
      stdout: PassThrough;
      stdin: { write: jest.Mock; end: jest.Mock; on: jest.Mock };
    };
    child.stdout = new PassThrough();
    child.stdin = {
      write: jest.fn(() => {
        if (mockReply === 'answer') {
          child.stdout.write('{"type":"system","subtype":"hook_started"}\n');
          child.stdout.write(`${JSON.stringify(ANSWER)}\n`);
        } else {
          child.stdout.end();
          child.emit('close', 1);
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
  readKeptModels,
  readModelsAnswer,
} from '../../../main/studioChat/claudeModels';

const LIST = {
  checked: true,
  lines: [
    {
      id: 'opus',
      name: 'Opus 5.5',
      description: 'Best for everyday, complex tasks',
    },
    { id: 'fable', name: 'Fable 5.2' },
    { id: 'sonnet', name: 'Sonnet 5.5' },
    { id: 'haiku', name: 'Haiku 5.5' },
  ],
  defaultName: 'Opus 5.5',
};

/** The answer with `models` changed by `change`. */
const answered = (change: (models: Record<string, unknown>[]) => unknown[]) => {
  const answer = JSON.parse(JSON.stringify(ANSWER));
  answer.response.response.models = change(answer.response.response.models);
  return JSON.stringify(answer);
};
const idsOf = (line: string) =>
  readModelsAnswer(line)?.lines.map(({ id }) => id);

let dir: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-models-'));
  mockReply = 'answer';
  mockInstalled = true;
  mockStarted.length = 0;
});
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("Claude Code's answer", () => {
  it('names each line by the model it starts, and what Default starts', () => {
    // Its own order, and none of the exact older models it lists beside them.
    expect(readModelsAnswer(JSON.stringify(ANSWER))).toEqual(LIST);
  });

  // Ivan, 2026-11-09: "claude can launch new models and we want to pick up
  // smartly automatically".
  it("offers a family it never knew of, in Claude Code's own words", () => {
    const line = answered((models) => [
      ...models,
      {
        value: 'mythos',
        resolvedModel: 'claude-mythos-1',
        displayName: 'Mythos 1',
        description: 'For the longest creative work',
      },
    ]);
    expect(readModelsAnswer(line)?.lines).toContainEqual({
      id: 'mythos',
      name: 'Mythos 1',
      description: 'For the longest creative work',
    });
  });

  it('takes no name that could not be a line, or crossed into a command line', () => {
    const line = answered((models) => [
      ...models,
      { value: '--dangerously-skip-permissions', displayName: 'Evil' },
      { value: 'Mythos', displayName: 'Upper case' },
      { value: 'a b', displayName: 'Spaced' },
    ]);
    expect(idsOf(line)).toEqual(['opus', 'fable', 'sonnet', 'haiku']);
  });

  it('is nothing but the answer to its own request', () => {
    const other = {
      ...ANSWER,
      response: { ...ANSWER.response, request_id: 'someone-else' },
    };
    expect(readModelsAnswer(JSON.stringify(other))).toBeUndefined();
    expect(readModelsAnswer('{"type":"system"}')).toBeUndefined();
    expect(readModelsAnswer('not json')).toBeUndefined();
  });

  it('leaves out a line it did not offer, and a name that is not a name', () => {
    const line = answered((models) =>
      models
        .filter(({ value }) => value !== 'fable')
        .map((entry) =>
          entry.value === 'haiku'
            ? { ...entry, displayName: '<img src=x>' }
            : entry,
        ),
    );
    expect(idsOf(line)).toEqual(['opus', 'sonnet']);
  });

  it('names what Default starts by the line that starts the same model', () => {
    const answer = JSON.parse(JSON.stringify(ANSWER));
    answer.response.response.models[0].resolvedModel = 'claude-sonnet-5-5';
    expect(readModelsAnswer(JSON.stringify(answer))?.defaultName).toBe(
      'Sonnet 5.5',
    );
  });

  it('takes no name longer than a name', () => {
    const answer = JSON.parse(JSON.stringify(ANSWER));
    answer.response.response.models[1].displayName = 'Opus '.repeat(12);
    expect(idsOf(JSON.stringify(answer))).not.toContain('opus');
  });

  it('reads back what was kept, and nothing of any other shape', () => {
    expect(readKeptModels(JSON.stringify(LIST))).toEqual(LIST);
    expect(readKeptModels('{"checked":false,"lines":[]}')).toBeUndefined();
    expect(readKeptModels('[]')).toBeUndefined();
  });
});

describe('the list for a run of the app', () => {
  it('asks Claude Code once, without its hooks, and keeps the answer', async () => {
    const models = createClaudeModels({ dir });
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
    expect(createClaudeModels({ dir }).known()).toEqual(LIST);
  });

  it('keeps the last list when Claude Code answers nothing', async () => {
    await createClaudeModels({ dir }).list();
    mockReply = 'nothing';
    const warn = jest.fn();
    expect(await createClaudeModels({ dir, logger: { warn } }).list()).toEqual(
      LIST,
    );
    expect(warn).toHaveBeenCalled();
  });

  it('keeps the last list when Claude Code is not installed', async () => {
    await createClaudeModels({ dir }).list();
    mockInstalled = false;
    expect(await createClaudeModels({ dir }).list()).toEqual(LIST);
  });

  // The control: with nothing ever kept, nothing is known, and every line is
  // offered under its bare name rather than called unavailable.
  it('knows nothing before Claude Code has ever answered', async () => {
    mockReply = 'nothing';
    expect(await createClaudeModels({ dir }).list()).toEqual({
      checked: false,
      lines: [],
    });
  });
});
