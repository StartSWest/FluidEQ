/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useSyncExternalStore } from 'react';
import {
  nextBandSelection,
  type SelectionMode,
} from '../../../common/bandSelection';
import type { IVoicingSettings } from '../../../common/constants';
import {
  clampEqBand,
  type IDspSettings,
  type IEqBandSettings,
  type IEqSettings,
} from '../../../common/dsp/chain';
import {
  besideFrequency,
  canAddDraftBand,
  draftBandsOf,
  draftCurveOf,
  freeFrequency,
  newDraftBand,
  type IDraftBand,
} from './presetEditBands';

/**
 * A preset of the listener's own, open for editing (Ivan, 2026-11-20, own
 * presets, Direction A): its curve shaped on the EQ page's graph and band
 * rail, drawn in amber while Your EQ stays as it is, and its rack on the DSP
 * page. Nothing is kept until Save; Discard puts back what played before.
 *
 * The draft plays as it is shaped: as the Preset layer, through the same
 * `dsp:<id>` voicing a preset's pick sends (`PresetEditLive`), and as the
 * rack, which is the DSP page's own while the session lasts.
 *
 * One session at a time, held here rather than in a component: the EQ page,
 * the graph, the DSP page and the shell all read it, from four subtrees.
 */

export interface IPresetEditSession {
  /** The id the preset is kept under: its own, or the one it will get. */
  presetId: string;
  name: string;
  /** Not in the list yet: Discard leaves nothing behind. */
  isNew: boolean;
  /** Every setting of the curve but its bands, as it started. */
  base: IEqSettings;
  bands: readonly IDraftBand[];
  /** Something changed since the session began. */
  isDirty: boolean;
  selectedIds: readonly string[];
  hoveredId: string;
}

/** What played before the session, put back by Discard. */
export interface IPresetEditRestore {
  dsp: IDspSettings;
  voicing: IVoicingSettings | undefined;
}

type TListener = () => void;
const listeners = new Set<TListener>();
let session: IPresetEditSession | undefined;
let restore: IPresetEditRestore | undefined;

const publish = (next: IPresetEditSession | undefined) => {
  session = next;
  listeners.forEach((listener) => listener());
};

const subscribe = (listener: TListener) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const readSession = () => session;

export const usePresetEditSession = (): IPresetEditSession | undefined =>
  useSyncExternalStore(subscribe, readSession, readSession);

export const readPresetEditSession = (): IPresetEditSession | undefined =>
  session;

export const readPresetEditRestore = (): IPresetEditRestore | undefined =>
  restore;

/** The curve the session plays now. */
export const sessionCurve = (one: IPresetEditSession): IEqSettings =>
  draftCurveOf(one.base, one.bands);

/**
 * The name the layer shows while a new preset is being made: it is in no
 * list yet, and "Custom" would be wrong about it.
 */
export const editedPresetName = (presetId: string): string | undefined =>
  session?.presetId === presetId ? session.name : undefined;

export const startPresetEditSession = (
  start: Pick<IPresetEditSession, 'presetId' | 'name' | 'isNew'> & {
    curve: IEqSettings;
  },
  before: IPresetEditRestore,
) => {
  restore = before;
  publish({
    presetId: start.presetId,
    name: start.name,
    isNew: start.isNew,
    base: start.curve,
    bands: draftBandsOf(start.curve),
    isDirty: start.isNew,
    selectedIds: [],
    hoveredId: '',
  });
};

export const endPresetEditSession = () => {
  restore = undefined;
  publish(undefined);
};

const update = (
  make: (one: IPresetEditSession) => Partial<IPresetEditSession> | undefined,
) => {
  if (!session) {
    return;
  }
  const patch = make(session);
  if (patch) {
    publish({ ...session, ...patch });
  }
};

/** Edits to bands by id, each bounded as the curve will keep it. */
export const editDraftBands = (
  edits: ReadonlyArray<{ id: string; patch: Partial<IEqBandSettings> }>,
) =>
  update((one) => {
    const byId = new Map(edits.map((edit) => [edit.id, edit.patch]));
    let changed = false;
    const bands = one.bands.map((draft) => {
      const patch = byId.get(draft.id);
      if (!patch) {
        return draft;
      }
      const band = clampEqBand({ ...draft.band, ...patch }, draft.band);
      changed = true;
      return { id: draft.id, band };
    });
    return changed ? { bands, isDirty: true } : undefined;
  });

const addBandAt = (frequency: number) =>
  update((one) => {
    if (!canAddDraftBand(one.bands)) {
      return undefined;
    }
    const added = newDraftBand(one.bands, frequency);
    return {
      bands: [...one.bands, added],
      selectedIds: [added.id],
      isDirty: true,
    };
  });

/** A flat bell where the spectrum is emptiest, selected. */
export const addDraftBand = () => {
  if (session) {
    addBandAt(freeFrequency(session.bands));
  }
};

export const addDraftBandBeside = (id: string, side: 'left' | 'right') => {
  const beside = session?.bands.find((one) => one.id === id);
  if (beside) {
    addBandAt(besideFrequency(beside.band.frequency, side));
  }
};

export const removeDraftBands = (ids: readonly string[]) =>
  update((one) => {
    const bands = one.bands.filter((draft) => !ids.includes(draft.id));
    return bands.length === one.bands.length
      ? undefined
      : {
          bands,
          selectedIds: one.selectedIds.filter((id) => !ids.includes(id)),
          isDirty: true,
        };
  });

export const selectDraftBands = (ids: readonly string[]) =>
  update(() => ({ selectedIds: [...ids] }));

export const nextDraftSelection = (id: string, mode: SelectionMode) =>
  nextBandSelection(session?.selectedIds ?? [], id, mode);

export const hoverDraftBand = (id: string) =>
  update((one) => (one.hoveredId === id ? undefined : { hoveredId: id }));

/** The rack moved on the DSP page: the session has something to keep. */
export const markPresetEditDirty = () =>
  update((one) => (one.isDirty ? undefined : { isDirty: true }));
