/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { type AnimationEvent, useCallback, useState } from 'react';

export type TRowPhase = 'stay' | 'enter' | 'leave';

export interface IPresentRow<T> {
  key: string;
  item: T;
  phase: TRowPhase;
}

interface ILeaving<T> {
  key: string;
  item: T;
  /** Where it stood, to stand there while it leaves. */
  index: number;
}

interface ISeen<T> {
  signature: string;
  keys: readonly string[];
  byKey: ReadonlyMap<string, T>;
}

const prefersReducedMotion = () =>
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * A list that shows its rows arriving and leaving (`row-presence` in
 * `_motion.scss`): a row that appears after the list was first drawn is
 * marked `enter`, and one that disappears stays where it stood, marked
 * `leave`, until its own `row-leave` ends — no duration is written here; the
 * stylesheet decides and the row says when it is done. The rows the list
 * opens with are `stay`: they arrive with whatever brought the list in.
 *
 * The change is taken during render, React's way of keeping something from
 * the render before: the render that drops a row is thrown away and run again
 * with the row kept as leaving, so the row is never unmounted on its way out.
 * Taken after the commit instead, a row asking "Delete …?" was removed and
 * mounted again for its leaving, and folded out as a plain row.
 *
 * With motion off nothing plays, so nothing is kept back: the list swaps at
 * once, as it always did.
 */
const usePresenceList = <T>(
  items: readonly T[],
  keyOf: (item: T) => string,
) => {
  const keys = items.map(keyOf);
  const signature = keys.join('\n');
  const [seen, setSeen] = useState<ISeen<T> | undefined>(undefined);
  const [leaving, setLeaving] = useState<readonly ILeaving<T>[]>([]);
  const [entering, setEntering] = useState<ReadonlySet<string>>(new Set());

  if (seen?.signature !== signature) {
    setSeen({
      signature,
      keys,
      byKey: new Map(items.map((item, index) => [keys[index], item])),
    });
    if (seen && !prefersReducedMotion()) {
      const now = new Set(keys);
      const gone = seen.keys
        .map((key, index) => ({ key, index }))
        .filter(({ key }) => !now.has(key));
      const added = keys.filter((key) => !seen.byKey.has(key));
      if (gone.length > 0) {
        setLeaving((was) => [
          // One that came back is no longer leaving.
          ...was.filter((row) => !now.has(row.key)),
          ...gone.flatMap(({ key, index }) => {
            const item = seen.byKey.get(key);
            return item === undefined ? [] : [{ key, item, index }];
          }),
        ]);
      }
      if (added.length > 0) {
        setEntering((was) => new Set([...was, ...added]));
      }
    }
  }

  const rows: IPresentRow<T>[] = items.map((item, index) => ({
    key: keys[index],
    item,
    phase: entering.has(keys[index]) ? 'enter' : 'stay',
  }));
  leaving
    .filter((row) => !keys.includes(row.key))
    .sort((a, b) => a.index - b.index)
    .forEach((row) => {
      rows.splice(Math.min(row.index, rows.length), 0, {
        key: row.key,
        item: row.item,
        phase: 'leave',
      });
    });

  /** A row's own `animationend`: its arrival or its leaving is over. */
  const onRowAnimationEnd = useCallback(
    (key: string) => (event: AnimationEvent) => {
      if (event.target !== event.currentTarget) {
        return;
      }
      if (event.animationName === 'row-leave') {
        setLeaving((was) => was.filter((row) => row.key !== key));
      } else if (event.animationName === 'row-enter') {
        setEntering((was) => {
          const next = new Set(was);
          next.delete(key);
          return next;
        });
      }
    },
    [],
  );

  return { rows, onRowAnimationEnd };
};

/** The class a row wears while it arrives or leaves (`row-presence`). */
export const rowPhaseClass = (phase: TRowPhase): string | undefined => {
  if (phase === 'enter') {
    return 'is-entering';
  }
  return phase === 'leave' ? 'is-leaving' : undefined;
};

export default usePresenceList;
