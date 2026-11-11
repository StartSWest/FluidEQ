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

const CLOSED = {
  ok: false as const,
  reason: 'closed' as const,
  history: { canUndo: false, canRedo: false },
};

/** Whether a key press belongs to something being typed into. */
const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable ||
    ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));

/**
 * Edit mode for one project on the stage (`stageEditStore.ts`): made new
 * with each project, told of the pack on the bench, and given the keys an
 * editor has — W, E and R for the tools, Delete, Escape, F to go to the
 * picked thing, Ctrl+Z and Ctrl+Y — only while Edit is on and nothing is
 * being typed.
 */
const useStageEdit = (identity: string, pack: IScenePack): IStageEditStore => {
  const store = useMemo(
    () =>
      createStageEdit({
        edit: (ops) =>
          window.electron?.ipcRenderer?.editStudioWorld?.(ops) ??
          Promise.resolve(CLOSED),
        step: (direction) =>
          window.electron?.ipcRenderer?.stepStudioWorld?.(direction) ??
          Promise.resolve(CLOSED),
        history: () =>
          window.electron?.ipcRenderer?.readStudioWorldHistory?.() ??
          Promise.resolve(CLOSED.history),
      }),
    // A new project starts Edit mode from nothing.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `identity` is the project; the store reads nothing from it
    [identity],
  );
  const nodes = pack.world?.nodes;
  useEffect(() => store.setNodes(nodes), [store, nodes]);
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
        store.step(event.shiftKey ? 'redo' : 'undo');
      } else if (command && key === 'y') {
        store.step('redo');
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
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [on, store]);
  return store;
};

export const useStageEditState = (store: IStageEditStore): IStageEditState =>
  useSyncExternalStore(store.subscribe, store.state);

export default useStageEdit;
