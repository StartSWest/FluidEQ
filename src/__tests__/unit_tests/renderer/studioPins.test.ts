/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The Studio's pins (Ivan, 2026-11-13: "pin chats / projects to the top"):
 * newest pin first, the rest in their own order; kept per account on this
 * computer across a restart; dropped with what they pin. Each case beside
 * the one that must not.
 */

const account: { identity?: { id: string } } = { identity: { id: 'ana' } };
jest.mock('../../../renderer/account/accountStore', () => ({
  getAccountSnapshot: () => account,
  useAccount: () => account,
}));

/* eslint-disable import/first -- the mock must be installed first */
import {
  dropChatPin,
  keepPinsFor,
  pinnedFirst,
  readStoredPins,
  resetStudioPinsCache,
  toggleChatPin,
  toggleProjectPin,
} from '../../../renderer/studio/studioPins';
/* eslint-enable import/first */

const stored = (id: string) =>
  readStoredPins(window.localStorage.getItem(`fluideq.studio.pins.v1:${id}`));

beforeEach(() => {
  window.localStorage.clear();
  account.identity = { id: 'ana' };
  resetStudioPinsCache();
});

describe('the order', () => {
  const list = ['a', 'b', 'c', 'd'];

  it('puts the newest pin first, then the rest as they were', () => {
    expect(pinnedFirst(list, ['d', 'b'], (id) => id)).toEqual([
      'd',
      'b',
      'a',
      'c',
    ]);
  });

  it('leaves the list as it is with nothing pinned, or a pin it does not hold', () => {
    expect(pinnedFirst(list, [], (id) => id)).toEqual(list);
    expect(pinnedFirst(list, ['gone'], (id) => id)).toEqual(list);
  });
});

describe('pinning', () => {
  it('puts the newest pin at the top, and unpinning takes it out', () => {
    toggleProjectPin('a');
    toggleProjectPin('b');
    expect(stored('ana').projects).toEqual(['b', 'a']);
    toggleProjectPin('a');
    expect(stored('ana').projects).toEqual(['b']);
  });

  it('keeps the pins across a restart, for the account that made them', () => {
    toggleProjectPin('a');
    toggleChatPin('a', 'chat-1');
    // A fresh window reads them back.
    resetStudioPinsCache();
    expect(stored('ana')).toEqual({
      projects: ['a'],
      chats: { a: ['chat-1'] },
    });
    // Another member on the same computer has none of them.
    account.identity = { id: 'bo' };
    expect(stored('bo')).toEqual({ projects: [], chats: {} });
    toggleProjectPin('z');
    expect(stored('bo').projects).toEqual(['z']);
    expect(stored('ana').projects).toEqual(['a']);
  });

  it('drops a deleted chat’s pin, and only that one', () => {
    toggleChatPin('a', 'chat-1');
    toggleChatPin('a', 'chat-2');
    dropChatPin('a', 'chat-1');
    expect(stored('ana').chats).toEqual({ a: ['chat-2'] });
    dropChatPin('a', 'chat-2');
    expect(stored('ana').chats).toEqual({});
  });

  it('drops the pins of a project the Studio no longer lists, chats with it', () => {
    toggleProjectPin('a');
    toggleProjectPin('b');
    toggleChatPin('b', 'chat-1');
    toggleChatPin('a', 'chat-2');
    keepPinsFor(['a', 'c']);
    expect(stored('ana')).toEqual({
      projects: ['a'],
      chats: { a: ['chat-2'] },
    });
  });

  it('reads anything that is not pins as nothing pinned', () => {
    // A name that is not JSON says so in the log, and opens with none.
    const said = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(readStoredPins('not json')).toEqual({ projects: [], chats: {} });
    expect(said).toHaveBeenCalledTimes(1);
    said.mockRestore();
    expect(readStoredPins('{"projects":[1],"chats":{"a":"x"}}')).toEqual({
      projects: [],
      chats: {},
    });
    // The control: real pins read whole.
    expect(readStoredPins('{"projects":["a"],"chats":{"a":["c"]}}')).toEqual({
      projects: ['a'],
      chats: { a: ['c'] },
    });
  });
});
