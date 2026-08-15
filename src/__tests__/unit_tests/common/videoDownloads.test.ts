import { isVideoDownloadUpdate } from '../../../common/videoDownloads';

describe('video download updates', () => {
  it('accepts a complete progress update', () => {
    expect(
      isVideoDownloadUpdate({
        id: 'download-1',
        phase: 'downloading',
        fileName: 'song.mp3',
        filePath: 'C:\\Users\\listener\\Downloads\\song.mp3',
        receivedBytes: 512,
        totalBytes: 1024,
        percent: 50,
      }),
    ).toBe(true);
  });

  it('rejects malformed or unknown download messages', () => {
    expect(isVideoDownloadUpdate(undefined)).toBe(false);
    expect(
      isVideoDownloadUpdate({
        id: 'download-1',
        phase: 'opened',
        fileName: 'song.mp3',
        receivedBytes: 1024,
      }),
    ).toBe(false);
    expect(
      isVideoDownloadUpdate({
        id: 'download-1',
        phase: 'completed',
        fileName: 'song.mp3',
        receivedBytes: '1024',
      }),
    ).toBe(false);
  });
});
