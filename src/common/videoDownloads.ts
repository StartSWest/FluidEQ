/* FluidEQ built-in player download contracts. GPL-3.0-or-later. */

export const VIDEO_DOWNLOAD_CHANGED = 'video-download-changed';
export const VIDEO_DOWNLOAD_REVEAL = 'video-download-reveal';

export type TVideoDownloadPhase =
  'choosing' | 'downloading' | 'completed' | 'cancelled' | 'failed';

export interface IVideoDownloadUpdate {
  id: string;
  phase: TVideoDownloadPhase;
  fileName: string;
  filePath?: string;
  receivedBytes: number;
  totalBytes?: number;
  percent?: number;
}

export const isVideoDownloadUpdate = (
  value: unknown,
): value is IVideoDownloadUpdate => {
  const candidate = value as Partial<IVideoDownloadUpdate> | undefined;
  return (
    typeof candidate?.id === 'string' &&
    typeof candidate.fileName === 'string' &&
    ['choosing', 'downloading', 'completed', 'cancelled', 'failed'].includes(
      candidate.phase ?? '',
    ) &&
    typeof candidate.receivedBytes === 'number'
  );
};
