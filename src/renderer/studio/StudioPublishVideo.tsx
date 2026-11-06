import { useEffect, useId, useRef, type RefObject } from 'react';
import { useTranslation } from '../utils/I18nContext';
import { PREVIEW_DURATION_MS } from './previewVideo';
import type { TPublishVideoState } from './usePublishVideo';

interface IProps {
  state: TPublishVideoState;
  locked: boolean;
  onCancel: () => void;
  onRetry: () => void;
  initialFocusRef?: RefObject<HTMLButtonElement | null>;
}

export default function StudioPublishVideo({
  state,
  locked,
  onCancel,
  onRetry,
  initialFocusRef,
}: IProps) {
  const { t } = useTranslation();
  const titleId = useId();
  const videoRef = useRef<HTMLVideoElement>(null);
  const videoUrl = state.phase === 'ready' ? state.url : undefined;
  useEffect(() => {
    const video = videoRef.current;
    return () => {
      video?.pause();
      video?.removeAttribute('src');
      video?.load();
    };
  }, [videoUrl]);
  const busy = ['preparing', 'recording', 'encoding', 'checking'].includes(
    state.phase,
  );
  const elapsed = state.phase === 'recording' ? state.elapsedMs : 0;
  const message =
    state.phase === 'recording'
      ? t('studio.publish.videoRecording', {
          seconds: String(Math.min(10, Math.floor(elapsed / 1000))),
        })
      : t(
          (
            {
              preparing: 'studio.publish.videoPreparing',
              encoding: 'studio.publish.videoEncoding',
              checking: 'studio.publish.videoChecking',
              ready: 'studio.publish.videoReady',
              failed: 'studio.publish.videoFailed',
              cancelled: 'studio.publish.videoCancelled',
            } as const
          )[state.phase],
        );

  return (
    <section className="studio-publish__video" aria-labelledby={titleId}>
      <span id={titleId} className="gallery-dialog__label">
        {t('studio.publish.videoTitle')}
      </span>
      <p className="studio-publish__video-hint">
        {t('studio.publish.videoHint')}
      </p>
      <p
        role={state.phase === 'failed' ? 'alert' : 'status'}
        aria-live="polite"
        aria-atomic="true"
      >
        {message}
      </p>
      {busy && (
        <progress
          aria-label={message}
          max={PREVIEW_DURATION_MS}
          value={state.phase === 'recording' ? elapsed : undefined}
        />
      )}
      <div className="studio-publish__video-actions">
        {busy ? (
          <button
            ref={initialFocusRef}
            type="button"
            className="button small subtle"
            disabled={locked}
            onClick={onCancel}
          >
            {t('studio.publish.videoCancel')}
          </button>
        ) : (
          <button
            ref={initialFocusRef}
            type="button"
            className="button small subtle"
            disabled={locked}
            onClick={onRetry}
          >
            {t(
              state.phase === 'ready'
                ? 'studio.publish.videoAgain'
                : 'studio.publish.videoRetry',
            )}
          </button>
        )}
      </div>
      {state.phase === 'ready' && (
        <video
          ref={videoRef}
          className="studio-publish__video-player"
          src={state.url}
          controls
          muted
          playsInline
          preload="auto"
          aria-label={t('studio.publish.videoPlay')}
        />
      )}
    </section>
  );
}
