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
  others: [{ id: 'claude-haiku-4-5-20251001', name: 'Haiku 4.5' }],
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
    // Its own order, and the exact older models it lists beside them apart.
    expect(readModelsAnswer(JSON.stringify(ANSWER))).toEqual(LIST);
  });

  // 2026-11-25: on a Max account the answer named Fable only by its exact
  // model, and the chat called Fable "not on your Claude plan".
  it('names a known line Claude Code listed only by its exact model, as that model', () => {
    const line = answered((models) =>
      models.map((entry) =>
        entry.value === 'fable'
          ? { ...entry, value: 'claude-fable-5-2' }
          : entry,
      ),
    );
    const read = readModelsAnswer(line);
    expect(read?.lines).toContainEqual({ id: 'fable', name: 'Fable 5.2' });
    expect(read?.others?.map(({ id }) => id)).toEqual([
      'claude-haiku-4-5-20251001',
    ]);
  });

  it('names such a line by its newest exact model, and keeps the older ones as versions', () => {
    const line = answered((models) => [
      ...models.filter(({ value }) => value !== 'opus'),
      { value: 'claude-opus-5-5', displayName: 'Opus 5.5' },
      { value: 'claude-opus-5-6', displayName: 'Opus 5.6' },
      { value: 'claude-3-opus-20240229', displayName: 'Opus 3' },
    ]);
    const read = readModelsAnswer(line);
    expect(read?.lines).toContainEqual({ id: 'opus', name: 'Opus 5.6' });
    expect(read?.others?.map(({ id }) => id)).toEqual([
      'claude-haiku-4-5-20251001',
      'claude-opus-5-5',
      'claude-3-opus-20240229',
    ]);
  });

  it('keeps a newer exact model beside its line as a version, and the line by its name', () => {
    const line = answered((models) => [
      ...models,
      { value: 'claude-opus-5-6', displayName: 'Opus 5.6' },
      { value: 'opus[1m]', displayName: 'Opus (1M context)' },
    ]);
    const read = readModelsAnswer(line);
    expect(read?.lines.map(({ id }) => id)).toEqual(
      LIST.lines.map(({ id }) => id),
    );
    expect(read?.others?.map(({ id }) => id)).toEqual([
      'claude-haiku-4-5-20251001',
      'claude-opus-5-6',
      'opus[1m]',
    ]);
  });

  it('keeps an unknown family listed only by exact models as versions, never by a name nobody gave', () => {
    const line = answered((models) => [
      ...models,
      { value: 'claude-mythos-1-0', displayName: 'Mythos 1' },
    ]);
    expect(idsOf(line)).not.toContain('mythos');
    expect(readModelsAnswer(line)?.others).toContainEqual({
      id: 'claude-mythos-1-0',
      name: 'Mythos 1',
    });
  });

  it("names the plan as Claude Code does, Ultra or any other, and the account's email", () => {
    const withAccount = (subscriptionType: unknown) => {
      const answer = JSON.parse(JSON.stringify(ANSWER));
      answer.response.response.account = {
        email: 'member@example.com',
        subscriptionType,
      };
      return readModelsAnswer(JSON.stringify(answer))?.account;
    };
    expect(withAccount('Claude Ultra')).toEqual({
      email: 'member@example.com',
      plan: 'Ultra',
    });
    expect(withAccount('Claude Max')?.plan).toBe('Max');
    expect(withAccount('Claude Platinum 2x')?.plan).toBe('Platinum 2x');
    // "Claude API" is what it says of an account with no plan.
    expect(withAccount('Claude API')).toEqual({ email: 'member@example.com' });
    expect(withAccount('<b>Max</b>')?.plan).toBeUndefined();
    expect(readModelsAnswer(JSON.stringify(ANSWER))?.account).toBeUndefined();
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
      { value: 'claude-opus 5" --x', displayName: 'Evil exact' },
      { value: 'claude-', displayName: 'Empty exact' },
    ]);
    expect(idsOf(line)).toEqual(['opus', 'fable', 'sonnet', 'haiku']);
    expect(readModelsAnswer(line)?.others).toEqual(LIST.others);
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

  it('marks what Claude Code refused for the rest of the run, and never keeps it', async () => {
    const models = createClaudeModels({ dir });
    await models.list();
    models.refuse('fable');
    models.refuse('default');
    expect((await models.list()).refused).toEqual(['fable']);
    expect(models.known().refused).toEqual(['fable']);
    // The next run of the app has heard no refusal.
    expect(createClaudeModels({ dir }).known()).toEqual(LIST);
  });

  it('keeps the list, never the account it came from', async () => {
    const answer = JSON.parse(JSON.stringify(ANSWER));
    answer.response.response.account = {
      email: 'member@example.com',
      subscriptionType: 'Claude Ultra',
    };
    const real = ANSWER.response.response;
    ANSWER.response.response = answer.response.response;
    try {
      const models = createClaudeModels({ dir });
      expect((await models.list()).account?.plan).toBe('Ultra');
      const kept = fs.readFileSync(
        path.join(dir, 'claude-models.json'),
        'utf8',
      );
      expect(kept).not.toContain('member@example.com');
      expect(createClaudeModels({ dir }).known()).toEqual(LIST);
    } finally {
      ANSWER.response.response = real;
    }
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
