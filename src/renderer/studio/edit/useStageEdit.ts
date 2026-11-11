/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useMemo, useSyncExternalStore } from 'react';
import type { IScenePack } from 'common/scenePacks';
import {
  createStageEdit,
  type IStageEditState,
  type IStageEditStore,
} from './stageEditStore';

const CLOSED = { ok: false as const, reason: 'closed' as const };

/** Whether a key press belongs to something being typed into. */
const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable ||
    ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));

/**
 * Edit mode for one project on the stage (`stageEditStore.ts`): made new
 * with each project, told of the pack on the bench, and given the keys an
 * editor has — Ctrl+Z and Ctrl+Y (or Ctrl+Shift+Z), Ctrl+S to save, W, E
 * and R for the tools, Delete, Escape and F to go to the picked thing —
 * only while Edit is on and nothing is being typed.
 *
 * The keys are taken before anything else in the window hears them: Ctrl+Z
 * under Edit mode undoes the last change to the scene and nothing else.
 */
const useStageEdit = (identity: string, pack: IScenePack): IStageEditStore => {
  const store = useMemo(
    () =>
      createStageEdit({
        save: (ops) =>
          window.electron?.ipcRenderer?.editStudioWorld?.(ops) ??
          Promise.resolve(CLOSED),
      }),
    // A new project starts Edit mode from nothing.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `identity` is the project; the store reads nothing from it
    [identity],
  );
  useEffect(() => store.setPack(pack), [store, pack]);
  const on = useSyncExternalStore(store.subscribe, () => store.state().on);
  useEffect(() => {
    if (!on) {
      return undefined;
    }
    const onKey = (event: KeyboardEvent) => {
      if (isTyping(event.target)) {
        return;
      }
      const key = event.key.toLowerCase();
      const command = event.ctrlKey || event.metaKey;
      if (command && key === 'z') {
        if (event.shiftKey) {
          store.redo();
        } else {
          store.undo();
        }
      } else if (command && key === 'y') {
        store.redo();
      } else if (command && key === 's') {
        store.save();
      } else if (command || event.altKey) {
        return;
      } else if (key === 'w') {
        store.setTool('move');
      } else if (key === 'e') {
        store.setTool('turn');
      } else if (key === 'r') {
        store.setTool('size');
      } else if (key === 'f') {
        store.viewThing();
      } else if (key === 'delete' || key === 'backspace') {
        store.remove();
      } else if (key === 'escape') {
        store.clearSelection();
      } else {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
    };
    window.addEventListener('keydown', onKey, { capture: true });
    return () =>
      window.removeEventListener('keydown', onKey, { capture: true });
  }, [on, store]);
  return store;
};

export const useStageEditState = (store: IStageEditStore): IStageEditState =>
  useSyncExternalStore(store.subscribe, store.state);

export default useStageEdit;
