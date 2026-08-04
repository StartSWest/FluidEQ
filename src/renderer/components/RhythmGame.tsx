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
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  BEAT_MS,
  IRhythmHit,
  IRhythmScore,
  applyRhythmScore,
  getHitMarkerPosition,
  getStreakMultiplier,
  gradeRhythmTap,
} from 'common/rhythmGame';
import { useTranslation } from '../utils/I18nContext';
import '../styles/RhythmGame.scss';

/** Where the high score lives. It is meant to survive everything. */
const HIGH_SCORE_KEY = 'fluideq-rhythm-high-score';

/** One heartbeat, in the trace's own units. */
const CYCLE_WIDTH = 120;
/** How much of the trace is on screen: two beats, so the next one is visible
 * coming. A single beat gives no warning and the game becomes reflex. */
const VIEW_WIDTH = CYCLE_WIDTH * 2;
const VIEW_HEIGHT = 44;
/** Resting line, low enough that the spike has somewhere to go. */
const BASELINE = 30;
/** Cycles drawn. Two fill the window, and the rest cover the scroll. */
const CYCLE_COUNT = 5;

/**
 * One ECG cycle, starting ON the spike.
 *
 * Starting at the peak rather than at the baseline is what lets the tap
 * scoring be read straight off the animation: at animation time zero a spike
 * sits exactly on the target line, so a phase of zero means dead on the beat
 * and `gradeRhythmTap` needs no offset applied to it.
 */
const buildCyclePath = (originX: number) => {
  const x = (offset: number) => originX + offset;
  return [
    // The spike itself, arriving from the S dip of the previous cycle.
    `L ${x(0)} 4`,
    `L ${x(5)} ${BASELINE + 7}`,
    // Back to rest, then the T wave — the small rounded bump after a beat.
    `L ${x(12)} ${BASELINE}`,
    `L ${x(26)} ${BASELINE}`,
    `Q ${x(34)} ${BASELINE - 9} ${x(42)} ${BASELINE}`,
    // The long quiet stretch before the next beat, with the small P bump near
    // its end so the spike is announced rather than arriving from nothing.
    `L ${x(92)} ${BASELINE}`,
    `Q ${x(99)} ${BASELINE - 5} ${x(106)} ${BASELINE}`,
    `L ${x(113)} ${BASELINE}`,
    // The Q dip, the little drop that makes the spike read as a spike.
    `L ${x(117)} ${BASELINE + 4}`,
  ].join(' ');
};

export interface IRhythmGameHandle {
  /**
   * Called from the tap handler itself rather than from an effect, so the time
   * that is scored is the time the key actually went down.
   */
  registerTap: () => void;
}

const readHighScore = () => {
  const stored = Number(window.localStorage.getItem(HIGH_SCORE_KEY));
  return Number.isFinite(stored) && stored > 0 ? Math.floor(stored) : 0;
};

/**
 * Tap the pet in time with its own heartbeat.
 *
 * The trace scrolls at a fixed tempo and the score is read from the animation's
 * own clock rather than from a timer running alongside it. Anything else drifts
 * apart from what the player can see, and in a game about timing the picture
 * has to be the truth.
 */
const RhythmGame = forwardRef<IRhythmGameHandle>((_props, ref) => {
  const { t } = useTranslation();
  const traceRef = useRef<SVGGElement>(null);
  // Score and streak move together — a miss zeroes both — so they are one
  // piece of state rather than two that have to be kept in step.
  const [run, setRun] = useState<IRhythmScore>({ score: 0, streak: 0 });
  const [highScore, setHighScore] = useState(readHighScore);
  const [lastHit, setLastHit] = useState<IRhythmHit>();
  // Bumped per tap so the verdict flash can restart even on two identical
  // verdicts in a row.
  const [hitSeq, setHitSeq] = useState(0);

  const path = useMemo(() => {
    const cycles = Array.from({ length: CYCLE_COUNT }, (_value, index) =>
      buildCyclePath(index * CYCLE_WIDTH),
    );
    // Starts a cycle to the left of the window so the trace is already running
    // when it scrolls in, rather than beginning at an edge.
    return `M ${-CYCLE_WIDTH} ${BASELINE} L ${-3} ${BASELINE} ${cycles.join(' ')}`;
  }, []);

  const registerTap = useCallback(() => {
    const element = traceRef.current;
    if (!element) {
      return;
    }
    // The animation's own clock, not performance.now(). It is the position the
    // player is actually looking at, and it stays right through a dropped frame
    // or a paused tab, neither of which a parallel timer survives.
    const animation = element.getAnimations()[0];
    const currentTime = animation?.currentTime;
    if (typeof currentTime !== 'number') {
      return;
    }

    const hit = gradeRhythmTap(currentTime);
    setLastHit(hit);
    setHitSeq((seq) => seq + 1);
    setRun((previous) => {
      const next = applyRhythmScore(previous, hit);
      // Read back from storage rather than from the `highScore` state, so this
      // stays correct without the callback depending on it — and so a second
      // window cannot quietly overwrite a better score set by the first.
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

  return (
    <div className="rhythm-game">
      <div className="rhythm-game__scores">
        <span className="rhythm-game__score">{run.score}</span>
        {/* The multiplier has to be visible or the streak is a hidden rule.
            A player who cannot see what a run is worth has no reason to
            protect it, and protecting it is the entire game. No translation
            needed — it is a number and a cross. */}
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
          viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
          preserveAspectRatio="none"
          aria-hidden="true"
          focusable="false"
        >
          {/* Scrolls by exactly one cycle per beat, so the spike lands on the
              target line once a beat, forever, with no seam. */}
          <g
            ref={traceRef}
            className="rhythm-game__scroll"
            style={{ animationDuration: `${BEAT_MS}ms` }}
          >
            <path d={path} />
          </g>
        </svg>

        {/* Where the spike has to be when you tap. */}
        <span className="rhythm-game__target" />

        {markerPosition !== undefined && lastHit && (
          <span
            key={hitSeq}
            className={`rhythm-game__hit rhythm-game__hit--${lastHit.verdict}`}
            style={{ left: `${markerPosition * 100}%` }}
          />
        )}
      </div>

      <p className="rhythm-game__verdict" aria-live="polite">
        {lastHit ? (
          <span
            key={hitSeq}
            className={`rhythm-game__verdict-text rhythm-game__verdict-text--${lastHit.verdict}`}
          >
            {t(`support.game.${lastHit.verdict}`)}
          </span>
        ) : (
          <span className="rhythm-game__verdict-text rhythm-game__verdict-text--idle">
            {t('support.game.hint')}
          </span>
        )}
      </p>
    </div>
  );
});

RhythmGame.displayName = 'RhythmGame';

export default RhythmGame;
