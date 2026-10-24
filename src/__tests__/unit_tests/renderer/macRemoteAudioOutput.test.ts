import resolveSelectedOutputSinkId from 'renderer/remoteAudio/selectedOutput';
import { readKnownAudioDevices } from 'renderer/utils/equalizerApi';

jest.mock('renderer/utils/equalizerApi', () => ({
  readKnownAudioDevices: jest.fn(),
}));

it('passes the Mac output identity to native playback and uses default when it disappears', async () => {
  Object.assign(window, { electron: { platform: 'darwin' } });
  const guid = '{12345678-1234-1234-1234-123456789abc}';
  jest
    .mocked(readKnownAudioDevices)
    .mockResolvedValue([
      { id: 'headphones', guid } as Awaited<
        ReturnType<typeof readKnownAudioDevices>
      >[number],
    ]);
  expect(await resolveSelectedOutputSinkId('headphones')).toBe(guid);
  expect(await resolveSelectedOutputSinkId('disconnected')).toBe('default');
});
