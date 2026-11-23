import { useId } from 'react';
import type { TranslationKey } from 'common/i18n';
import { useTranslation } from '../utils/I18nContext';
import { PREVIEW_DURATION_MS } from './previewVideo';
import { isTakeBusy } from './StudioPublishShapes';
import type { TPublishVideoState } from './usePublishVideo';

interface IProps {
  state: TPublishVideoState;
  /**
   * Another view is on the stage. The clip is the Normal view's, so a take
   * waits there: said as such, or a take held in Amp read as one held for
   * a quiet moment.
   */
  away: boolean;
  locked: boolean;
  onCancel: () => void;
}

/** What each phase says, the counting ones aside. */
const PHASE_KEYS: Record<
  Exclude<TPublishVideoState['phase'], 'idle' | 'recording' | 'paused'>,
  TranslationKey
> = {
  waiting: 'studio.publish.videoStarting',
  preparing: 'studio.publish.videoPreparing',
  encoding: 'studio.publish.videoEncoding',
  checking: 'studio.publish.videoChecking',
  ready: 'studio.publish.videoDone',
  failed: 'studio.publish.videoNotRecorded',
  cancelled: 'studio.publish.videoStopped',
};

/**
 * What a take says now: undefined while none has been asked for. Shared by
 * the side column and the tag over the stage, so the two never disagree.
 */
const takeMessage = (
  t: ReturnType<typeof useTranslation>['t'],
  state: TPublishVideoState,
  away: boolean,
): string | undefined => {
  if (state.phase === 'idle') {
    return undefined;
  }
  const elapsed =
    state.phase === 'recording' || state.phase === 'paused'
      ? state.elapsedMs
      : 0;
  const seconds = String(Math.min(10, Math.floor(elapsed / 1000)));
  const held = ['preparing', 'recording', 'paused'].includes(state.phase);
  if (away && state.phase === 'waiting') {
    return t('studio.publish.videoWaitingView');
  }
  if (away && held) {
    return t('studio.publish.videoHeldView', { seconds });
  }
  if (state.phase === 'recording' || state.phase === 'paused') {
    return t(
      state.phase === 'recording'
        ? 'studio.publish.videoRecording'
        : 'studio.publish.videoPaused',
      { seconds },
    );
  }
  return t(PHASE_KEYS[state.phase]);
};

/**
 * The take said over the scene itself while it runs, where the member is
 * looking when Send starts it: a recording light and the count. The side
 * column says the same as the status a screen reader follows, so this one
 * is not read out twice.
 */
export function StudioPublishRecordingTag({
  state,
}: {
  state: TPublishVideoState;
}) {
  const { t } = useTranslation();
  if (!isTakeBusy(state.phase)) {
    return null;
  }
  const live = state.phase === 'recording';
  return (
    <span className="studio-publish__rec" aria-hidden="true">
      <span className={`studio-publish__rec-light${live ? ' is-live' : ''}`} />
      {takeMessage(t, state, false)}
    </span>
  );
}

/**
 * The preview video's part of the side column, with the covers: what is
 * published, beside what it is caught from. Nothing to do here before the
 * scene is sent (Ivan, 2026-11-23): the clip is shot then, on the demo
 * song, at the hour above, so the part says so and waits. Once a take is
 * under way it counts the seconds, and Cancel stops the take and with it
 * the send. The clip itself plays in the stage's frame, on its own tab
 * (`StudioPublishCamera`).
 */
export default function StudioPublishVideo({
  state,
  away,
  locked,
  onCancel,
}: IProps) {
  const { t } = useTranslation();
  const titleId = useId();
  const busy = isTakeBusy(state.phase);
  const elapsed =
    state.phase === 'recording' || state.phase === 'paused'
      ? state.elapsedMs
      : 0;
  const held = ['preparing', 'recording', 'paused'].includes(state.phase);
  const message = takeMessage(t, state, away);
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
        {t('studio.publish.videoOnSend')}
      </p>
      {message !== undefined && (
        <p
          className="studio-publish__video-status"
          role={state.phase === 'failed' ? 'alert' : 'status'}
          aria-live="polite"
          aria-atomic="true"
        >
          {message}
        </p>
      )}
      {busy && (
        <>
          <progress
            aria-label={message}
            max={PREVIEW_DURATION_MS}
            value={counting || (away && held) ? elapsed : undefined}
          />
          <div className="studio-publish__video-actions">
            <button
              type="button"
              className="button small subtle"
              disabled={locked}
              title={locked ? t('studio.publish.clipLocked') : undefined}
              onClick={onCancel}
            >
              {t('studio.publish.videoCancel')}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
