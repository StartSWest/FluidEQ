/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useCallback, useEffect, useState } from 'react';
import ChannelEnum from 'common/channels';
import {
  IVideoDownloadUpdate,
  VIDEO_DOWNLOAD_CHANGED,
  isVideoDownloadUpdate,
} from 'common/videoDownloads';
import { useTranslation } from '../utils/I18nContext';
import '../styles/VideoNotices.scss';

const formatDownloadBytes = (bytes: number) => {
  if (bytes < 1024 * 1024) {
    return `${Math.max(0, bytes / 1024).toFixed(1)} KB`;
  }
  return `${Math.max(0, bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const DismissGlyph = () => (
  <svg viewBox="0 0 12 12" aria-hidden="true">
    <path d="M3 3l6 6M9 3l-6 6" />
  </svg>
);

/**
 * A file a site handed over, as a flat strip across the page's top edge:
 * what is being saved and where, the progress as the accent's line along the
 * strip's foot, and once it is saved the way to its folder.
 *
 * Listening from the moment the page is mounted, behind another tab as well:
 * a download goes on while somebody moves a band, and coming back has to find
 * where it got to. Drawn only while the page is looked at.
 */
export function VideoDownloadStrip({ isHidden }: { isHidden: boolean }) {
  const { t } = useTranslation();
  const [update, setUpdate] = useState<IVideoDownloadUpdate>();
  const [isPathCopied, setIsPathCopied] = useState(false);

  useEffect(() => {
    const off = window.electron.ipcRenderer.on(
      VIDEO_DOWNLOAD_CHANGED,
      (...args: unknown[]) => {
        const [next] = args;
        if (!isVideoDownloadUpdate(next)) {
          return;
        }
        setIsPathCopied(false);
        setUpdate(next.phase === 'cancelled' ? undefined : next);
      },
    );
    // Wrapped rather than returned directly: the unsubscribe hands back the
    // IpcRenderer, and a cleanup that returns anything is not a cleanup.
    return () => {
      off();
    };
  }, []);

  const filePath = update?.filePath;
  const copyPath = useCallback(async () => {
    if (!filePath) {
      return;
    }
    try {
      await navigator.clipboard.writeText(filePath);
      setIsPathCopied(true);
    } catch {
      setIsPathCopied(false);
    }
  }, [filePath]);

  if (isHidden || !update) {
    return null;
  }
  const { phase } = update;
  const isUnderway = phase === 'choosing' || phase === 'downloading';
  return (
    <div
      className={`video-browser__download is-${phase}`}
      role={phase === 'failed' ? 'alert' : 'status'}
      aria-live="polite"
    >
      <div className="video-browser__download-icon" aria-hidden="true">
        <svg viewBox="0 0 20 20">
          <path d="M10 2v10m0 0 4-4m-4 4L6 8M3 15.5h14" />
        </svg>
      </div>
      <div className="video-browser__download-copy">
        <strong>
          {phase === 'choosing' && t('video.downloadChoosing')}
          {phase === 'downloading' &&
            t('video.downloadSaving', { file: update.fileName })}
          {phase === 'completed' && t('video.downloadComplete')}
          {phase === 'failed' && t('video.downloadFailed')}
        </strong>
        <span title={filePath ?? update.fileName}>
          {filePath ?? update.fileName}
        </span>
        {isUnderway && (
          <small>
            {formatDownloadBytes(update.receivedBytes)}
            {update.totalBytes !== undefined &&
              ` / ${formatDownloadBytes(update.totalBytes)}`}
            {update.percent !== undefined &&
              ` · ${Math.round(update.percent)}%`}
          </small>
        )}
      </div>
      {isUnderway && (
        <div
          className="video-browser__download-progress"
          role="progressbar"
          aria-label={t('video.downloadProgress')}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={
            update.percent !== undefined
              ? Math.round(update.percent)
              : undefined
          }
        >
          <span style={{ width: `${update.percent ?? 0}%` }} />
        </div>
      )}
      {phase === 'completed' && filePath && (
        <div className="video-browser__download-actions">
          <button type="button" onClick={copyPath}>
            {isPathCopied
              ? t('video.downloadCopied')
              : t('video.downloadCopyPath')}
          </button>
          <button
            type="button"
            onClick={() => {
              window.electron.ipcRenderer
                .revealVideoDownload(filePath)
                .catch(() => undefined);
            }}
          >
            {t('video.downloadShowFolder')}
          </button>
        </div>
      )}
      {(phase === 'completed' || phase === 'failed') && (
        <button
          type="button"
          aria-label={t('app.dismiss')}
          className="video-browser__download-dismiss"
          onClick={() => setUpdate(undefined)}
        >
          <DismissGlyph />
        </button>
      )}
    </div>
  );
}

/**
 * A link the player refused, as a flat strip along the page's foot: which
 * host, and the real browser offered where it could open it.
 */
export function VideoBlockedStrip({
  url,
  onDismiss,
}: {
  url: string;
  onDismiss: () => void;
}) {
  const { t } = useTranslation();
  const parsed = (() => {
    try {
      return new URL(url);
    } catch {
      return undefined;
    }
  })();
  // A refused address with no host — `about:blank` is the one that happens —
  // would print an empty string, a notice that says nothing at all. The whole
  // address is worth more than a blank in that case.
  const host = parsed?.hostname || url;
  // Whether the real browser could do anything with it if offered.
  // `shell.openExternal` refuses anything that is not `http:` or `https:`, and
  // a button offering it anyway did precisely nothing when pressed, which
  // reads as the app being broken rather than the address being unopenable.
  const canOpenExternally =
    parsed?.protocol === 'https:' || parsed?.protocol === 'http:';
  return (
    <div className="video-browser__blocked" role="alert">
      <div>
        <strong>{t('video.blockedTitle')}</strong>
        <span title={url}>{host}</span>
      </div>
      {canOpenExternally && (
        <button
          type="button"
          onClick={() => {
            window.electron.ipcRenderer.sendMessage(
              ChannelEnum.OPEN_VIDEO_LINK_EXTERNALLY,
              [url],
            );
            onDismiss();
          }}
        >
          {t('video.openInBrowser')}
        </button>
      )}
      <button
        type="button"
        aria-label={t('app.dismiss')}
        className="video-browser__blocked-dismiss"
        onClick={onDismiss}
      >
        <DismissGlyph />
      </button>
    </div>
  );
}
