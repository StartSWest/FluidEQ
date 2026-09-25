/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { recallRecent, rememberRecent } from 'renderer/utils/recentMap';

it('lets go of the entry written longest ago once past its limit', () => {
  const map = new Map<string, number>();
  ['a', 'b', 'c', 'd'].forEach((key, index) =>
    rememberRecent(map, key, index, 3),
  );
  expect(Array.from(map.keys())).toEqual(['b', 'c', 'd']);
});

it('counts a read as a use, so the entry let go is the one nobody asked for', () => {
  const map = new Map<string, number>();
  ['a', 'b', 'c'].forEach((key, index) => rememberRecent(map, key, index, 3));
  expect(recallRecent(map, 'a')).toBe(0);
  rememberRecent(map, 'd', 3, 3);
  expect(Array.from(map.keys())).toEqual(['c', 'a', 'd']);
  expect(recallRecent(map, 'b')).toBeUndefined();
});

it('rewrites an entry in place of growing', () => {
  const map = new Map<string, number>();
  rememberRecent(map, 'a', 1, 2);
  rememberRecent(map, 'b', 2, 2);
  rememberRecent(map, 'a', 3, 2);
  expect(Array.from(map.entries())).toEqual([
    ['b', 2],
    ['a', 3],
  ]);
});
