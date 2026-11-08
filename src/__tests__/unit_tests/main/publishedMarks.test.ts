/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * @jest-environment node
 */

/**
 * The project list's publication marks are read apart from any announcement
 * (`publishedMarks.ts`): a walk of 52 OneDrive folders took 330 ms on the
 * window's thread, on every save. Read only while the list can be seen, the
 * Studio told only when a mark moved, and asks made during a pass gathered
 * into one more.
 */

import type { IProjectPublished } from '../../../main/memberScenes/publishedRecords';
import { createPublishedMarks } from '../../../main/memberScenes/publishedMarks';

const lake: IProjectPublished = {
  sceneId: 'lake',
  version: 3,
  unchanged: true,
};

/**
 * Settles every pass queued so far, without a clock: the stand-in reads
 * resolve as promise steps alone, and a pass takes a dozen or so of them.
 */
const settle = async () => {
  for (let turn = 0; turn < 50; turn += 1) {
    // eslint-disable-next-line no-await-in-loop -- one microtask turn each, in order
    await Promise.resolve();
  }
};

const setUp = (open = true) => {
  const states = new Map<string, IProjectPublished>([['C:/Lake', lake]]);
  const stateOf = jest.fn(async (folder: string) => states.get(folder));
  const adopt = jest.fn(async () => false);
  const changed = jest.fn();
  let isOpen = open;
  const marks = createPublishedMarks({
    stateOf,
    adopt,
    folders: () => ['C:/Lake', 'C:/City'],
    isOpen: () => isOpen,
    changed,
  });
  return {
    marks,
    states,
    stateOf,
    adopt,
    changed,
    open: () => {
      isOpen = true;
    },
    close: () => {
      isOpen = false;
    },
  };
};

it('reads every folder, recognising old publications first, and tells the Studio once', async () => {
  const { marks, adopt, changed } = setUp();
  expect(marks.of('C:/Lake')).toBeUndefined();
  marks.refresh();
  await settle();
  expect(adopt).toHaveBeenCalledWith(['C:/Lake', 'C:/City']);
  expect(marks.of('C:/Lake')).toEqual(lake);
  expect(marks.of('C:/City')).toBeUndefined();
  expect(changed).toHaveBeenCalledTimes(1);
});

it('tells the Studio nothing when no mark moved, and again when one did', async () => {
  const { marks, states, changed } = setUp();
  marks.refresh();
  await settle();
  marks.refresh('C:/Lake');
  await settle();
  expect(changed).toHaveBeenCalledTimes(1);
  states.set('C:/Lake', { ...lake, unchanged: false });
  marks.refresh('C:/Lake');
  await settle();
  expect(changed).toHaveBeenCalledTimes(2);
  expect(marks.of('C:/Lake')?.unchanged).toBe(false);
});

it('reads only the folder named, without recognising anything', async () => {
  const { marks, stateOf, adopt } = setUp();
  marks.refresh('C:/Lake');
  await settle();
  expect(stateOf.mock.calls).toEqual([['C:/Lake']]);
  expect(adopt).not.toHaveBeenCalled();
});

it('gathers the asks made during a pass into one more', async () => {
  const { marks, stateOf } = setUp();
  marks.refresh('C:/Lake');
  marks.refresh('C:/Lake');
  marks.refresh('C:/Lake');
  await settle();
  // The first ask runs at once; the two made while it ran are one pass.
  expect(stateOf).toHaveBeenCalledTimes(2);
});

it('reads nothing while the list cannot be seen', async () => {
  const { marks, stateOf, open } = setUp(false);
  marks.refresh();
  await settle();
  expect(stateOf).not.toHaveBeenCalled();
  // The control: the same ask once the Studio is open.
  open();
  marks.refresh();
  await settle();
  expect(stateOf).toHaveBeenCalled();
});

it('drops what was gathered once the Studio closes mid-pass', async () => {
  const { marks, stateOf, close } = setUp();
  marks.refresh('C:/Lake');
  // Asked while the first pass runs, then the Studio closes before it ends.
  marks.refresh('C:/City');
  close();
  await settle();
  expect(stateOf.mock.calls).toEqual([['C:/Lake']]);
});
