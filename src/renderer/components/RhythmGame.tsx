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
  applyRhythmScore,
  getStreakJoy,
  getStreakMultiplier,
  RhythmVerdict,
  gradeRhythmOffset,
} from 'common/rhythmGame';
import {
  useLiveAudioFrame,
  useLiveAudioControl,
} from '../audio/LiveAudioContext';
import { getRhythmRun, setRhythmRun, useRhythmRun } from '../utils/rhythmRun';
import { useIsEuphoriaForced } from '../utils/euphoriaMode';
import { useTranslation } from '../utils/I18nContext';
import ShareScoreCard from './ShareScoreCard';
import '../styles/RhythmGame.scss';

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

/** The multiplier ceiling, as a joy value. At this point the run plays itself. */
const EUPHORIA_AT = 1;

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
  // Held outside the component, so closing the dialog does not end the run.
  const run = useRhythmRun();
  // Replaces the whole panel, not just the trace. The card is about a run the
  // player has stepped away from to look at a picture of it, so leaving the
  // instruction, the score and a live waveform around it both crowds the card
  // and invites tapping at a game no longer in front of them.
  const [isSharing, setIsSharing] = useState(false);
  const [lastHit, setLastHit] = useState<IRhythmHit>();
  const [hitSeq, setHitSeq] = useState(0);
  // Redrawn from the state each frame. Kept in React state rather than mutated
  // in place so the SVG actually updates.
  const [path, setPath] = useState('');
  const [hasPeaks, setHasPeaks] = useState(false);
  // Whether anything is coming through at all, as opposed to whether a beat
  // has been found in it.
  const [hasSignal, setHasSignal] = useState(false);
  // Where each detected hit currently sits, as a percentage across the trace.
  const [peakMarks, setPeakMarks] = useState<number[]>([]);
  const verdictResetRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  // The newest peak the automatic run has already played.
  const lastAutoRef = useRef(-Infinity);
  // Two, alternating. See the fill below for why one is not enough.
  const binsRef = useRef<[number[], number[]]>([[], []]);
  const bufferSlotRef = useRef(0);

  const isListening = isActive && !isPaused;

  /**
   * One path for a hit, whether a person made it or the automatic run did.
   *
   * `record` is what separates them. Both show the same thing — the verdict,
   * the flare, the creature's face — but only a real tap moves the score.
   *
   * The run is read from the store rather than from the rendered value, because
   * state is a render behind and the face has to be right on the tap that
   * earned it.
   */
  const scoreHit = useCallback((hit: IRhythmHit, record = true) => {
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

    // The automatic run is theatre, not play. It shows the perfect and it keeps
    // the mode alive, but it must not add a single point: a score that climbs
    // while nobody is touching anything is not a score, and the high score is
    // meant to say something about the person who set it. Everything below this
    // line only happens for a tap someone actually made.
    if (!record) {
      return { verdict: hit.verdict, joy: getStreakJoy(getRhythmRun().streak) };
    }

    // Read from the store rather than from the rendered value, which is a
    // render behind — the face and the glow have to be right on the tap
    // that earned them.
    const next = applyRhythmScore(getRhythmRun(), hit);
    setRhythmRun(next);

    return { verdict: hit.verdict, joy: getStreakJoy(next.streak) };
  }, []);

  // One frame of spectrum in, one redraw out.
  useEffect(() => {
    // Nothing to do while the card is up: none of this is on screen, and it is
    // the most expensive thing the dialog does — two arrays and a path string
    // rebuilt around twenty-two times a second. Guarded here rather than only
    // in the render, so it genuinely stops rather than drawing into a hidden
    // element.
    if (!isListening || isSharing || points.length === 0) {
      return;
    }
    const now = performance.now();
    // The low half of the spectrum. Percussion energy that matters for keeping
    // time — kick, snare, toms — lives down there, and leaving the top out
    // keeps a bright synth pad from reading as a hit.
    // Filled into buffers allocated once and reused, rather than a slice and a
    // map every frame — at ~22 frames a second that was two arrays of a
    // hundred and sixty numbers per frame, thrown away immediately, for as long
    // as the dialog stayed open.
    //
    // TWO buffers, alternating, and that is not an optimisation — it is the
    // whole thing working. The detector keeps the frame it was given as
    // `previous` and diffs the next one against it. With a single reused array
    // it is handed the very array it is about to overwrite, so every frame gets
    // compared against itself, the flux is zero forever and no beat is ever
    // found. Writing into the buffer the detector is not holding is what makes
    // reuse safe at all.
    const half = Math.floor(points.length / 2);
    const buffers = binsRef.current;
    if (buffers[0].length !== half) {
      buffers[0] = new Array<number>(half);
      buffers[1] = new Array<number>(half);
    }
    bufferSlotRef.current = bufferSlotRef.current === 0 ? 1 : 0;
    const bins = buffers[bufferSlotRef.current];
    for (let index = 0; index < half; index += 1) {
      bins[index] = points[index].y;
    }
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
    // Silence draws nothing at all.
    //
    // The detector floors a silent frame to exactly zero, so without this the
    // trace collapses to a flat bar across the middle — a shape, drawn and
    // filled and outlined, saying there is a signal here and it is perfectly
    // even. An empty box says the true thing, and it is what puts the panel
    // back to "listening for the beat" rather than leaving a dead line under a
    // game that is still accepting taps.
    const hasSignal = next.history.some((sample) => sample.level > 0);
    setPath(
      hasSignal && upper.length > 1
        ? `M ${upper.join(' L ')} L ${lower.reverse().join(' L ')} Z`
        : '',
    );
    setPeakMarks(hasSignal ? marks : []);
    setHasPeaks(hasSignal && marks.length > 0);
    // Kept apart from `hasPeaks`, because the two mean different things and
    // they are different messages. No signal is "put something on"; a signal
    // with no beats yet is "give me a moment". Collapsing them told anyone
    // sitting in silence that the app was still working on it.
    setHasSignal(hasSignal);

    // At the ceiling the run plays itself. Every peak that reaches the line
    // scores as a perfect and flares, and it keeps doing so until the player
    // taps badly — a miss drops the streak, which drops the joy, which takes
    // the whole interface back down with it. That is the only way out.
    //
    // Each peak fires once. Its arrival is a fixed time, so remembering the
    // last one handled is enough to stop a peak still on screen from scoring
    // on every frame it remains visible.
    if (getStreakJoy(getRhythmRun().streak) >= EUPHORIA_AT) {
      next.history.forEach((sample) => {
        if (!sample.isPeak) {
          return;
        }
        const arrivesAt = sample.timeMs + LEAD_MS;
        if (arrivesAt <= now && arrivesAt > lastAutoRef.current) {
          lastAutoRef.current = arrivesAt;
          // Shown, not scored.
          scoreHit(gradeRhythmOffset(0), false);
        }
      });
    }
  }, [isListening, isSharing, points, scoreHit]);

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
    setHasSignal(false);
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
    return scoreHit(gradeRhythmOffset(now - LEAD_MS - peakMs));
  }, [scoreHit]);

  useImperativeHandle(ref, () => ({ registerTap }), [registerTap]);

  // Earned by the streak right now, or switched on by someone who earned it
  // before. The panel has to agree with the rest of the window: the switch
  // turned the whole interface rainbow, and a support panel still showing the
  // ordinary badge — with no way to share the mode — reads as the two halves
  // disagreeing about what is happening.
  // Called unconditionally: behind a `||` it would be skipped whenever the
  // streak already qualified, and a hook that runs on some renders and not
  // others is exactly the thing React cannot survive.
  const isForced = useIsEuphoriaForced();
  const isEuphoric = getStreakJoy(run.streak) >= EUPHORIA_AT || isForced;
  /**
   * What the card is about: this run, always.
   *
   * It used to fall back to a stored record, which produced the wrong picture
   * in the one case that matters — someone at ×10 right now, whole window
   * running the spectrum, pressing share and getting a card about a quieter
   * run from last Tuesday. The offer is made because of what is happening, so
   * it has to be about what is happening.
   *
   * With only perfect taps scoring, the live number is also the honest one:
   * it cannot be inflated by playing for longer, so there is nothing a record
   * would add beyond a second figure describing a run nobody is watching.
   */
  const shareScore = run.score;
  const shareMultiplier = getStreakMultiplier(run.streak);

  useEffect(
    () => () => {
      if (verdictResetRef.current !== undefined) {
        clearTimeout(verdictResetRef.current);
      }
    },
    [],
  );

  // The card takes the whole panel.
  //
  // Everything else unmounts rather than being scrolled past: the instruction,
  // the score, the trace and the verdict are all about a run that the player
  // has stepped away from to look at a picture of it, and leaving them on
  // screen both crowds the card and invites tapping at a game that is no
  // longer in front of them.
  //
  // Unmounting is also what stops the work. The trace redraws on every audio
  // frame — around twenty-two times a second, building two arrays and a path
  // string each time — and none of that is visible while the card is up. The
  // effect that does it is keyed on `isSharing` below, so it does not merely
  // hide, it stops.
  if (isSharing) {
    return (
      <div className="rhythm-game rhythm-game--sharing">
        <ShareScoreCard
          score={shareScore}
          multiplier={shareMultiplier}
          isEuphoric={isEuphoric}
          onClose={() => setIsSharing(false)}
        />
      </div>
    );
  }

  return (
    <div className="rhythm-game">
      {/* How to play, and what it is worth playing for. Kept above the trace
          because someone who has not worked out that this is a game will never
          look below it — and deliberately vague about the reward, since
          spoiling it costs the only surprise the app has. */}
      <p className="rhythm-game__howto">{t('support.game.howTo')}</p>
      {/* The record used to sit here and no longer appears anywhere. It is
          still kept, because the card falls back to it when the current run is
          not the one worth showing, but as a line of type it was a third
          number competing with the two that describe what is happening right
          now — and the score already says whether this run is going well. */}
      <div className="rhythm-game__scores">
        <span className="rhythm-game__score">
          {run.score}
          {/* A streak nobody can see is a hidden rule, and a player who cannot
              tell what a run is worth has no reason to protect it.

              Inside the score and hung off its right edge rather than beside
              it in a row. A row would centre the PAIR, so the score itself
              would sit left of centre and would shift again every time the
              multiplier gained a digit — while the creature above it and the
              target line below it both stay on the true middle. This way the
              number holds the centre line and the pill hangs off it. */}
          {run.streak > 1 && (
            <span className="rhythm-game__streak">
              ×
              {getStreakMultiplier(run.streak)
                .toFixed(2)
                .replace(/\.?0+$/, '')}
            </span>
          )}
        </span>
      </div>

      <div className="rhythm-game__trace">
        {/* The clip holds only the scrolling wave. The target line and the hit
            marker are siblings of it, not children — inside, their glow was
            sliced flat against the top and bottom edges. */}
        <div className="rhythm-game__clip">
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
        </div>

        {/* In the empty box, not under it. The box is the thing that looks
              broken when nothing is playing, so the explanation belongs in the
              hole it leaves rather than on a line below that the eye has
              already skipped past on its way to the silence. */}
        {!hasSignal && (
          <span className="rhythm-game__empty">
            {t('support.game.noAudio')}
          </span>
        )}

        {/* Corner of the trace, because the trace is what euphoria mode
              actually changes — it is the thing that turns rainbow, and the
              badge naming it belongs on the thing it describes rather than up
              in a row of numbers that look the same either way. */}
        {isEuphoric && (
          <span className="euphoria-pill rhythm-game__mode">
            {t('support.game.euphoria')}
          </span>
        )}

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
            // Silence says nothing here, because it is already saying it in
            // the empty box above. Printing it twice, once inside the hole and
            // once under it, reads as two separate complaints about the same
            // quiet room.
            if (!isListening || !hasSignal) {
              return '';
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

      {/* Under the verdict, because that is the line that says you just did
          something worth showing anyone. Nothing to share until there is a
          record — offering it at zero is an empty button and an invitation to
          post a score of nothing.

          At the ceiling it stops being a quiet outline and turns into the
          spectrum: the offer is made while the thing it captures is still on
          screen, rather than as a footnote beside a number. */}
      {shareScore > 0 && !isSharing && (
        <button
          type="button"
          className={`rhythm-game__share${isEuphoric ? ' is-euphoric' : ''}`}
          onClick={() => setIsSharing(true)}
        >
          {/* The standard share glyph — a node linked to two others. Drawn
              rather than imported because it is the only place in the app that
              needs one, and it is nine lines. */}
          <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
            <circle cx="12.5" cy="3" r="2.1" />
            <circle cx="12.5" cy="13" r="2.1" />
            <circle cx="3.5" cy="8" r="2.1" />
            <path d="M5.4 7 L10.6 4.1 M5.4 9 L10.6 11.9" />
          </svg>
          {isEuphoric
            ? t('support.game.shareEuphoria')
            : t('support.game.share')}
        </button>
      )}

      {/* The ask, and it stays quiet. This is only ever read by someone who has
          already given — the game is behind the badge — so it is a thank you
          with a door left open, not a pitch. */}
      <p className="rhythm-game__thanks">{t('support.game.thanks')}</p>
    </div>
  );
});

RhythmGame.displayName = 'RhythmGame';

export default RhythmGame;
