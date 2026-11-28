/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  inVersionOrder,
  readClaudeCodeAnswer,
  readKeptModels,
  readModelsAnswer,
  withOlderVersions,
} from '../../../main/studioChat/claudeModelsAnswer';
import {
  ANSWER_2_1_321,
  ANSWER_2_1_332,
  ANSWER_2_1_332_SERVED,
  LIST_2_1_321,
  LIST_2_1_332,
} from '../../utils/claudeCodeAnswers';

/**
 * Claude Code's answer to the Studio's model lookup, read as the list the
 * pickers show: each line under its model's name with its version (Ivan,
 * 2026-10-09: "we need to show models version, like opus 5.5"), each model
 * once, and what Default starts named with its version (2026-11-27: "where
 * are the other models and why not showing the version").
 */

const ANSWER = ANSWER_2_1_321;
const LIST = LIST_2_1_321;

/** The answer with `models` changed by `change`. */
const answered = (
  change: (models: Record<string, unknown>[]) => unknown[],
  answer: typeof ANSWER | typeof ANSWER_2_1_332 = ANSWER,
) => {
  const copy = JSON.parse(JSON.stringify(answer));
  copy.response.response.models = change(copy.response.response.models);
  return JSON.stringify(copy);
};
const idsOf = (line: string) =>
  readModelsAnswer(line)?.lines.map(({ id }) => id);

describe("Claude Code's answer", () => {
  it('names each line by the model it starts, and what Default starts', () => {
    // Its own order, and the exact older models it lists beside them apart.
    expect(readModelsAnswer(JSON.stringify(ANSWER))).toEqual(LIST);
  });

  // 2026-11-27: Claude Code 2.1.332, updated that night, answered from the
  // list compiled into it, and the picker showed "Opus", "Sonnet", "Haiku"
  // and "Fable" with no version, and Fable twice: as the app's own bare row
  // and as `claude-fable-5-2[1m]` under the other versions.
  it("reads Claude Code 2.1.332's real answer: every line once, each with its version", () => {
    const read = readClaudeCodeAnswer(JSON.stringify(ANSWER_2_1_332));
    expect(read?.models).toEqual(LIST_2_1_332);
    expect(read?.version).toBe('2.1.332');
    // Fable is a line of its own, with nothing left of it under the others.
    expect(read?.models.others).toBeUndefined();
  });

  // Half an hour later the same Claude Code answered from its catalog
  // again: the shape changes from one run to the next, and both read alike.
  it("reads the same Claude Code's other real answer, from its catalog, alike", () => {
    const read = readModelsAnswer(JSON.stringify(ANSWER_2_1_332_SERVED));
    expect(read?.lines).toEqual([
      {
        id: 'opus',
        name: 'Opus 5.5',
        description: 'For complex work and everyday tasks',
      },
      {
        id: 'fable',
        name: 'Fable 5.2',
        description: 'For your toughest challenges',
      },
      {
        id: 'sonnet',
        name: 'Sonnet 5.5',
        description: 'Most efficient for simpler tasks',
      },
      {
        id: 'haiku',
        name: 'Haiku 5.5',
        description: 'Fastest for quick answers',
      },
    ]);
    expect(read?.standIns).toEqual([{ id: 'claude-fable-5-2', line: 'fable' }]);
    expect(read?.defaultName).toBe('Opus 5.5');
    // The nine older versions, by line and newest first.
    expect(read?.others?.map(({ name }) => name)).toEqual([
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
  });

  it('names a line by the head of its words when Claude Code gave no model for it', () => {
    const line = answered(
      (models) => models.map(({ resolvedModel: _dropped, ...entry }) => entry),
      ANSWER_2_1_332,
    );
    const read = readModelsAnswer(line);
    expect(read?.lines.find(({ id }) => id === 'sonnet')).toEqual({
      id: 'sonnet',
      name: 'Sonnet 5.5',
      description: 'Efficient for routine tasks',
    });
    expect(read?.defaultName).toBe('Opus 5.5');
  });

  it('keeps a long-context variant of a named line apart, named for its model', () => {
    const line = answered((models) => [
      ...models,
      {
        value: 'opus[1m]',
        resolvedModel: 'claude-opus-5-5',
        displayName: 'Opus (1M context)',
      },
    ]);
    expect(readModelsAnswer(line)?.others).toContainEqual({
      id: 'opus[1m]',
      name: 'Opus 5.5 (1M context)',
    });
  });

  it('never shows two rows of one name, whichever ids Claude Code gave them', () => {
    const line = answered(
      (models) => [
        ...models,
        {
          value: 'fable',
          resolvedModel: 'claude-fable-5-2',
          displayName: 'Fable',
        },
      ],
      ANSWER_2_1_332,
    );
    const read = readModelsAnswer(line);
    expect(read?.lines.filter(({ name }) => name === 'Fable 5.2')).toHaveLength(
      1,
    );
    expect(read?.others).toBeUndefined();
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
    expect(read?.standIns).toEqual([{ id: 'claude-fable-5-2', line: 'fable' }]);
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
    // By line, in the lines' order, newest first.
    expect(read?.others?.map(({ id }) => id)).toEqual([
      'claude-opus-5-6',
      'opus[1m]',
      'claude-haiku-4-5-20251001',
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

  it("names a new family's version as the known ones are, from the model it starts", () => {
    const line = answered((models) => [
      ...models,
      {
        value: 'mythos',
        resolvedModel: 'claude-mythos-2-1',
        displayName: 'Mythos',
        description: 'Mythos 2.1 · For the longest creative work',
      },
    ]);
    expect(readModelsAnswer(line)?.lines).toContainEqual({
      id: 'mythos',
      name: 'Mythos 2.1',
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

  it('reads back what was kept, stand-ins too, and nothing of any other shape', () => {
    expect(readKeptModels(JSON.stringify(LIST))).toEqual(LIST);
    const { account: _thisRun, ...kept } = LIST_2_1_332;
    expect(readKeptModels(JSON.stringify(kept))).toEqual(kept);
    // A stand-in for a line the list does not hold is no stand-in.
    expect(
      readKeptModels(
        JSON.stringify({
          ...kept,
          standIns: [{ id: 'claude-mythos-1[1m]', line: 'mythos' }],
        }),
      )?.standIns,
    ).toBeUndefined();
    expect(readKeptModels('{"checked":false,"lines":[]}')).toBeUndefined();
    expect(readKeptModels('[]')).toBeUndefined();
  });
});

describe('the older versions', () => {
  it('stand by line, in the order the lines stand, newest first', () => {
    expect(
      inVersionOrder(LIST.lines, [
        { id: 'claude-fable-5-1', name: 'Fable 5.1' },
        { id: 'claude-haiku-4-5-20251001', name: 'Haiku 4.5' },
        { id: 'claude-opus-4-8', name: 'Opus 4.8' },
        { id: 'claude-mythos-1', name: 'Mythos 1' },
        { id: 'claude-opus-5', name: 'Opus 5' },
      ]).map(({ name }) => name),
    ).toEqual(['Opus 5', 'Opus 4.8', 'Fable 5.1', 'Haiku 4.5', 'Mythos 1']);
  });

  it("join the answer's own, each once and never as a line's twin", () => {
    const joined = withOlderVersions(LIST, [
      { id: 'claude-haiku-4-5-20251001', name: 'Haiku 4.5' },
      { id: 'claude-opus-4-8', name: 'Opus 4.8' },
      // Its long-context id beside it, by the same name: one row to a member.
      { id: 'claude-opus-4-8[1m]', name: 'Opus 4.8' },
      { id: 'claude-sonnet-5-5', name: 'Sonnet 5.5' },
    ]);
    expect(joined.others).toEqual([
      { id: 'claude-opus-4-8', name: 'Opus 4.8' },
      { id: 'claude-haiku-4-5-20251001', name: 'Haiku 4.5' },
    ]);
    expect(joined.lines).toBe(LIST.lines);
    // The control: none to add leaves the list as it was.
    expect(withOlderVersions(LIST, [])).toEqual(LIST);
    expect(withOlderVersions(LIST_2_1_332, [])).toEqual(LIST_2_1_332);
  });
});
