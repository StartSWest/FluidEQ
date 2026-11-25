/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  claudePlanNameOf,
  exactStudioChatModelOf,
  isStudioChatModel,
  isStudioChatModelOffered,
  NO_STUDIO_CHAT_MODELS,
  type IStudioChatModels,
} from '../../../common/studioChat';

/**
 * Which models the Studio chat may start (2026-11-25: a Max account was
 * told Fable was not on its plan because Claude Code's list did not name
 * it by its line's name).
 */

const LISTED: IStudioChatModels = {
  checked: true,
  lines: [
    { id: 'opus', name: 'Opus 5.5' },
    { id: 'mythos', name: 'Mythos 1' },
  ],
  others: [{ id: 'claude-haiku-4-5-20251001', name: 'Haiku 4.5' }],
};

describe('a model the chat may start', () => {
  it('is a line by its name, its long-context variant, or an exact model', () => {
    [
      'default',
      'fable',
      'opus[1m]',
      'claude-fable-5-2',
      'claude-haiku-4-5-20251001',
      'claude-sonnet-5-5[1m]',
    ].forEach((model) => expect(isStudioChatModel(model)).toBe(true));
  });

  it('is never anything that could cross into a command line as more', () => {
    [
      '--dangerously-skip-permissions',
      'Opus',
      'a b',
      'claude-',
      'claude-opus 5',
      'claude-opus-5"',
      'opus[2m]',
      `claude-${'x'.repeat(61)}`,
      7,
    ].forEach((model) => expect(isStudioChatModel(model)).toBe(false));
  });
});

describe('an exact model', () => {
  it.each([
    ['claude-fable-5-2', 'fable', [5, 2]],
    ['claude-opus-5-6', 'opus', [5, 6]],
    ['claude-haiku-4-5-20251001', 'haiku', [4, 5]],
    ['claude-opus-4', 'opus', [4]],
    ['claude-3-5-sonnet-20241022', 'sonnet', [3, 5]],
    ['claude-3-opus-20240229', 'opus', [3]],
  ])('%s is %s %j', (id, family, version) => {
    expect(exactStudioChatModelOf(id)).toEqual({ family, version });
  });

  it('is none for a line, a variant, or a name of no known order', () => {
    ['opus', 'claude-opus-5-5[1m]', 'claude-opus'].forEach((id) =>
      expect(exactStudioChatModelOf(id)).toBeUndefined(),
    );
  });
});

describe('a model offered', () => {
  it('is every line this app knows, whatever the list held', () => {
    ['fable', 'opus', 'sonnet', 'haiku', 'default'].forEach((model) => {
      expect(isStudioChatModelOffered(LISTED, model)).toBe(true);
      expect(isStudioChatModelOffered(NO_STUDIO_CHAT_MODELS, model)).toBe(true);
    });
  });

  it('is anything else only where Claude Code listed it', () => {
    expect(isStudioChatModelOffered(LISTED, 'mythos')).toBe(true);
    expect(isStudioChatModelOffered(LISTED, 'claude-haiku-4-5-20251001')).toBe(
      true,
    );
    expect(isStudioChatModelOffered(LISTED, 'quill')).toBe(false);
    expect(isStudioChatModelOffered(LISTED, 'claude-opus-5-1')).toBe(false);
  });

  it('is never one Claude Code refused, and always Default', () => {
    const refused = { ...LISTED, refused: ['fable', 'mythos'] };
    expect(isStudioChatModelOffered(refused, 'fable')).toBe(false);
    expect(isStudioChatModelOffered(refused, 'mythos')).toBe(false);
    expect(isStudioChatModelOffered(refused, 'opus')).toBe(true);
    expect(isStudioChatModelOffered(refused, 'default')).toBe(true);
  });
});

describe("a plan's name in Claude Code's answer", () => {
  it.each([
    ['Claude Ultra', 'Ultra'],
    ['Claude Max', 'Max'],
    ['Claude Pro', 'Pro'],
    ['Claude Team', 'Team'],
    ['Claude Enterprise', 'Enterprise'],
    ['Claude Max 20x', 'Max 20x'],
  ])('%s is %s', (given, name) => {
    expect(claudePlanNameOf(given)).toBe(name);
  });

  it('is none for an account with no plan, or words that are not a name', () => {
    ['Claude API', 'max', 'Claude ', 'Claude <b>', undefined].forEach((given) =>
      expect(claudePlanNameOf(given)).toBeUndefined(),
    );
  });
});
