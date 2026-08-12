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

import { useEffect, useState } from 'react';
import ChannelEnum from 'common/channels';
import '../styles/MemoryTrace.scss';

/**
 * Substituted with a literal at build time, so a packaged build does not carry
 * this component at all — the branch below folds away and the bundler drops
 * the whole file with it.
 */
const IS_DEV = process.env.NODE_ENV !== 'production';

interface ITraceState {
  isRecording: boolean;
  detail?: string;
}

/**
 * Start and stop a Chromium memory-infra recording.
 *
 * This exists because the app's renderer grows by tens of megabytes a minute
 * while its JS heap and its DOM stay flat, and no amount of looking at our own
 * code answers that: the memory belongs to a Chromium subsystem, and
 * memory-infra is the only thing that will say which one.
 *
 * A button rather than a keyboard shortcut, and the reason is worth writing
 * down. `before-input-event` was the first attempt and it never fires while
 * focus is inside the video guest — one of the two places worth measuring. It
 * is also unreliable on Windows, where Ctrl+Alt is AltGr and the key reported
 * for Ctrl+Alt+M is not `m` on every layout. A global shortcut would work and
 * would take the combination away from every other application on the machine.
 *
 * The recording state is pushed from the main process rather than assumed
 * here, because a recording can end without anybody pressing anything: there
 * is a guard that stops it after five minutes, and a button that only learned
 * anything when it was clicked would go on claiming to be recording long after
 * the trace had been written.
 */
const MemoryTraceButton = () => {
  const [state, setState] = useState<ITraceState>({ isRecording: false });

  useEffect(() => {
    if (!IS_DEV) {
      return undefined;
    }
    const unsubscribe = window.electron.ipcRenderer.on(
      ChannelEnum.TOGGLE_MEMORY_TRACE,
      (arg) => {
        const next = (arg as { result?: ITraceState })?.result;
        if (next) {
          setState(next);
        }
      },
    );
    // Wrapped rather than returned directly: the bridge's unsubscribe hands
    // back the IpcRenderer, and an effect cleanup must return nothing.
    return () => {
      unsubscribe();
    };
  }, []);

  if (!IS_DEV) {
    return null;
  }

  return (
    <button
      type="button"
      className={`memory-trace${state.isRecording ? ' is-recording' : ''}`}
      onClick={() =>
        window.electron.ipcRenderer.sendMessage(
          ChannelEnum.TOGGLE_MEMORY_TRACE,
          [],
        )
      }
      title={
        state.isRecording
          ? 'Stop the memory recording and write it to the log directory'
          : 'Record a Chromium memory-infra trace (development only)'
      }
      aria-pressed={state.isRecording}
    >
      {/* A filled dot while recording, a hollow one at rest — the same
          language every recorder uses, and legible at this size where a word
          would not be. */}
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <circle
          cx="8"
          cy="8"
          r="5"
          fill={state.isRecording ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth="1.6"
        />
      </svg>
      <span className="memory-trace__label">
        {state.isRecording ? 'Recording' : 'Trace'}
      </span>
      {/* Only after something has happened, so the control is a control until
          it has news. */}
      {state.detail && !state.isRecording && (
        <span className="memory-trace__detail">{state.detail}</span>
      )}
    </button>
  );
};

export default MemoryTraceButton;
