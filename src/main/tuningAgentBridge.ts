/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { ipcRenderer, type IpcRendererEvent } from 'electron';
import {
  TUNING_AGENT_CHANNELS,
  type ITuningAgentDoor,
  type TTuningAbMode,
} from '../common/tuningAgent';

/**
 * Window bridge for the Tuning Agent Door (`main/tuningAgent/tuningAgentDoor.ts`):
 * lets the listener enable/disable the local MCP tuning endpoint, rotate its
 * Bearer key, A/B compare or revert AI tuning edits, and react to live changes.
 */
const tuningAgentBridge = {
  getTuningAgentDoor: (): Promise<ITuningAgentDoor> =>
    ipcRenderer.invoke(TUNING_AGENT_CHANNELS.getDoor),
  setTuningAgentDoor: (open: boolean): Promise<ITuningAgentDoor> =>
    ipcRenderer.invoke(TUNING_AGENT_CHANNELS.setDoor, open),
  newTuningAgentKey: (): Promise<ITuningAgentDoor> =>
    ipcRenderer.invoke(TUNING_AGENT_CHANNELS.newKey),
  revertTuningAgent: (): Promise<{ ok: boolean; error?: string }> =>
    ipcRenderer.invoke(TUNING_AGENT_CHANNELS.revert),
  abTuningAgent: (
    mode?: TTuningAbMode,
  ): Promise<{ ok: boolean; error?: string }> =>
    ipcRenderer.invoke(TUNING_AGENT_CHANNELS.abToggle, mode),
  onTuningAgentChanged: (listener: (door: ITuningAgentDoor) => void) => {
    const wrapped = (_event: IpcRendererEvent, door: ITuningAgentDoor) =>
      listener(door);
    ipcRenderer.on(TUNING_AGENT_CHANNELS.changed, wrapped);
    return () => {
      ipcRenderer.removeListener(TUNING_AGENT_CHANNELS.changed, wrapped);
    };
  },
  onMicSoundChanged: (listener: () => void) => {
    const wrapped = () => listener();
    ipcRenderer.on(TUNING_AGENT_CHANNELS.micSoundChanged, wrapped);
    return () => {
      ipcRenderer.removeListener(
        TUNING_AGENT_CHANNELS.micSoundChanged,
        wrapped,
      );
    };
  },
};

export default tuningAgentBridge;
