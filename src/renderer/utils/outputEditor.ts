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

const withoutBattery = ({
  batteryPercent,
  ...device
}: IAudioDevice): Omit<IAudioDevice, 'batteryPercent'> => device;

/**
 * Everything about the edited and the main output but a battery level, which
 * is what says either of them changed. The level is read again every few
 * seconds and rides on the device record: compared whole, a headset's battery
 * going down a percent told everything listening — the rack store, the song
 * memory — that a new output was being edited.
 */
const identityOf = ({ editor, main }: IEditorSnapshot): string =>
  JSON.stringify({
    editor: editor && { ...editor, device: withoutBattery(editor.device) },
    main: main && withoutBattery(main),
  });

let snapshot: IEditorSnapshot = {};
const listeners = new Set<() => void>();
export const readOutputEditor = (): IEditorSnapshot => snapshot;
export const updateOutputEditor = (state: IEqualizerSnapshot): void => {
  const next = { editor: state.outputEditor, main: state.playbackOutput };
  if (identityOf(snapshot) === identityOf(next)) {
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
