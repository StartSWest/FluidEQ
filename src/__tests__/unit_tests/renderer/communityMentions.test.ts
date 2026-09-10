/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  mentionsHandle,
  splitMentions,
} from '../../../renderer/community/mentions';

describe('finding @mentions in a message', () => {
  it('leaves plain text as one segment', () => {
    expect(splitMentions('hello there')).toEqual([
      { kind: 'text', text: 'hello there', start: 0 },
    ]);
  });

  it('splits around a mention, lowercases the handle, and records where each piece starts', () => {
    expect(splitMentions('hey @Ivan_C, look at this')).toEqual([
      { kind: 'text', text: 'hey ', start: 0 },
      { kind: 'mention', text: '@Ivan_C', handle: 'ivan_c', start: 4 },
      { kind: 'text', text: ', look at this', start: 11 },
    ]);
  });

  it('finds several, including at the very start and end', () => {
    const segments = splitMentions('@ada and @bob');
    expect(segments.map((segment) => segment.kind)).toEqual([
      'mention',
      'text',
      'mention',
    ]);
  });

  /** The same bounds the server applies, so screen and notification agree. */
  it('ignores handles that are too short or carry other characters', () => {
    expect(splitMentions('@ab is short').every((s) => s.kind === 'text')).toBe(
      true,
    );
    expect(splitMentions('mail me@example.com')).toEqual([
      { kind: 'text', text: 'mail me', start: 0 },
      { kind: 'mention', text: '@example', handle: 'example', start: 7 },
      { kind: 'text', text: '.com', start: 15 },
    ]);
  });

  it('is empty for an empty body', () => {
    expect(splitMentions('')).toEqual([]);
  });

  it('answers whether a body names a handle, case-insensitively', () => {
    expect(mentionsHandle('ping @ADA please', 'ada')).toBe(true);
    expect(mentionsHandle('ping @adam please', 'ada')).toBe(false);
  });
});
