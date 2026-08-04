/*
<AQUA: System-wide parametric audio equalizer interface>
Copyright (C) <2023>  <AQUA Dev Team>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import {
  IPercussionState,
  createPercussionState,
  getNearestPeakMs,
  pushPercussionFrame,
} from 'common/percussion';
import {
  IRhythmHit,
  IRhythmScore,
  applyRhythmScore,
  getHitMarkerPosition,
  getStreakMultiplier,
  gradeRhythmOffset,
} from 'common/rhythmGame';
import {
  useLiveAudioFrame,
  useLiveAudioControl,
} from '../audio/LiveAudioContext';
import { useTranslation } from '../utils/I18nContext';
import '../styles/RhythmGame.scss';

/** Where the high score lives. It is meant to survive everything. */
const HIGH_SCORE_KEY = 'fluideq-rhythm-high-score';

/**
 * How long a hit takes to travel from the right edge into the target line.
 *
 * A live peak cannot be drawn before it is heard — the trace only ever knows
 * the past — so the picture is held back by this much to give the player
 * something to see coming. The cost is that the tap lands a moment after the
 * sound, which is the trade being made deliberately.
 */
const LEAD_MS = 380;
/** How much already-passed audio stays on screen to the left of the line. */
const TRAIL_MS = 900;
const WINDOW_MS = LEAD_MS + TRAIL_MS;

const VIEW_HEIGHT = 44;
const BASELINE = VIEW_HEIGHT - 5;
/** Tallest a spike is allowed to draw. */
const PEAK_HEIGHT = VIEW_HEIGHT - 12;

export interface IRhythmGameHandle {
  /**
   * Called from the tap handler itself rather than an effect, so what gets
   * scored is the moment the key actually went down.
   */
  registerTap: () => void;
}

const readHighScore = () => {
  const stored = Number(window.localStorage.getItem(HIGH_SCORE_KEY));
  return Number.isFinite(stored) && stored > 0 ? Math.floor(stored) : 0;
};

/**
 * Jump the pet over the percussion of whatever is playing.
 *
 * The trace is the real signal, reduced to its transients, scrolling right to
 * left into a line under the creature. Everything is measured against one
 * clock — `performance.now()` — so what is drawn and what is scored cannot
 * drift apart, which in a game about timing is the only thing that matters.
 */
const RhythmGame = forwardRef<IRhythmGameHandle>((_props, ref) => {
  const { t } = useTranslation();
  const { points } = useLiveAudioFrame();
  const { isActive, isPaused } = useLiveAudioControl();

  const stateRef = useRef<IPercussionState>(createPercussionState());
  const [run, setRun] = useState<IRhythmScore>({ score: 0, streak: 0 });
  const [highScore, setHighScore] = useState(readHighScore);
  const [lastHit, setLastHit] = useState<IRhythmHit>();
  const [hitSeq, setHitSeq] = useState(0);
  // Redrawn from the state each frame. Kept in React state rather than mutated
  // in place so the SVG actually updates.
  const [path, setPath] = useState('');
  const [hasPeaks, setHasPeaks] = useState(false);

  const isListening = isActive && !isPaused;

  // One frame of spectrum in, one redraw out.
  useEffect(() => {
    if (!isListening || points.length === 0) {
      return;
    }
    const now = performance.now();
    // The low half of the spectrum. Percussion energy that matters for keeping
    // time — kick, snare, toms — lives down there, and leaving the top out
    // keeps a bright synth pad from reading as a hit.
    const bins = points.slice(0, Math.floor(points.length / 2)).map((p) => p.y);
    const next = pushPercussionFrame(stateRef.current, bins, now, {
      windowMs: WINDOW_MS,
    });
    stateRef.current = next;

    // Time maps to x directly: the newest sample is at the right edge, the
    // target line sits LEAD_MS back from it, and everything older trails off to
    // the left. One mapping for drawing and for scoring.
    const segments = next.history.map((sample) => {
      const age = now - sample.timeMs;
      const x = 100 - (age / WINDOW_MS) * 100;
      const y = BASELINE - sample.level * PEAK_HEIGHT;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    });
    setPath(segments.length > 1 ? `M ${segments.join(' L ')}` : '');
    setHasPeaks(next.history.some((sample) => sample.isPeak));
  }, [isListening, points]);

  // Nothing playing means nothing to jump. Clearing the trace rather than
  // leaving the last frame frozen is the honest thing — a still line that still
  // accepts taps would be a game pretending to run.
  useEffect(() => {
    if (isListening) {
      return;
    }
    stateRef.current = createPercussionState();
    setPath('');
    setHasPeaks(false);
  }, [isListening]);

  const registerTap = useCallback(() => {
    const now = performance.now();
    // The tap is graded against a real detected hit. Its arrival at the line is
    // LEAD_MS after it was heard, which is exactly the delay the drawing uses,
    // so the peak under the line is the peak being scored.
    const peakMs = getNearestPeakMs(stateRef.current, now - LEAD_MS);
    if (peakMs === undefined) {
      // Silence, or nothing detected yet. Tapping into it costs nothing and
      // earns nothing — there was no beat to be early or late for.
      return;
    }

    const hit = gradeRhythmOffset(now - LEAD_MS - peakMs);
    setLastHit(hit);
    setHitSeq((seq) => seq + 1);
    setRun((previous) => {
      const next = applyRhythmScore(previous, hit);
      // Read back from storage rather than from state, so this stays correct
      // without the callback depending on the current high score.
      if (next.score > readHighScore()) {
        window.localStorage.setItem(HIGH_SCORE_KEY, String(next.score));
        setHighScore(next.score);
      }
      return next;
    });
  }, []);

  useImperativeHandle(ref, () => ({ registerTap }), [registerTap]);

  const markerPosition = lastHit
    ? getHitMarkerPosition(lastHit.offsetMs)
    : undefined;
  const targetPercent = (TRAIL_MS / WINDOW_MS) * 100;

  return (
    <div className="rhythm-game">
      <div className="rhythm-game__scores">
        <span className="rhythm-game__score">{run.score}</span>
        {/* A streak nobody can see is a hidden rule, and a player who cannot
            tell what a run is worth has no reason to protect it. */}
        {run.streak > 1 && (
          <span className="rhythm-game__streak">
            ×
            {getStreakMultiplier(run.streak)
              .toFixed(2)
              .replace(/\.?0+$/, '')}
          </span>
        )}
        <span className="rhythm-game__best">
          {t('support.game.best')} {highScore}
        </span>
      </div>

      <div className="rhythm-game__trace">
        <svg
          viewBox={`0 0 100 ${VIEW_HEIGHT}`}
          preserveAspectRatio="none"
          aria-hidden="true"
          focusable="false"
        >
          {path && <path d={path} />}
        </svg>

        {/* Directly under the pet, which is what the creature is jumping. */}
        <span
          className="rhythm-game__target"
          style={{ left: `${targetPercent}%` }}
        />

        {markerPosition !== undefined && lastHit && (
          <span
            key={hitSeq}
            className={`rhythm-game__hit rhythm-game__hit--${lastHit.verdict}`}
            style={{
              left: `${targetPercent + (markerPosition - 0.5) * 30}%`,
            }}
          />
        )}
      </div>

      <p className="rhythm-game__verdict" aria-live="polite">
        <span
          key={hitSeq}
          className={`rhythm-game__verdict-text rhythm-game__verdict-text--${
            lastHit && hasPeaks ? lastHit.verdict : 'idle'
          }`}
        >
          {/* Tell the truth about why nothing is happening. A dead trace with a
              live score reads as broken; "put something on" does not. */}
          {(() => {
            if (!isListening) {
              return t('support.game.noAudio');
            }
            if (!hasPeaks) {
              return t('support.game.listening');
            }
            return lastHit
              ? t(`support.game.${lastHit.verdict}`)
              : t('support.game.hint');
          })()}
        </span>
      </p>
    </div>
  );
});

RhythmGame.displayName = 'RhythmGame';

export default RhythmGame;
