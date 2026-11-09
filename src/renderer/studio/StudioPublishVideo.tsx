import { useId, type RefObject } from 'react';
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

/**
 * The preview video's status and its one button. The clip itself plays in
 * the stage's frame, on its own tab (`StudioPublishCamera`): under the
 * buttons it sat below everything else in the dialog (Ivan, 2026-11-07).
 *
 * The bar is there for the whole take, waiting and held included, so the
 * panel keeps one height while sound comes and goes: shown only while
 * frames were being kept, it pushed everything under it down and back up
 * at every quiet moment.
 */
export default function StudioPublishVideo({
  state,
  locked,
  onCancel,
  onRetry,
  initialFocusRef,
}: IProps) {
  const { t } = useTranslation();
  const titleId = useId();
  const busy = [
    'waiting',
    'preparing',
    'recording',
    'paused',
    'encoding',
    'checking',
  ].includes(state.phase);
  const elapsed =
    state.phase === 'recording' || state.phase === 'paused'
      ? state.elapsedMs
      : 0;
  const seconds = String(Math.min(10, Math.floor(elapsed / 1000)));
  const message =
    state.phase === 'recording' || state.phase === 'paused'
      ? t(
          state.phase === 'recording'
            ? 'studio.publish.videoRecording'
            : 'studio.publish.videoPaused',
          { seconds },
        )
      : t(
          (
            {
              waiting: 'studio.publish.videoWaiting',
              preparing: 'studio.publish.videoPreparing',
              encoding: 'studio.publish.videoEncoding',
              checking: 'studio.publish.videoChecking',
              ready: 'studio.publish.videoReady',
              failed: 'studio.publish.videoFailed',
              cancelled: 'studio.publish.videoCancelled',
            } as const
          )[state.phase],
        );
  // A count while there is one to show; the moving bar only while the clip is
  // being finished, when nothing can be counted.
  const counting = ['waiting', 'recording', 'paused'].includes(state.phase);

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
          value={counting ? elapsed : undefined}
        />
      )}
      <div className="studio-publish__video-actions">
        {busy ? (
          <button
            ref={initialFocusRef}
            type="button"
            className="button small subtle"
            disabled={locked}
            title={locked ? t('studio.publish.clipLocked') : undefined}
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
            title={locked ? t('studio.publish.clipLocked') : undefined}
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
    </section>
  );
}
