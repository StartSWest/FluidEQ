/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { useState } from 'react';
import type { IHelpVideo } from 'common/helpChapters/model';
import type { THelpImage } from 'common/helpGuide';
import PlayerIcon from '../player/PlayerIcon';
import { useTranslation } from '../utils/I18nContext';
import helpScreenshot from './screenshots';

/** Nothing asked of the site yet; the film on its way; playing; refused. */
type TFilmState = 'idle' | 'loading' | 'playing' | 'failed';

/**
 * A chapter's film, played in the guide from FluidEQ's site.
 *
 * Until the reader presses play it is the chapter's poster and nothing else:
 * no request leaves the machine for a film nobody asked to watch, which is
 * the same promise every other download in the app makes. The press puts a
 * `<video>` in its place that streams from the site; a film that cannot be
 * reached (offline, or the site not serving it) says so, with a retry and
 * the site's own page, rather than a black box with a spinner.
 */
export default function HelpVideo({
  video,
}: {
  video: IHelpVideo<THelpImage>;
}) {
  const { t } = useTranslation();
  const [state, setState] = useState<TFilmState>('idle');
  // A fresh element on every try, so a retry asks the site again instead of
  // replaying the failure the old element remembers.
  const [attempt, setAttempt] = useState(0);
  const title = t(video.title);

  if (state === 'idle') {
    return (
      <button
        type="button"
        className="help-video help-video--poster"
        onClick={() => setState('loading')}
        aria-label={t('help.video.play', { title })}
      >
        <img src={helpScreenshot(video.poster)} alt="" />
        <span className="help-video__play" aria-hidden="true">
          <PlayerIcon name="play" />
        </span>
        <span className="help-video__caption">
          <strong>{title}</strong>
          <span>{t(video.note)}</span>
        </span>
      </button>
    );
  }

  return (
    <div className="help-video">
      {state === 'failed' ? (
        <div className="help-video__failed" role="status">
          <img src={helpScreenshot(video.poster)} alt="" />
          <p>{t('help.video.failed')}</p>
          <div className="help-video__actions">
            <button
              type="button"
              className="button small"
              onClick={() => {
                setAttempt((count) => count + 1);
                setState('loading');
              }}
            >
              {t('help.video.retry')}
            </button>
            <a
              className="button small subtle"
              href={video.page}
              target="_blank"
              rel="noreferrer"
            >
              {t('help.video.open')}
            </a>
          </div>
        </div>
      ) : (
        <>
          {/* Anonymous CORS, because the captions are another origin's and
              only load over it; the site serves both files with
              Access-Control-Allow-Origin, and sends no cookie either way. */}
          <video
            key={attempt}
            src={video.src}
            poster={helpScreenshot(video.poster)}
            crossOrigin="anonymous"
            controls
            autoPlay
            playsInline
            preload="auto"
            aria-label={title}
            onPlaying={() => setState('playing')}
            onError={() => setState('failed')}
          >
            <track
              kind="captions"
              src={video.captions.src}
              srcLang={video.captions.lang}
              label={title}
              default
            />
          </video>
          {state === 'loading' && (
            <span className="help-video__loading" role="status">
              {t('help.video.loading')}
            </span>
          )}
        </>
      )}
    </div>
  );
}
