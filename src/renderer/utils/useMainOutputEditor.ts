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
      if (!main || (expectedDeviceId && main.id !== expectedDeviceId)) {
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
