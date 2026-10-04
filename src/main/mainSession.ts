/*
<AQUA: System-wide parametric audio equalizer interface>
Copyright (C) <2023>  <AQUA Dev Team>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import type { TAudioEngine } from '../common/audioEngine';
import type { IAudioDevice, IState } from '../common/constants';
import type { IDspSettings } from '../common/dsp/chain';
import type { IOutputEditor } from '../common/outputSettings';

/**
 * What the process currently has open, in one place a module can be handed.
 *
 * These four were module-level `let`s, and being `let`s is exactly what kept
 * the IPC handlers that reassign them stuck in main.ts: a reassignment cannot
 * travel across a function boundary. Extracting the device handlers would have
 * meant passing four setters so a module could reach back and rewrite that
 * file's variables — which is harder to follow than leaving them inline, and
 * is why `presets` and `devices` could not be merged even though they are
 * plainly one subject.
 *
 * As fields on an object the reassignment goes with the object, so a module
 * receives `session` and mutates it directly. The mutability is unchanged and
 * deliberately so; what changes is that it now has a name and a place, and a
 * handler's access to it is visible in a signature.
 *
 * Deliberately not `state`. That is the audio chain — the filters, the preamp,
 * the layers — and is persisted. This is which output is selected and where
 * the config lives, none of which outlives the process.
 */
export interface IMainSession {
  /**
   * The chosen engine's config directory, resolved once and cached.
   *
   * Cleared whenever the engine changes. Kept across a switch it would send
   * the next flush into the directory the app has just neutralised.
   */
  configPath: string;
  activeAudioDeviceId: string;
  activeAudioDevice: IAudioDevice | undefined;
  /** Playback follows Windows; opening an editor never changes this endpoint. */
  playbackAudioDevice?: IAudioDevice;
  audioDevices?: IAudioDevice[];
  /** Omitted while the editor follows the main output. */
  editingAudioDeviceId?: string;
  outputEditGeneration?: number;
  /** Audible transient rack, kept separate from the listener's saved profile. */
  outputDspOverrides?: Map<string, IDspSettings>;
  /** Live song loans and unsaved sound stay on their own output when editing another. */
  outputStateOverrides?: Map<string, IState>;
  systemRackEnabled?: (deviceId: string) => boolean;
  /** Routed native receivers, including outputs without saved profiles. */
  secondOutputDevices?: IAudioDevice[];
  /** The user opened a device explicitly, so its profile wins over the default. */
  hasActiveSessionOverride: boolean;
  /**
   * The engine being written to, loaded from `audioEngineStore.ts` at the top
   * of `onAppReady` and changed only by `SET_AUDIO_ENGINE`.
   *
   * `null` means the first-run dialog has not been answered — a state the
   * update path refuses rather than defaults, because defaulting is exactly
   * what the startup migration is responsible for doing once, in one place.
   */
  audioEngine: TAudioEngine | null;
  /**
   * Raised while `SET_AUDIO_ENGINE` is neutralising one engine and pointing
   * the session at the other.
   *
   * For that stretch `configPath` still names the engine being left, and an
   * EQ edit arriving in the middle of it would flush the live chain straight
   * back over the neutral root that was just written there — both engines
   * processing the same audio, which is the exact thing the switch exists to
   * prevent. The update path skips its flush while this is up; the reflush
   * that ends the switch writes the state out once, into the right place.
   */
  engineSwitching: boolean;
}

/** The output being edited and its edit's generation, as the window reads it. */
export const outputEditorOf = (
  session: Pick<IMainSession, 'activeAudioDevice' | 'outputEditGeneration'>,
): IOutputEditor | undefined =>
  session.activeAudioDevice
    ? {
        device: session.activeAudioDevice,
        generation: session.outputEditGeneration ?? 0,
      }
    : undefined;

/** The session a launch starts with: no output, no engine, no folder. */
const createMainSession = (): IMainSession => ({
  configPath: '',
  activeAudioDeviceId: '',
  activeAudioDevice: undefined,
  hasActiveSessionOverride: false,
  audioEngine: null,
  engineSwitching: false,
});

export default createMainSession;
