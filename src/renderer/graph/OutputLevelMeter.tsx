/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

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

/**
 * The output level meter, in the sidebar under the visualizer switch.
 *
 * Ten styles a click cycles through, drawn on one canvas that covers both
 * channels — the shapes each style draws could not have been done as CSS
 * without inventing ten different DOM structures, and the meter is one
 * reading anyway so drawing them together lets a style span both channels
 * where it wants to. Ctrl+click walks the cycle backwards, and the style's
 * name sits under the strips permanently — cycling happens by clicking the
 * meter itself, so a label that faded away would leave no way to tell which
 * style is on without clicking again and changing it.
 *
 * In Normal mode the reading is the window's primary, dark to light; in
 * Rainbow mode it is the rainbow in use. Both modes fill the pane the same
 * way — the mode carries the colour, not the geometry. How each style is
 * drawn is `meter/`; this file is the reading and the frame.
 */

import type { TranslationKey } from 'common/i18n';
import {
  MouseEvent as ReactMouseEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { getStreakJoy } from 'common/rhythmGame';
import { getEaseFactor } from 'common/smoothing';
import { METER_STYLES, MeterStyle, METER_STYLE_KEY } from 'common/meterStyles';
import { useTranslation } from '../utils/I18nContext';
import {
  useLiveAudioCapture,
  useLiveAudioControl,
  useLiveAudioFrame,
} from '../audio/LiveAudioContext';
import { toggleGraphMeter, useGraphMeterHidden } from '../utils/graphStyle';
import { useRhythmRun } from '../utils/rhythmRun';
import { useIsEuphoric } from '../utils/euphoriaMode';
import useSmoothFrames from '../utils/useSmoothFrames';
import {
  LEVEL_FLOOR_DB,
  advanceLevel,
  amplitudeToDb,
  createLevelFollower,
  levelFraction,
  levelZone,
} from './outputLevel';
import { readTextInk, readSurface, useLiveSurface } from '../utils/theme';
import {
  drawChannel,
  drawClipCap,
  drawSlot,
  meterStyleMoves,
  standsInSlot,
} from './meter/meterDraw';
import {
  type IChannelLevel,
  type IChannelRect,
  createPen,
  ladderRows,
} from './meter/meterPaint';
import { type IMeterPrint, drawMeterPrint } from './meter/meterPrint';

type TMeterCycleStyle = MeterStyle | 'off';

const METER_CYCLE: readonly TMeterCycleStyle[] = [...METER_STYLES, 'off'];

const LEGACY_METER_OFF_MIGRATION_KEY = 'fluideq.meterOffStateMigrated';

const isMeterCycleStyle = (value: string | null): value is TMeterCycleStyle =>
  value === 'off' || METER_STYLES.includes(value as MeterStyle);

/**
 * What each look is called, on the meter and read out with it. It printed
 * the style's id in capitals, the same English word in every language.
 */
const METER_STYLE_NAME_KEYS = {
  bar: 'look.meter.bar',
  segments: 'look.meter.segments',
  leds: 'look.meter.leds',
  fluid: 'look.meter.fluid',
  mercury: 'look.meter.mercury',
  needle: 'look.meter.needle',
  pulse: 'look.meter.pulse',
  stack: 'look.meter.stack',
  flow: 'look.meter.flow',
  center: 'look.meter.center',
  off: 'look.meter.off',
} as const satisfies Record<TMeterCycleStyle, TranslationKey>;

/**
 * What to call a bar.
 *
 * A single letter, and still a key: several of the ten locales do not use L and
 * R for this — Russian sound gear says Л and П, Chinese 左 and 右 — and the one
 * place a translator can say so is a dictionary entry. `M` is the honest label
 * for the case where Windows handed over a mono endpoint and there is genuinely
 * only one channel to show.
 */
const channelNameKey = (index: number, isStereo: boolean): TranslationKey => {
  if (!isStereo) {
    return 'graph.meter.mono';
  }
  return index === 0 ? 'graph.meter.left' : 'graph.meter.right';
};

/**
 * How the level and peak fall between frames — the same numbers in Rainbow
 * and out of it, both drawn at the display's own rate. Slowing the release
 * for Rainbow once made the meter lag the music, which reads as a broken
 * meter rather than as a smooth one.
 *
 * Nothing rises slowly. The bar eased up with a 35 ms half-life, on top of a
 * reading the pump had taken up to 33 ms before: a kick reached half height
 * well after it was heard. A meter that eases upward under-reads exactly the
 * transients it exists to catch — `advanceLevel` says as much and was already
 * instant; the drawing undid it.
 */
// A ten-millisecond half-life covers three quarters of the remaining
// distance in a single 60Hz frame, which is not a release at all — the
// bars simply teleported to the new reading and the fall was over before
// it could be seen. Two hundred lets the drop actually read as a drop.
// Quicker than it was, at 200ms. A ladder of discrete lamps shows the fall
// as steps going out, and a slow release left the bottom of the ladder lit
// through gaps the ear plainly hears — the reading lagged the music.
const LEVEL_RELEASE_MS = 120;
const PEAK_RELEASE_MS = 900;

const CHANNEL_WIDTH = 18;

const CHANNEL_GAP = 8;

/*
 * NO CURVE ON THE READING, and this is the one rule the meter cannot
 * bend.
 *
 * There was a `level ** 2.8` here, added because modern masters sit
 * between −20 and −3 dBFS and a linear strip of that range only moves in
 * its top third — the bars looked pinned. The curve spread that range
 * over more of the strip and the meter moved beautifully.
 *
 * It was also a lie, and the worst possible one. Somebody setting the
 * preamp is reading this to find out how much room is left before the
 * output rails; a curve that pushes the drawing down reports headroom
 * that is not there. `levelFraction` is linear in decibels for the same
 * reason every meter worth reading is, and whatever it returns is what
 * gets drawn.
 *
 * A meter that looks dull because the music really is that loud is
 * telling the truth. That is the whole job.
 */

interface IOutputLevelMeterProps {
  /**
   * The louder channel's held peak, in dB below full scale, whenever the
   * number printed to one decimal would change; `null` while the meter is off
   * or nothing is being captured. The side bar prints it beside the meter.
   *
   * A callback rather than state: it fires from the draw loop, and a React
   * render per frame for one number is the thing the canvas exists to avoid.
   */
  onReading?: (peakDb: number | null) => void;
}

const OutputLevelMeter = ({ onReading }: IOutputLevelMeterProps) => {
  const { isClipping, outputLevels } = useLiveAudioFrame();
  const onReadingRef = useRef(onReading);
  onReadingRef.current = onReading;
  const lastReadingRef = useRef('');
  const isIdleRef = useRef(true);
  isIdleRef.current = outputLevels.length === 0;
  const { readFrame } = useLiveAudioControl();
  const readFrameRef = useRef(readFrame);
  readFrameRef.current = readFrame;
  const { t } = useTranslation();
  const isHidden = useGraphMeterHidden();
  const isEuphoric = useIsEuphoric(getStreakJoy(useRhythmRun().streak) >= 1);
  const isEuphoricRef = useRef(isEuphoric);
  isEuphoricRef.current = isEuphoric;

  // Remembered across launches: which one somebody likes is a preference,
  // and being handed back a different meter every morning is not charming.
  // The first-run default is `fluid`, the same look the titlebar wave
  // opens on, so the two visualisers agree about what the app looks like
  // before anybody has chosen anything.
  const migratedLegacyOffRef = useRef(false);
  const [style, setStyle] = useState<TMeterCycleStyle>(() => {
    try {
      const stored = window.localStorage.getItem(METER_STYLE_KEY);
      if (
        isHidden &&
        stored === METER_STYLES[0] &&
        window.localStorage.getItem(LEGACY_METER_OFF_MIGRATION_KEY) !== 'true'
      ) {
        window.localStorage.setItem(LEGACY_METER_OFF_MIGRATION_KEY, 'true');
        window.localStorage.setItem(METER_STYLE_KEY, 'off');
        migratedLegacyOffRef.current = true;
        return 'off';
      }
      return isMeterCycleStyle(stored) ? stored : 'fluid';
    } catch {
      return 'fluid';
    }
  });
  const isOff = style === 'off';
  const drawableStyle: MeterStyle = isOff ? 'fluid' : style;
  const styleRef = useRef<MeterStyle>(drawableStyle);
  styleRef.current = drawableStyle;
  const isOffRef = useRef(isOff);
  isOffRef.current = isOff;

  // Hidden is still the View-menu preference. Off is a visible cycle state:
  // it releases the analyser claim but leaves this button available to restore
  // the next visualiser style with another click.
  useLiveAudioCapture(!isHidden && !isOff);

  useEffect(() => {
    if (!migratedLegacyOffRef.current || !isHidden) {
      return;
    }
    migratedLegacyOffRef.current = false;
    toggleGraphMeter();
  }, [isHidden]);

  // The style's name is painted at the foot of the canvas on every frame
  // and never goes away, so cycling needs no timer and no announcement
  // state — see the label at the end of the frame loop.
  const cycleStyle = useCallback(
    (event: ReactMouseEvent<HTMLButtonElement>) => {
      const goingBack = event.ctrlKey || event.metaKey;
      setStyle((current) => {
        const at = METER_CYCLE.indexOf(current);
        const direction = goingBack ? -1 : 1;
        const next =
          METER_CYCLE[
            (at + direction + METER_CYCLE.length) % METER_CYCLE.length
          ] ?? 'fluid';
        try {
          window.localStorage.setItem(METER_STYLE_KEY, next);
        } catch {
          // Not worth failing a click over.
        }
        return next;
      });
    },
    [],
  );

  // The buffered channel state, eased frame-to-frame so the meter carries
  // motion between analyser publishes and does not jump.
  /**
   * How much of the clip warning is showing, per channel, 0 to 1.
   *
   * The hold is a boolean and it ends the way a switch ends — the red was
   * simply gone on the next frame, which reads as a glitch rather than as a
   * warning finishing. This rises the moment the warning is true and falls
   * over a fifth of a second when it stops.
   */
  const warnEnvelopeRef = useRef<number[]>([0, 0]);
  const easedRef = useRef<IChannelLevel[]>([
    { level: 0, peak: 0, zone: 'safe', peakZone: 'safe' },
    { level: 0, peak: 0, zone: 'safe', peakZone: 'safe' },
  ]);
  const targetsRef = useRef<IChannelLevel[]>(easedRef.current);
  /**
   * The meter's own ballistics for readings taken at draw time, and which
   * channels the pump last saw rail: clipping keeps its hold there, and a
   * sample at the rail is the pump's evidence, not the drawing's.
   */
  const followersRef = useRef([createLevelFollower(), createLevelFollower()]);
  const railedRef = useRef<boolean[]>([]);

  useEffect(() => {
    if (isOff) {
      return;
    }
    const isIdle = outputLevels.length === 0;
    const channels = isIdle
      ? [
          {
            levelDb: LEVEL_FLOOR_DB,
            peakDb: LEVEL_FLOOR_DB,
            isClipping: false,
          },
          {
            levelDb: LEVEL_FLOOR_DB,
            peakDb: LEVEL_FLOOR_DB,
            isClipping: false,
          },
        ]
      : outputLevels;
    targetsRef.current = channels.map((channel, index) => {
      const level = levelFraction(channel.levelDb);
      const peak = levelFraction(channel.peakDb);
      /**
       * Only measured samples at a digital rail say CLIP.
       *
       * The capture's own verdict, from samples pinned to either rail, and
       * the app's one definition of clipping — the titlebar wave and the
       * graph's badge read the same flag. It used to be joined by a second
       * verdict read off the engine's own peaks at -1 dBFS, which called
       * every loud record clipped whether or not anything touched it.
       * Orange remains measured near-ceiling level; red is evidence.
       */
      const isRailed = channel.isClipping;
      railedRef.current[index] = isRailed;
      return {
        level,
        peak,
        // Zones from this channel's own decibels. The flag is deliberately
        // not folded in here for the reason above.
        zone: levelZone(channel.levelDb, false),
        peakZone: isRailed
          ? ('clip' as const)
          : levelZone(channel.peakDb, false),
      };
    });
    if (easedRef.current.length !== targetsRef.current.length) {
      easedRef.current = targetsRef.current.map((channel) => ({ ...channel }));
    }
  }, [isOff, outputLevels]);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const contextRef = useRef<CanvasRenderingContext2D | null>(null);
  const sizeRef = useRef({ width: 0, height: 0 });
  /**
   * The scale, letters and chip (`drawMeterPrint`), printed once on a canvas
   * outside the page and copied onto every frame until one of them changes.
   *
   * Lettered on the meter's own canvas they cost ~230 ms of script a second
   * in Ivan's window (2026-09-24), nearly all of it in the `font` setter: a
   * canvas in the page brings the page's style up to date before it can
   * resolve a font, and on the Studio page its meters leave that style
   * stale every frame. A canvas outside the page has no style to update.
   */
  const printSheetRef = useRef<HTMLCanvasElement | null>(null);
  const printKeyRef = useRef('');
  const drawFrame = useCallback(
    (deltaMs: number) => {
      const textInk = readTextInk();
      const canvas = canvasRef.current;
      const context = contextRef.current;
      if (!canvas || !context) {
        return false;
      }
      const boxWidth = sizeRef.current.width;
      const boxHeight = sizeRef.current.height;
      if (boxWidth <= 0 || boxHeight <= 0) {
        return false;
      }

      const ratio = window.devicePixelRatio || 1;
      const backingWidth = Math.max(1, Math.round(boxWidth * ratio));
      const backingHeight = Math.max(1, Math.round(boxHeight * ratio));
      if (canvas.width !== backingWidth || canvas.height !== backingHeight) {
        canvas.width = backingWidth;
        canvas.height = backingHeight;
      }
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);

      const isOff = isOffRef.current;
      // The palette values the shell publishes on `:root` (see `--meter-well`
      // in App.scss): a canvas cannot use a Sass variable, and the hex these
      // once were went stale every time the palette moved. `readSurface`
      // follows a theme or tint change without forcing a style recalculation
      // on every frame.
      const wellColour = readSurface(
        styleRef.current === 'pulse' ? '--meter-well-pulse' : '--meter-well',
        '#2e4f63',
      );
      const unlitColour = readSurface('--meter-unlit', '#1a3a4e');
      const fall = getEaseFactor(deltaMs, LEVEL_RELEASE_MS);
      const peakFall = getEaseFactor(deltaMs, PEAK_RELEASE_MS);
      let moving = false;

      // The output as it is at this frame rather than at the pump's last
      // tick — see `liveFrameReader.ts`. Off, paused or showing another PC's
      // audio, it answers nothing and the published levels stand.
      const fresh = isOff ? undefined : readFrameRef.current();
      if (fresh && fresh.channelPeaks.length === targetsRef.current.length) {
        targetsRef.current = fresh.channelPeaks.map((amplitude, index) => {
          const follower = advanceLevel(
            followersRef.current[index] ?? createLevelFollower(),
            amplitudeToDb(amplitude),
            deltaMs,
          );
          followersRef.current[index] = follower;
          // Sound keeps the loop drawing: stopping between two readings
          // would put the pump's cadence back in front of the next hit.
          //
          // And so does a peak still held or falling. The capture stops
          // publishing once its own meter is at rest, so nothing would wake
          // a loop that stopped while this one's peak sat out its hold, and
          // the mark would hang there until the music came back. The peak is
          // never under the level, so this covers both.
          moving ||= follower.peakDb > LEVEL_FLOOR_DB;
          return {
            level: levelFraction(follower.levelDb),
            peak: levelFraction(follower.peakDb),
            zone: levelZone(follower.levelDb, false),
            peakZone: railedRef.current[index]
              ? ('clip' as const)
              : levelZone(follower.peakDb, false),
          };
        });
      }

      if (!isOff) {
        for (let i = 0; i < easedRef.current.length; i += 1) {
          const target = targetsRef.current[i];
          // A channel with no reading yet is left at whatever it was holding
          // rather than eased toward nothing, which would drop it to the floor
          // for one frame every time the capture restarts.
          if (target) {
            const eased = easedRef.current[i];
            const levelGap = target.level - eased.level;
            if (Math.abs(levelGap) > 0.002) {
              eased.level =
                levelGap > 0 ? target.level : eased.level + levelGap * fall;
              moving = true;
            } else {
              eased.level = target.level;
            }
            const peakGap = target.peak - eased.peak;
            if (Math.abs(peakGap) > 0.002) {
              // Peak rises instantly to the new peak, falls slowly.
              eased.peak += peakGap * (peakGap > 0 ? 1 : peakFall);
              moving = true;
            } else {
              eased.peak = target.peak;
            }
            eased.zone = target.zone;
            eased.peakZone = target.peakZone;
          }
        }
      }

      const channelCount = easedRef.current.length;
      // ONE WIDTH FOR EVERY STYLE.
      //
      // They were being set apart one at a time and the meter changed size
      // as it cycled, which is a control that moves under the eye for no
      // reason the eye can name. A style is a way of drawing the same
      // reading, not a different instrument.
      const channelWidth = CHANNEL_WIDTH;
      const channelGap = CHANNEL_GAP;
      // Layout: two channels centred with a gap between them.
      const totalWidth =
        channelCount * channelWidth + (channelCount - 1) * channelGap;
      const startX = (boxWidth - totalWidth) / 2;
      // The dB scale on either side of the pair. Not for the centre-zero
      // style, whose reading grows from the middle and has no floor to rule
      // from, and not while the meter is off and there is nothing to read.
      const hasScale = !isOff && styleRef.current !== 'center';
      // Room at the top for the channel letters, and at the foot for the
      // style's name: twenty-eight, because at twenty the chip sat three
      // pixels under the strips' feet and read as part of the reading (Ivan,
      // 2026-09-22).
      const labelBand = 12;
      const footBand = 28;
      const rectY = labelBand;
      const rectHeight = Math.max(1, boxHeight - labelBand - footBand);
      const pen = createPen(context, ratio, performance.now());

      for (let i = 0; i < channelCount; i += 1) {
        const rect: IChannelRect = {
          x: startX + i * (channelWidth + channelGap),
          y: rectY,
          width: channelWidth,
          height: rectHeight,
        };
        // Railed samples only. The near-ceiling zone was tried as a warning
        // too, and it read as the meter warning about ordinary loud music —
        // the zone is already said by the reading's own colour. Full while
        // it is true, then out over 200 ms, so the lamp goes out rather than
        // vanishing between one frame and the next.
        const clipped = !isOff && easedRef.current[i]?.peakZone === 'clip';
        const previous = warnEnvelopeRef.current[i] ?? 0;
        const warnLevel = clipped ? 1 : Math.max(0, previous - deltaMs / 200);
        warnEnvelopeRef.current[i] = warnLevel;
        if (!clipped && warnLevel > 0.001) {
          moving = true;
        }
        // The slot is the slider tracks' own colour (`--meter-well`), so the
        // strip is a track with a reading in it, beside the band sliders
        // that are the same thing; switched off it is the slot and nothing
        // else.
        if (isOff || standsInSlot(styleRef.current)) {
          drawSlot(pen, rect, wellColour, warnLevel);
        }
        if (!isOff) {
          drawChannel(
            pen,
            rect,
            easedRef.current[i],
            styleRef.current,
            isEuphoricRef.current,
            unlitColour,
          );
        }
        drawClipCap(pen, rect, warnLevel);
      }

      const isStereo = channelCount > 1;
      const print: IMeterPrint = {
        boxWidth,
        boxHeight,
        startX,
        totalWidth,
        channelWidth,
        channelGap,
        rectY,
        rectHeight,
        scale: hasScale
          ? { rows: ladderRows(styleRef.current, rectHeight) }
          : undefined,
        letters: easedRef.current.map((_, i) => t(channelNameKey(i, isStereo))),
        styleName: isOff
          ? undefined
          : t(METER_STYLE_NAME_KEYS[styleRef.current]).toUpperCase(),
        ink: textInk,
      };
      const printKey = `${backingWidth}x${backingHeight}@${ratio} ${JSON.stringify(print)}`;
      if (printKey !== printKeyRef.current) {
        printSheetRef.current ??= document.createElement('canvas');
        const sheet = printSheetRef.current;
        // Setting the size clears the sheet and its state, even at the
        // same size.
        sheet.width = backingWidth;
        sheet.height = backingHeight;
        const sheetContext = sheet.getContext('2d');
        if (sheetContext) {
          sheetContext.setTransform(ratio, 0, 0, ratio, 0, 0);
          drawMeterPrint(sheetContext, print);
          printKeyRef.current = printKey;
        }
      }
      if (printSheetRef.current && printKeyRef.current === printKey) {
        context.setTransform(1, 0, 0, 1, 0, 0);
        context.drawImage(printSheetRef.current, 0, 0);
        context.setTransform(ratio, 0, 0, ratio, 0, 0);
      }

      // What the side bar prints beside the meter: the louder channel's held
      // peak, and only when the printed number would change. Idle — no
      // capture at all — is told apart from silence, which is a reading of
      // the floor and prints as nothing on its own.
      const report = onReadingRef.current;
      if (report) {
        let loudest = LEVEL_FLOOR_DB;
        if (!isOff && !isIdleRef.current) {
          followersRef.current.forEach((follower) => {
            loudest = Math.max(loudest, follower.peakDb);
          });
        }
        const printed =
          isOff || isIdleRef.current || loudest <= LEVEL_FLOOR_DB
            ? ''
            : loudest.toFixed(1);
        if (printed !== lastReadingRef.current) {
          lastReadingRef.current = printed;
          report(printed ? Number(printed) : null);
        }
      }

      // Some styles move by the clock as well as by the reading, so the loop
      // stays awake for them (`meterStyleMoves`); every other style reports
      // honestly and lets it stop through a quiet passage.
      return (
        !isOff &&
        (moving || meterStyleMoves(styleRef.current, isEuphoricRef.current))
      );
    },
    [t],
  );

  const kickFrames = useSmoothFrames(drawFrame, {
    isEnabled: true,
    target: canvasRef,
  });

  const attachCanvas = useCallback((canvas: HTMLCanvasElement | null) => {
    canvasRef.current = canvas;
    contextRef.current = canvas ? canvas.getContext('2d') : null;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || typeof ResizeObserver === 'undefined') {
      return undefined;
    }
    const observer = new ResizeObserver((entries) => {
      const box = entries[entries.length - 1]?.contentRect;
      if (!box) {
        return;
      }
      sizeRef.current.width = box.width;
      sizeRef.current.height = box.height;
      kickFrames();
    });
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [kickFrames]);

  // The colours a meter at rest is drawn in, as the window paints them now.
  // The loop only runs while something moves, so a meter with nothing to show
  // kept the wells it was first drawn with: the theme and a visualizer's
  // colours land on the window after that first frame, and the slots stood a
  // darker colour until music woke the loop (Ivan, 2026-09-27: "when it load
  // have like darker bg color and it restores to this one").
  const wellInk = useLiveSurface(
    style === 'pulse' ? '--meter-well-pulse' : '--meter-well',
    '#2e4f63',
  );
  const unlitInk = useLiveSurface('--meter-unlit', '#1a3a4e');
  const scaleInk = useLiveSurface('--text-faint', '#bfd3e3');

  // Kick the loop on new frames and on state that changes the drawing.
  useEffect(() => {
    kickFrames();
  }, [
    isClipping,
    isEuphoric,
    kickFrames,
    outputLevels,
    style,
    wellInk,
    unlitInk,
    scaleInk,
  ]);

  if (isHidden) {
    return null;
  }

  const isIdle = outputLevels.length === 0;
  const styleName = t(METER_STYLE_NAME_KEYS[style]);
  return (
    <button
      type="button"
      className={`output-meter${
        isClipping && !isOff ? ' is-clipping' : ''
      }${isIdle && !isOff ? ' is-idle' : ''}${isOff ? ' is-off' : ''}`}
      aria-label={`${t('graph.meter.aria')} — ${styleName}`}
      title={`${t('graph.meter.aria')} — ${styleName}`}
      onClick={cycleStyle}
    >
      <canvas ref={attachCanvas} className="output-meter__canvas" aria-hidden />
      {isOff && (
        <span className="output-meter__off">{styleName.toUpperCase()}</span>
      )}
    </button>
  );
};

export default OutputLevelMeter;
