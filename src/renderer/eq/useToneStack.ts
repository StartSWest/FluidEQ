/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from 'react';
import { IFilter, IFilterEdit, NO_GAIN_FILTER_TYPES } from 'common/constants';
import { ErrorDescription } from 'common/errors';
import {
  FLAT_TONE,
  fitToneStack,
  IToneBase,
  IToneStack,
  openToneStack,
  rebaseToneStack,
  toneRegionOf,
} from '../../common/toneStack';
import { setFilterValues } from '../utils/equalizerApi';
import { FilterActionEnum, useFluidEqContext } from '../utils/FluidEqContext';
import { useThrottleAndExecuteLatest } from '../utils/utils';
import GROUP_EDIT_INTERVAL from './groupEdit';
import { takeToneClear, takeToneReapply } from './toneIntent';
import { recallTone, rememberTone } from './toneMemory';

/**
 * Everything about the rack a fit depends on, as one string.
 *
 * The tone controls hold a snapshot of what the rack was doing before they
 * were touched, and must not read it again out of their own writing — that
 * would feed each turn's rounding into the next and walk the curve away over
 * a long session. This is how they tell their own edit from somebody moving a
 * band, loading a preset or switching a band off underneath them.
 */
const rackSignature = (bands: readonly IFilter[]): string =>
  bands
    .map(
      (band) =>
        `${band.id}:${band.type}:${band.frequency}:${band.gain}:${band.quality}:${
          band.isEnabled === false ? 0 : 1
        }`,
    )
    .join('|');

/**
 * How many bands there are, which is the one thing that rewrites the tone.
 *
 * The band count swapped, a band added, a band deleted: each of those is a
 * rack built fresh, and the three tone values are written onto it so it
 * carries the same tone the last one did — without which the fifteen gains a
 * conversion spreads over thirty-one frequencies leave the gaps at zero and
 * the curve is 6.7 dB away from the tone the dials still claim.
 *
 * Nothing else does. Not a gain, a width, a type or the on/off switch, and
 * deliberately not a preset or a profile landing on the same bands — those
 * are a tuning somebody chose, and writing the tone over the top of one would
 * be this page fighting the picker one panel along.
 */
const rackSize = (bands: readonly IFilter[]): number => bands.length;

/** Low to high, the order a tone stack is read in. */
export const TONE_CONTROLS: readonly {
  knob: keyof IToneStack;
  labelKey: 'eq.tone.bass' | 'eq.tone.mid' | 'eq.tone.treble';
}[] = [
  { knob: 'bass', labelKey: 'eq.tone.bass' },
  { knob: 'mid', labelKey: 'eq.tone.mid' },
  { knob: 'treble', labelKey: 'eq.tone.treble' },
];

const isSameTone = (one: IToneStack, other: IToneStack) =>
  one.bass === other.bass &&
  one.mid === other.mid &&
  one.treble === other.treble;

/**
 * The three values, one copy for the window.
 *
 * Two surfaces show them — the EQ page when no band is selected, and the
 * compact player's Tone face — and the EQ page stays mounted, out of sight,
 * while the window is the player. Kept in each one's own state, a dial turned
 * in the player came back to the EQ page at its old value, and the next turn
 * there was fitted against a tone the rack no longer had.
 */
let sharedTone: IToneStack = FLAT_TONE;
const toneListeners = new Set<() => void>();

const setSharedTone = (next: IToneStack) => {
  if (isSameTone(next, sharedTone)) {
    return;
  }
  sharedTone = next;
  toneListeners.forEach((listener) => listener());
};

const useSharedTone = () =>
  useSyncExternalStore(
    (listener) => {
      toneListeners.add(listener);
      return () => {
        toneListeners.delete(listener);
      };
    },
    () => sharedTone,
  );

interface IToneSnapshot {
  base: IToneBase;
  signature: string;
  size: number;
  /** The values the base was taken against. */
  tone: IToneStack;
}

/**
 * Bass, Mid and Treble over the whole rack.
 *
 * The three values are read out of the curve rather than stored beside it —
 * the rack has nowhere to keep them — and the snapshot they are fitted
 * against is taken once, when the controls appear, so turning a dial back
 * where it was returns the curve it started from. See `toneStack.ts`.
 *
 * `bands` are the rack sorted by frequency; `isShowing` is whether the dials
 * are on screen, and the snapshot is dropped while they are not. Any number
 * of surfaces may use this at once: the values are shared, each keeps its own
 * snapshot, and the one-shot requests (`toneIntent.ts`) are taken by
 * whichever sees them first, which writes what it found into the values the
 * others read.
 */
const useToneStack = (bands: IFilter[], isShowing: boolean) => {
  const { dispatchFilter, setGlobalError } = useFluidEqContext();
  const tone = useSharedTone();
  const toneRef = useRef<IToneSnapshot | undefined>(undefined);
  const bandSignature = useMemo(() => rackSignature(bands), [bands]);
  const bandCount = rackSize(bands);
  const canShapeTone = bands.some(
    (filter) =>
      filter.isEnabled !== false && !NO_GAIN_FILTER_TYPES.includes(filter.type),
  );

  const flushToneEdit = useCallback(
    async (edits: IFilterEdit[]) => {
      try {
        await setFilterValues(edits);
      } catch (e) {
        setGlobalError(e as ErrorDescription);
      }
    },
    [setGlobalError],
  );
  const throttledToneFlush = useThrottleAndExecuteLatest(
    flushToneEdit,
    GROUP_EDIT_INTERVAL,
  );

  /**
   * The three values are the source, and the curve follows from them.
   *
   * They used to be worked out from the curve every time the controls
   * appeared, by fitting the three shapes to it — lossy in both directions,
   * because the rack cannot make an ideal shelf and the fit that writes one
   * is deliberately local and smooth. Treble set to 8 read back as 7.2 with
   * -0.8 of Bass and -1.5 of Mid beside it; Bass -6 with Mid +3 read as
   * -8.2 / +3.5 / -2.6. Leaving the page and returning moved every dial, and
   * changing the band count made a mess of the curve as well, because the
   * conversion carries fifteen gains onto thirty-one frequencies and leaves
   * the gaps at zero.
   *
   * So the values are kept (`toneMemory.ts`) and written onto whatever rack
   * is in front of them. The curve is read for them exactly once, when there
   * is nothing kept — a first run, or storage cleared.
   */
  useEffect(() => {
    if (!isShowing) {
      toneRef.current = undefined;
      return;
    }
    // The values as they are now, not as this render had them: another
    // surface's effect in the same commit may have just taken a request and
    // written what it found (`sharedTone` changes at once, a render later).
    const current = sharedTone;
    const held = toneRef.current;
    if (held?.signature === bandSignature && isSameTone(held.tone, current)) {
      return;
    }
    const snapshot = (rack: IFilter[], values: IToneStack) => ({
      base: rebaseToneStack(rack, values),
      signature: rackSignature(rack),
      size: bandCount,
      tone: values,
    });
    // Clear EQ, and only when the button itself said so. Reading it off the
    // rack instead — every gain at zero — caught the moment between engines
    // where the old rack has gone and the new one has not arrived, and the
    // curve came back with all three dials sitting at 0.0.
    if (takeToneClear()) {
      setSharedTone(FLAT_TONE);
      rememberTone(FLAT_TONE);
      toneRef.current = snapshot(bands, FLAT_TONE);
      return;
    }
    if (!held) {
      const shown = recallTone() ?? openToneStack(bands).tone;
      setSharedTone(shown);
      rememberTone(shown);
      toneRef.current = snapshot(bands, shown);
      return;
    }
    if (held.size === bandCount) {
      // The same rack set differently — our own edit landing, a band slider
      // dragged, the other surface's dial. The dials stand; only what they
      // are measured against moves.
      toneRef.current = snapshot(bands, current);
      return;
    }
    /**
     * A different rack, so the values are written onto it again.
     *
     * Whatever tone the conversion happened to carry across comes off first,
     * which is what keeps this from adding a second copy of the same shelf
     * every time the band count is changed. What it cannot explain — a dip
     * somebody put in by hand — is left in place and carried through.
     *
     * Three things are not that, and none of them may write anything. A rack
     * nobody asked to rebuild — a profile loading its own bands changes the
     * count as surely as the layout menu does, and writing a shelf over
     * somebody's profile is the one thing this page may not do. Dials at
     * zero, which have no tone to put anywhere and would instead STRIP what
     * the conversion carried. And a rack arriving where there was none, which
     * is the page loading rather than anybody changing anything.
     */
    const nothingToWrite =
      !takeToneReapply() || held.size === 0 || isSameTone(current, FLAT_TONE);
    if (nothingToWrite) {
      toneRef.current = snapshot(bands, current);
      return;
    }
    const carried = openToneStack(bands).tone;
    const base = rebaseToneStack(bands, carried);
    const edits = fitToneStack(bands, base, current);
    const moved = new Map(edits.map((edit) => [edit.id, edit.gain]));
    const next = bands.map((filter) => {
      const gain = moved.get(filter.id);
      return gain === undefined ? filter : { ...filter, gain };
    });
    toneRef.current = snapshot(next, current);
    if (edits.length === 0) {
      return;
    }
    dispatchFilter({ type: FilterActionEnum.EDITS, edits });
    setFilterValues(edits).catch((e) => setGlobalError(e as ErrorDescription));
  }, [
    bandCount,
    bandSignature,
    bands,
    dispatchFilter,
    isShowing,
    setGlobalError,
    tone,
  ]);

  /**
   * One dial back to flat, and only the bands it speaks for.
   *
   * Absolute, like the band editor's own gain reset: every band in that third
   * of the spectrum goes to 0 dB. Turning the dial to zero would only take out
   * the share of the curve the three shapes can account for, which after a
   * change of band count leaves a top end that reads flat on the dial and is
   * not — reported as exactly that.
   *
   * The dial goes to zero whether or not a band moves with it. A dial reads
   * the whole curve, so a big lift at one end shows as a small reading at the
   * other even with every band there already flat: returning early on "no
   * bands to change" left exactly those dials — the ones that look wrong —
   * unable to be put right, which is how this was reported.
   */
  const resetToneRegion = async (knob: keyof IToneStack) => {
    const edits: IFilterEdit[] = bands
      .filter(
        (filter) =>
          filter.gain !== 0 &&
          !NO_GAIN_FILTER_TYPES.includes(filter.type) &&
          toneRegionOf(filter.frequency) === knob,
      )
      .map((filter) => ({ id: filter.id, gain: 0 }));
    // This dial to zero and the other two exactly where they are. Reading all
    // three back out of the flattened curve instead would move them: a curve
    // that rises at the bottom and is level on top is partly a bass lift and
    // partly a treble cut, so pressing reset on Treble landed it at -1.8 and
    // took two decibels off Bass on the way.
    const flattened = new Map(edits.map((edit) => [edit.id, edit.gain]));
    const next = bands.map((filter) => {
      const gain = flattened.get(filter.id);
      return gain === undefined ? filter : { ...filter, gain };
    });
    const kept: IToneStack = { ...sharedTone, [knob]: 0 };
    setSharedTone(kept);
    rememberTone(kept);
    toneRef.current = {
      base: rebaseToneStack(next, kept),
      signature: rackSignature(next),
      size: bandCount,
      tone: kept,
    };
    if (edits.length === 0) {
      return;
    }
    dispatchFilter({ type: FilterActionEnum.EDITS, edits });
    try {
      await setFilterValues(edits);
    } catch (e) {
      setGlobalError(e as ErrorDescription);
    }
  };

  const applyTone = async (next: IToneStack, knob: keyof IToneStack) => {
    const held = toneRef.current;
    if (!held) {
      return;
    }
    setSharedTone(next);
    rememberTone(next);
    const edits = fitToneStack(
      bands,
      held.base,
      next,
      // Only the bands this dial speaks for, so turning Treble is a treble
      // move and nothing else.
      knob,
    );
    // Claim the rack this edit is about to produce, so the snapshot above
    // survives the round trip instead of being rebuilt from our own writing —
    // and the values with it, even when the turn moved no band, or the
    // snapshot would be taken again for a tone that is only ours.
    const moved = new Map(edits.map((edit) => [edit.id, edit.gain]));
    toneRef.current = {
      base: held.base,
      signature: rackSignature(
        bands.map((filter) => {
          const gain = moved.get(filter.id);
          return gain === undefined ? filter : { ...filter, gain };
        }),
      ),
      size: held.size,
      tone: next,
    };
    if (edits.length === 0) {
      return;
    }
    dispatchFilter({ type: FilterActionEnum.EDITS, edits });
    await throttledToneFlush(edits);
  };

  return { tone, canShapeTone, applyTone, resetToneRegion };
};

export default useToneStack;
