/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  dismissToast,
  emptyToasts,
  reconcileToasts,
  removeToast,
  sameSources,
  type IPlusToastState,
  type TPlusToastSources,
} from '../../../renderer/plus/toastStack';

/**
 * The rules the Plus tab's toasts follow, held without a DOM: what raises a
 * toast, what sends one out, and that a replacement never reuses a key.
 */

interface INotice {
  ok: boolean;
  text: string;
}

type TSources = TPlusToastSources<INotice>;

const done = (text: string): INotice => ({ ok: true, text });
const problem = (text: string): INotice => ({ ok: false, text });

/** The stack after the sources move through each step in turn, from nothing. */
const through = (...steps: TSources[]): IPlusToastState<INotice> => {
  let state = emptyToasts<INotice>();
  let before: TSources = {};
  steps.forEach((after) => {
    state = reconcileToasts(state, before, after);
    before = after;
  });
  return state;
};

/** What each toast shows and whether it is on its way out, newest first. */
const shown = (state: IPlusToastState<INotice>) =>
  state.toasts.map(({ source, notice, leaving }) => ({
    source,
    text: notice.text,
    leaving,
  }));

describe('raising toasts', () => {
  it('puts a new notice on top of what is already up', () => {
    const published = done('is in the gallery');
    const exported = done('was exported');
    const state = through(
      { publish: published },
      { publish: published, export: exported },
    );
    expect(shown(state)).toEqual([
      { source: 'export', text: 'was exported', leaving: false },
      { source: 'publish', text: 'is in the gallery', leaving: false },
    ]);
  });

  it('sends out what an action said before when it speaks again', () => {
    const state = through(
      { publish: problem('could not be published') },
      { publish: done('is in the gallery') },
    );
    expect(shown(state)).toEqual([
      { source: 'publish', text: 'is in the gallery', leaving: false },
      { source: 'publish', text: 'could not be published', leaving: true },
    ]);
  });

  // Saying "Neon City is in your looks" twice has to show it twice: a toast is
  // raised by a new object, never by new text.
  it('raises an equal notice again when it is a new object', () => {
    const first = done('Neon City is in your looks');
    const again = done('Neon City is in your looks');
    expect(sameSources({ add: first }, { add: again })).toBe(false);
    const state = through({ add: first }, { add: again });
    expect(shown(state)).toEqual([
      { source: 'add', text: 'Neon City is in your looks', leaving: false },
      { source: 'add', text: 'Neon City is in your looks', leaving: true },
    ]);
  });

  // The control for the case above: the very same object is a re-render, not
  // the action speaking, and raises nothing.
  it('raises nothing when the same object comes round again', () => {
    const notice = done('Neon City is in your looks');
    expect(sameSources({ add: notice }, { add: notice })).toBe(true);
    const state = through({ add: notice }, { add: notice });
    expect(shown(state)).toEqual([
      { source: 'add', text: 'Neon City is in your looks', leaving: false },
    ]);
  });
});

describe('an action taking its notice back', () => {
  it('sends out a problem, and leaves a success up', () => {
    const failed = problem('could not be published');
    const saved = done('picture saved');
    const state = through(
      { publish: failed, picture: saved },
      { publish: undefined, picture: undefined },
    );
    expect(shown(state)).toEqual([
      { source: 'picture', text: 'picture saved', leaving: false },
      { source: 'publish', text: 'could not be published', leaving: true },
    ]);
  });

  it('counts a source that is gone from the record as taken back', () => {
    const state = through({ publish: problem('could not be published') }, {});
    expect(shown(state)).toEqual([
      { source: 'publish', text: 'could not be published', leaving: true },
    ]);
  });

  it('touches only the toasts of the action that took its notice back', () => {
    const exportFailed = problem('could not be exported');
    const state = through(
      { publish: problem('could not be published'), export: exportFailed },
      { publish: undefined, export: exportFailed },
    );
    expect(shown(state)).toEqual([
      { source: 'export', text: 'could not be exported', leaving: false },
      { source: 'publish', text: 'could not be published', leaving: true },
    ]);
  });
});

describe('closing and removing', () => {
  it('marks the dismissed toast as leaving and nothing else', () => {
    const published = done('is in the gallery');
    const state = through(
      { publish: published },
      { publish: published, export: done('was exported') },
    );
    const [newest] = state.toasts;
    expect(shown(dismissToast(state, newest.id))).toEqual([
      { source: 'export', text: 'was exported', leaving: true },
      { source: 'publish', text: 'is in the gallery', leaving: false },
    ]);
  });

  it('leaves the stack as it was when the id is not up', () => {
    const state = through({ publish: done('is in the gallery') });
    expect(dismissToast(state, 99).toasts).toEqual(state.toasts);
    expect(removeToast(state, 99).toasts).toEqual(state.toasts);
  });

  it('removes exactly the toast whose exit has been drawn', () => {
    const published = done('is in the gallery');
    const state = through(
      { publish: published },
      { publish: published, export: done('was exported') },
    );
    const [, oldest] = state.toasts;
    const removed = removeToast(state, oldest.id);
    expect(shown(removed)).toEqual([
      { source: 'export', text: 'was exported', leaving: false },
    ]);
    expect(removed.count).toBe(state.count);
  });
});

describe('toast ids', () => {
  // An id is a React key: a replacement that reused one would be patched into
  // the leaving card instead of arriving as a card of its own.
  it('never hands out the same id twice, even after every toast is gone', () => {
    const ids = new Set<number>();
    let state = emptyToasts<INotice>();
    let before: TSources = {};
    const speak = (after: TSources) => {
      state = reconcileToasts(state, before, after);
      before = after;
      state.toasts.forEach((toast) => ids.add(toast.id));
    };

    speak({ publish: done('one') });
    speak({ publish: done('two'), export: problem('three') });
    speak({ publish: done('four') });
    state.toasts.forEach((toast) => {
      state = removeToast(state, toast.id);
    });
    expect(state.toasts).toEqual([]);
    speak({ publish: done('five') });

    expect(ids.size).toBe(5);
    expect(state.count).toBe(5);
    expect(state.toasts.map((toast) => toast.id)).toEqual([4]);
  });
});
