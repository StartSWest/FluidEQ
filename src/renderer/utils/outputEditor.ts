/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/
import { useSyncExternalStore } from 'react';
import type {
  IEqualizerSnapshot,
  IOutputEditor,
} from '../../common/outputSettings';
import type { IAudioDevice } from '../../common/constants';

interface IEditorSnapshot {
  editor?: IOutputEditor;
  main?: IAudioDevice;
}

let snapshot: IEditorSnapshot = {};
const listeners = new Set<() => void>();
export const readOutputEditor = (): IEditorSnapshot => snapshot;
export const updateOutputEditor = (state: IEqualizerSnapshot): void => {
  const next = { editor: state.outputEditor, main: state.playbackOutput };
  if (JSON.stringify(snapshot) === JSON.stringify(next)) {
    return;
  }
  snapshot = next;
  listeners.forEach((listener) => listener());
  window.dispatchEvent(new CustomEvent('fluideq-editor-changed'));
};
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
export const useOutputEditor = (): IEditorSnapshot =>
  useSyncExternalStore(subscribe, readOutputEditor, readOutputEditor);
