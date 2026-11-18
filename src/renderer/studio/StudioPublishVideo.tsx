import { useId, type RefObject } from 'react';
import type { TranslationKey } from 'common/i18n';
import { useTranslation } from '../utils/I18nContext';
import { PREVIEW_DURATION_MS } from './previewVideo';
import type { TPublishVideoState } from './usePublishVideo';

interface IProps {
  state: TPublishVideoState;
  /**
   * Another view is on the stage. The clip is the Normal view's, so a take
   * waits there: said as such, or a take held in Amp read as one held for
   * a quiet moment, and one not yet begun as one waiting for music.
   */
  away: boolean;
  locked: boolean;
  onCancel: () => void;
  onRetry: () => void;
  initialFocusRef?: RefObject<HTMLButtonElement | null>;
}

const PHASE_KEYS: Record<
  Exclude<TPublishVideoState['phase'], 'recording' | 'paused'>,
  TranslationKey
> = {
  waiting: 'studio.publish.videoWaiting',
  preparing: 'studio.publish.videoPreparing',
  encoding: 'studio.publish.videoEncoding',
  checking: 'studio.publish.videoChecking',
  ready: 'studio.publish.videoReady',
  failed: 'studio.publish.videoFailed',
  cancelled: 'studio.publish.videoCancelled',
};

/**
 * The preview video's status and its one button, in the side column with
 * the covers: what is published, beside what it is caught from. The clip
 * itself plays in the stage's frame, on its own tab (`StudioPublishCamera`):
 * under the buttons it sat below everything else in the dialog (Ivan,
 * 2026-11-07).
 *
 * The bar is there for the whole take, waiting and held included, so the
 * panel keeps one height while sound comes and goes: shown only while
 * frames were being kept, it pushed everything under it down and back up
 * at every quiet moment.
 */
export default function StudioPublishVideo({
  state,
  away,
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
  const held = ['preparing', 'recording', 'paused'].includes(state.phase);
  let message: string;
  if (away && state.phase === 'waiting') {
    message = t('studio.publish.videoWaitingView');
  } else if (away && held) {
    message = t('studio.publish.videoHeldView', { seconds });
  } else if (state.phase === 'recording' || state.phase === 'paused') {
    message = t(
      state.phase === 'recording'
        ? 'studio.publish.videoRecording'
        : 'studio.publish.videoPaused',
      { seconds },
    );
  } else {
    message = t(PHASE_KEYS[state.phase]);
  }
  // A count while there is one to show; the moving bar only while the clip is
  // being finished, when nothing can be counted.
  const counting = ['waiting', 'recording', 'paused'].includes(state.phase);

  return (
    <section
      className="studio-publish__video"
      aria-labelledby={titleId}
      data-publish-part="video"
    >
      <span id={titleId} className="dialog-frame__section-title">
        {t('studio.publish.videoTitle')}
      </span>
      <p className="studio-publish__video-hint">
        {t('studio.publish.videoHint')}
      </p>
      <p
        className="studio-publish__video-status"
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
          value={counting || (away && held) ? elapsed : undefined}
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
