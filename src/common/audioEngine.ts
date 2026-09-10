/*
<FluidEQ: System-wide parametric audio equalizer interface>
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

/**
 * Which config directory FluidEQ writes to: Equalizer APO's, resolved from the
 * registry, or the FluidEQ Engine's own directory under `%ProgramData%`. Both
 * write the same `config.txt` -> `fluideq.txt` -> per-device layout, so
 * everything downstream of `getConfigPath` stays identical either way.
 */
export type TAudioEngine = 'fluid' | 'apo';

export const AUDIO_ENGINES: readonly TAudioEngine[] = ['fluid', 'apo'];

/** `%APPDATA%\FluidEQ\audio-engine.json` — see `audioEngineStore.ts`. */
export const AUDIO_ENGINE_FILENAME = 'audio-engine.json';

/** The FluidEQ Engine's APO (Audio Processing Object) COM class id. */
export const FLUID_ENGINE_CLSID = '{B7E2C4D1-5A8F-4C3E-9D2B-6F1A0C8E7D34}';

/** The system-wide DSP rack's settings file, written beside the engine's config. */
export const FLUID_ENGINE_DSP_FILENAME = 'fluideq-dsp.txt';

/**
 * `engine: null` means "never chosen" — first launch before the dialog or the
 * installer has answered, or before Equalizer APO was found already
 * installed. It is a distinct state from either engine name: code that means
 * "no preference yet" must not collapse it into a default silently, because
 * that default is exactly what the first-run migration is responsible for
 * choosing.
 */
export interface IAudioEnginePreference {
  version: 1;
  engine: TAudioEngine | null;
}

export interface IFluidEngineEndpoint {
  guid: string;
  attached: boolean;
  backupExists: boolean;
  /**
   * Set only by `--attach-all`, on the endpoints it could not attach — an
   * explicit `attach <guid>` reports its one failure as the command's own
   * `error` instead. Kept per endpoint so a partial install still names which
   * outputs need a retry rather than folding into one opaque failure.
   */
  error?: string;
}

export interface IFluidEngineStatus {
  installed: boolean;
  dllPath?: string;
  dllVersion?: string;
  configDir?: string;
  endpoints: IFluidEngineEndpoint[];
}

export interface IAudioEngineStatus {
  engine: TAudioEngine | null;
  apo: { installed: boolean };
  fluid: IFluidEngineStatus;
  fluidSupported: boolean;
}

/**
 * What became of a system-wide DSP rack snapshot.
 *
 * Four answers rather than a boolean because three of them are "not written"
 * for entirely different reasons, and the page that shows the rack has to say
 * which: `'not-fluid'` is a supported configuration to explain (the rack runs
 * in the Library player instead), `'not-installed'` is an engine that is
 * chosen but missing, and `'rejected'` is a payload that never should have
 * been sent at all — a bug in the window, not a state a user can be in.
 */
export type TSystemDspChainResult =
  'written' | 'not-fluid' | 'not-installed' | 'rejected';

/** Guards a value read off disk before it is trusted as an engine name. */
export const isAudioEngine = (value: unknown): value is TAudioEngine =>
  typeof value === 'string' &&
  (AUDIO_ENGINES as readonly string[]).includes(value);
