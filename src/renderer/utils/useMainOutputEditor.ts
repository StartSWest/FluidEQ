/* FluidEQ — GPL-3.0-or-later */
import { useCallback, useRef } from 'react';
import { ErrorCode, getErrorDescription } from '../../common/errors';
import { activateAudioDeviceProfile } from './equalizerApi';
import { useFluidEqShell } from './FluidEqContext';
import { readOutputEditor } from './outputEditor';

/** A main-output control first returns the editor to the output it names. */
export default function useMainOutputEditor() {
  const { refreshState } = useFluidEqShell();
  const pending = useRef<
    { deviceId: string; promise: Promise<void> } | undefined
  >(undefined);
  return useCallback(
    (expectedDeviceId?: string): Promise<void> => {
      const { main, editor } = readOutputEditor();
      // No output known to be playing — the first state read, or Windows
      // naming no default — leaves no other editor to come back from, so an
      // action that names none goes ahead. It was refused: the output picker
      // raised an error as it opened and dropped the output picked from it.
      if (!main) {
        return expectedDeviceId === undefined
          ? Promise.resolve()
          : Promise.reject(getErrorDescription(ErrorCode.INVALID_PARAMETER));
      }
      if (expectedDeviceId && main.id !== expectedDeviceId) {
        return Promise.reject(getErrorDescription(ErrorCode.INVALID_PARAMETER));
      }
      if (pending.current?.deviceId === main.id) {
        return pending.current.promise;
      }
      if (editor?.device.id === main.id) {
        return Promise.resolve();
      }
      const change = (async () => {
        await activateAudioDeviceProfile(main.id);
        await refreshState();
        const next = readOutputEditor();
        if (next.main?.id !== main.id || next.editor?.device.id !== main.id) {
          throw getErrorDescription(ErrorCode.INVALID_PARAMETER);
        }
      })();
      const promise = change.finally(() => {
        if (pending.current?.promise === promise) {
          pending.current = undefined;
        }
      });
      pending.current = { deviceId: main.id, promise };
      return promise;
    },
    [refreshState],
  );
}
