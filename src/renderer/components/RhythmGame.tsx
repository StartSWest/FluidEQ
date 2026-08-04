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
  getStreakJoy,
  getStreakMultiplier,
  RhythmVerdict,
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
const LEAD_MS = 420;
/**
 * The window is exactly twice the lead, which is what puts the target line dead
 * centre and keeps it there. Derived rather than chosen: with a separate trail
 * length the line drifts off centre the moment either constant is touched.
 */
const WINDOW_MS = LEAD_MS * 2;
/** Always the middle, by construction. */
const TARGET_PERCENT = 50;

/** How long a verdict stays up after the tap that earned it. */
const VERDICT_HOLD_MS = 900;

const VIEW_HEIGHT = 44;
/** Mirrored about the middle, the way the titlebar meter draws. */
const CENTRE = VIEW_HEIGHT / 2;
/** Half-height of a full-scale hit, leaving a margin at both edges. */
const AMPLITUDE = CENTRE - 4;

export interface IRhythmTapResult {
  verdict: RhythmVerdict;
  /** 0 to 1 across the whole multiplier range, for the creature's face. */
  joy: number;
}

export interface IRhythmGameHandle {
  /**
   * Called from the tap handler itself rather than an effect, so what gets
   * scored is the moment the key actually went down.
   *
   * Reports the verdict back, because the creature that reacts to it lives up
   * in the dialog header rather than in here. Undefined when there was nothing
   * to hit.
   */
  registerTap: () => IRhythmTapResult | undefined;
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
  // The streak as the tap handler sees it. React state is a render behind, and
  // the face has to be right on the tap that earned it.
  const runRef = useRef<IRhythmScore>({ score: 0, streak: 0 });
  const [highScore, setHighScore] = useState(readHighScore);
  const [lastHit, setLastHit] = useState<IRhythmHit>();
  const [hitSeq, setHitSeq] = useState(0);
  // Redrawn from the state each frame. Kept in React state rather than mutated
  // in place so the SVG actually updates.
  const [path, setPath] = useState('');
  const [hasPeaks, setHasPeaks] = useState(false);
  // Where each detected hit currently sits, as a percentage across the trace.
  const [peakMarks, setPeakMarks] = useState<number[]>([]);
  const verdictResetRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

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
    //
    // Drawn mirrored about the middle and closed into a shape, so it reads as a
    // waveform rather than as a graph of a number. Out along the top, back
    // along the bottom.
    const upper: string[] = [];
    const lower: string[] = [];
    const marks: number[] = [];
    next.history.forEach((sample) => {
      const age = now - sample.timeMs;
      const x = 100 - (age / WINDOW_MS) * 100;
      const offset = sample.level * AMPLITUDE;
      upper.push(`${x.toFixed(2)},${(CENTRE - offset).toFixed(2)}`);
      lower.push(`${x.toFixed(2)},${(CENTRE + offset).toFixed(2)}`);
      // Every detected hit gets its own mark, travelling with the wave. Tapping
      // as one crosses the centre line is the whole game, and without them the
      // player is guessing which bump was the one that counted.
      if (sample.isPeak) {
        marks.push(x);
      }
    });
    setPath(
      upper.length > 1
        ? `M ${upper.join(' L ')} L ${lower.reverse().join(' L ')} Z`
        : '',
    );
    setPeakMarks(marks);
    setHasPeaks(marks.length > 0);
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
    setPeakMarks([]);
    setHasPeaks(false);
  }, [isListening]);

  const registerTap = useCallback((): IRhythmTapResult | undefined => {
    const now = performance.now();
    // The tap is graded against a real detected hit. Its arrival at the line is
    // LEAD_MS after it was heard, which is exactly the delay the drawing uses,
    // so the peak under the line is the peak being scored.
    const peakMs = getNearestPeakMs(stateRef.current, now - LEAD_MS);
    if (peakMs === undefined) {
      // Silence, or nothing detected yet. Tapping into it costs nothing and
      // earns nothing — there was no beat to be early or late for.
      return undefined;
    }

    const hit = gradeRhythmOffset(now - LEAD_MS - peakMs);
    setLastHit(hit);
    setHitSeq((seq) => seq + 1);
    // The verdict is feedback on a tap, so it goes away when the tap is over.
    // Left up it becomes a label, and the panel sits there claiming "GOOD"
    // about something the player did ten seconds ago.
    if (verdictResetRef.current !== undefined) {
      clearTimeout(verdictResetRef.current);
    }
    verdictResetRef.current = setTimeout(() => {
      verdictResetRef.current = undefined;
      setLastHit(undefined);
    }, VERDICT_HOLD_MS);
    setRun((previous) => {
      const next = applyRhythmScore(previous, hit);
      // Read back from storage rather than from state, so this stays correct
      // without the callback depending on the current high score.
      if (next.score > readHighScore()) {
        window.localStorage.setItem(HIGH_SCORE_KEY, String(next.score));
        setHighScore(next.score);
      }
      runRef.current = next;
      return next;
    });
    // Read from the hit rather than from , which is a render behind.
    const streak =
      // Matches applyRhythmScore: only a perfect advances it, a miss clears it,
      // anything else holds.
      // eslint-disable-next-line no-nested-ternary
      hit.verdict === 'miss'
        ? 0
        : hit.verdict === 'perfect'
          ? runRef.current.streak + 1
          : runRef.current.streak;
    runRef.current = { score: runRef.current.score, streak };
    return { verdict: hit.verdict, joy: getStreakJoy(streak) };
  }, []);

  useImperativeHandle(ref, () => ({ registerTap }), [registerTap]);

  useEffect(
    () => () => {
      if (verdictResetRef.current !== undefined) {
        clearTimeout(verdictResetRef.current);
      }
    },
    [],
  );

  const markerPosition = lastHit
    ? getHitMarkerPosition(lastHit.offsetMs)
    : undefined;

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
          <defs>
            {/* The same spectrum the titlebar meter runs, so the two waveforms
                in this app are recognisably the same thing. Cyan through to
                violet, left to right. */}
            <linearGradient id="rhythm-line" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0" stopColor="#00e5ff" />
              <stop offset="0.28" stopColor="#54ff8a" />
              <stop offset="0.52" stopColor="#ffe66d" />
              <stop offset="0.76" stopColor="#ff3cac" />
              <stop offset="1" stopColor="#8b5cff" />
            </linearGradient>
            <linearGradient id="rhythm-fill" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0" stopColor="#00e5ff" stopOpacity="0.3" />
              <stop offset="0.28" stopColor="#54ff8a" stopOpacity="0.4" />
              <stop offset="0.52" stopColor="#ffe66d" stopOpacity="0.45" />
              <stop offset="0.76" stopColor="#ff3cac" stopOpacity="0.4" />
              <stop offset="1" stopColor="#8b5cff" stopOpacity="0.3" />
            </linearGradient>
          </defs>
          {path && <path d={path} />}
          {/* Inside the SVG, so the marks share the wave's coordinate space and
              cannot drift from the hits they belong to at any dialog width. */}
          {peakMarks.map((x) => (
            <line
              key={x}
              className="rhythm-game__peak"
              x1={x}
              x2={x}
              y1={0}
              y2={VIEW_HEIGHT}
              // Distance from the centre, so a mark brightens as it arrives.
              // The one you are about to hit should be the loudest thing on
              // screen.
              opacity={Math.max(
                0.18,
                1 - Math.abs(x - TARGET_PERCENT) / TARGET_PERCENT,
              )}
            />
          ))}
        </svg>

        {/* Directly under the pet, which is what the creature is jumping.
            Keyed on the tap so two perfects in a row both flash — re-applying
            the same class to an element that already has it does nothing. */}
        <span
          key={lastHit?.verdict === 'perfect' ? hitSeq : 'target'}
          className={`rhythm-game__target${
            lastHit?.verdict === 'perfect' ? ' is-perfect' : ''
          }`}
          style={{ left: `${TARGET_PERCENT}%` }}
        />

        {markerPosition !== undefined && lastHit && (
          <span
            key={hitSeq}
            className={`rhythm-game__hit rhythm-game__hit--${lastHit.verdict}`}
            style={{
              left: `${TARGET_PERCENT + (markerPosition - 0.5) * 30}%`,
            }}
          />
        )}
      </div>

      <p className="rhythm-game__verdict" aria-live="polite">
        {/* Both children are keyed on the tap so each one restarts its flash,
            and the keys have to be DISTINCT from each other. Two siblings
            sharing a key is undefined behaviour in React: rather than replacing
            the previous verdict it left it mounted and appended the next, so a
            run of taps built a row of every verdict earned so far. */}
        <span
          key={`verdict-${hitSeq}`}
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
        {/* Beside the verdict, where the eye already is on a hit — the score row
            is the wrong place to learn what a tap was worth. Only shown once
            there is something to show, and keyed on the tap so consecutive
            perfects each flare rather than only the first. */}
        {lastHit && hasPeaks && run.streak > 0 && (
          <span
            key={`multiplier-${hitSeq}`}
            className="rhythm-game__verdict-multiplier"
          >
            ×
            {getStreakMultiplier(run.streak)
              .toFixed(2)
              .replace(/\.?0+$/, '')}
          </span>
        )}
      </p>
    </div>
  );
});

RhythmGame.displayName = 'RhythmGame';

export default RhythmGame;
