import { createNativePcmMixer } from 'renderer/remoteAudio/nativePcmMixer';
import type { TRemotePlaybackEvent } from 'common/remoteAudioPlayback';

it('reopens a failed receiver and closes a late resume after Stop', async () => {
  let emit: (event: TRemotePlaybackEvent) => void = () => undefined;
  const start = jest.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(2);
  const command = jest.fn().mockResolvedValue(undefined);
  const unsubscribe = jest.fn();
  window.electron = {
    ipcRenderer: {
      startRemoteAudioPlayback: start,
      remoteAudioPlaybackCommand: command,
      onRemoteAudioPlayback: (listener: typeof emit) => {
        emit = listener;
        return unsubscribe;
      },
    },
  } as unknown as typeof window.electron;
  const blocked = jest.fn();
  const mixer = await createNativePcmMixer('default', blocked, jest.fn(), 0.5);
  emit({ session: 1, kind: 'failed' });
  expect(blocked).toHaveBeenLastCalledWith(true);
  await mixer.resume();
  expect(start).toHaveBeenLastCalledWith('default', 0.5);
  expect(blocked).toHaveBeenLastCalledWith(false);
  blocked.mockClear();
  emit({ session: 1, kind: 'failed' });
  expect(blocked).not.toHaveBeenCalled();
  let finish: (id: number) => void = () => undefined;
  start.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const resuming = mixer.resume();
  await mixer.close();
  finish(3);
  await resuming;
  expect(command).toHaveBeenCalledWith(2, 'close', undefined);
  expect(command).toHaveBeenLastCalledWith(3, 'close');
  expect(unsubscribe).toHaveBeenCalledTimes(1);
});
