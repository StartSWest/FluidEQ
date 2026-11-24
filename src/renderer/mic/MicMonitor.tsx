/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * "Hear the final result": the tab's own recording of the mic, which comes
 * out of the engine after every stage - what Discord or OBS receives - played
 * to the output Windows plays through, at the end of the live strip. The loud
 * style while it plays, the quiet one off. The line saying to use headphones
 * is there either way, quiet off and in the caution colour while it plays: a
 * speaker would feed back, and a line that appeared on the press pushed the
 * strip about (2026-11-24, nothing may move). The button holds the longer of
 * its two labels for the same reason.
 */

import { useEffect, useState } from 'react';
import { useTranslation } from '../utils/I18nContext';
import { reportError } from '../utils/logger';

interface IMicMonitorProps {
  /** The tab's own recording of the mic: what every app receives. */
  stream: MediaStream | undefined;
}

const HeadphonesGlyph = () => (
  <svg
    className="mic-monitor__glyph"
    viewBox="0 0 20 20"
    width="15"
    height="15"
    aria-hidden="true"
  >
    <path d="M3.5 12V10a6.5 6.5 0 0 1 13 0v2 M3.5 12h2.5v4.5H4.5a1 1 0 0 1-1-1z M16.5 12H14v4.5h1.5a1 1 0 0 0 1-1z" />
  </svg>
);

const MicMonitor = ({ stream }: IMicMonitorProps) => {
  const { t } = useTranslation();
  const [listening, setListening] = useState(false);

  // At the lowest latency the context offers, and closed the moment it is
  // switched off or the stream goes, so it never outlives the page.
  useEffect(() => {
    if (!listening || !stream) {
      return undefined;
    }
    const context = new AudioContext({ latencyHint: 'interactive' });
    context.createMediaStreamSource(stream).connect(context.destination);
    return () => {
      context
        .close()
        .catch((error: unknown) =>
          reportError('closing the mic monitor', error),
        );
    };
  }, [listening, stream]);

  return (
    <div className={`mic-monitor${listening ? ' is-on' : ''}`}>
      <span className="mic-monitor__warning" role="status">
        {t('mic.monitor.warning')}
      </span>
      <button
        type="button"
        className={listening ? 'button small' : 'button small subtle'}
        aria-pressed={listening}
        disabled={!stream}
        title={t('mic.monitor.hint')}
        onClick={() => setListening((was) => !was)}
      >
        <HeadphonesGlyph />
        <span className="mic-monitor__labels">
          <span className={listening ? 'is-hidden' : undefined}>
            {t('mic.monitor.label')}
          </span>
          <span className={listening ? undefined : 'is-hidden'}>
            {t('mic.monitor.on')}
          </span>
        </span>
      </button>
    </div>
  );
};

export default MicMonitor;
