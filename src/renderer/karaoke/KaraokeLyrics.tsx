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

import {
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
  useEffect,
  useRef,
  useState,
} from 'react';
import { findActiveKaraokeLine } from '../../common/karaoke/clock';
import { IKaraokeSong } from '../../common/karaoke/types';
import MenuIcon from '../icons/MenuIcon';
import { useTranslation } from '../utils/I18nContext';
import {
  DEFAULT_LYRIC_TEXT_SIZE,
  EUPHORIA_SWEEP_TIME_MS,
  LYRIC_FONT_FAMILY,
  LYRIC_MOTION_TIME_MS,
  WHEEL_STEP_THRESHOLD,
  clamp,
  groupKaraokeTokensIntoWords,
  karaokeLyricEntranceOpacity,
  karaokeVisualWordDisplayText,
  karaokeVisualWordProgressWidth,
} from './karaokeLyricText';

interface IKaraokeLyricsProps {
  song: IKaraokeSong;
  playheadMs: number;
  onSeek: (timeMs: number) => void;
  followRequestKey?: number;
  showFollowButton?: boolean;
  textSize?: number;
  /** Keep a chosen line centered while its existing timing is being repaired. */
  centerLineId?: string;
  /** Paint timing progress on a chosen line during guided capture. */
  activeLineId?: string;
  /** Current macro-capture line and its explicit START/END state. */
  captureLineId?: string;
  captureLineState?: 'pending' | 'started' | 'complete';
}

export interface ILyricHitRegion {
  index: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export const lyricHitRegionContains = (
  region: ILyricHitRegion,
  x: number,
  y: number,
) =>
  x >= region.left &&
  x <= region.right &&
  y >= region.top &&
  y <= region.bottom;

/** Waits shorter than this are a breath, not a silence to count through. */
const COUNTDOWN_MIN_WAIT_MS = 3_000;

/** How long before the line the count starts. */
const COUNTDOWN_MS = 3_200;

/** How long "sing" stays after the line has started. */
const COUNTDOWN_SING_MS = 700;

interface ILyricDrawState {
  song: IKaraokeSong;
  playheadMs: number;
  activeIndex: number;
  centerIndex: number;
  /** When the next sung line starts, while nothing is being sung. */
  nextStartMs?: number;
  /** When the silence before it began: the end of the last line, or zero at
   * the top of the song. The two together are the length of the wait. */
  waitStartMs?: number;
  /** The word under the last beat of the count, in the reader's language. */
  singLabel: string;
}

interface ILyricMotionState {
  center: number;
  frameTimeMs: number;
}

interface ILyricEntranceState {
  songId: string;
  startedAtMs: number;
}

const lyricLineMotion = (offset: number) => {
  const distance = Math.abs(offset);
  if (distance < 1) {
    // The next phrase remains readable for preparation; the phrase already
    // sung recedes quickly. Both step down clearly in size so the active line
    // owns the stage instead of sitting in a wall of equally large text.
    const directionOpacity = offset >= 0 ? 0.62 : 0.3;
    const directionScale = offset >= 0 ? 0.84 : 0.78;
    return {
      opacity: 1 + (directionOpacity - 1) * distance,
      scale: 1 + (directionScale - 1) * distance,
    };
  }
  const isUpcoming = offset > 0;
  const nearOpacity = isUpcoming ? 0.62 : 0.3;
  const farOpacity = isUpcoming ? 0.12 : 0.05;
  const nearScale = isUpcoming ? 0.84 : 0.78;
  const farScale = 0.68;
  const fade = clamp(distance - 1, 0, 1);
  return {
    opacity: nearOpacity + (farOpacity - nearOpacity) * fade,
    scale: nearScale + (farScale - nearScale) * fade,
  };
};

const KaraokeLyrics = ({
  song,
  playheadMs,
  onSeek,
  followRequestKey = 0,
  showFollowButton = true,
  textSize = DEFAULT_LYRIC_TEXT_SIZE,
  centerLineId,
  activeLineId,
  captureLineId,
  captureLineState,
}: IKaraokeLyricsProps) => {
  const { t } = useTranslation();
  const [isFollowing, setIsFollowing] = useState(true);
  const [manualCenterIndex, setManualCenterIndex] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wheelDeltaRef = useRef(0);
  // Held as state, not a ref: the component returns an empty shell before
  // any lyrics exist, so a ref read once at mount is null and the wheel
  // listener never attaches. State re-runs the effect when the node appears.
  const [shell, setShell] = useState<HTMLDivElement | null>(null);
  const lineHitRegionsRef = useRef<ILyricHitRegion[]>([]);
  const motionStateRef = useRef<ILyricMotionState | undefined>(undefined);
  const entranceStateRef = useRef<ILyricEntranceState>({
    songId: song.id,
    startedAtMs: performance.now(),
  });
  // Reset synchronously with the incoming song. Waiting for an effect would
  // allow one fully opaque frame from a newly loaded song to flash first.
  if (entranceStateRef.current.songId !== song.id) {
    entranceStateRef.current = {
      songId: song.id,
      startedAtMs: performance.now(),
    };
  }
  const textSizeRef = useRef(textSize);
  textSizeRef.current = textSize;
  const detectedActiveIndex = findActiveKaraokeLine(song.lines, playheadMs);
  const requestedActiveIndex = activeLineId
    ? song.lines.findIndex((line) => line.id === activeLineId)
    : -1;
  const activeIndex =
    requestedActiveIndex >= 0 ? requestedActiveIndex : detectedActiveIndex;
  const activeLine = activeIndex >= 0 ? song.lines[activeIndex] : undefined;
  const nextLyricIndex = song.lines.findIndex(
    (line, index) => index > detectedActiveIndex && line.kind !== 'section',
  );
  const nextLyric =
    nextLyricIndex >= 0 ? song.lines[nextLyricIndex] : undefined;
  const sectionBeforeNextLyric =
    nextLyricIndex > 0 && song.lines[nextLyricIndex - 1]?.kind === 'section';
  const shouldPreReadSectionLyric =
    requestedActiveIndex < 0 &&
    sectionBeforeNextLyric &&
    nextLyric?.startMs !== undefined &&
    playheadMs >= nextLyric.startMs - 2_000;
  const firstLyricAfterSectionIndex =
    activeLine?.kind === 'section'
      ? song.lines.findIndex(
          (line, index) => index > activeIndex && line.kind !== 'section',
        )
      : -1;
  const shouldPrepareNext =
    requestedActiveIndex < 0 &&
    activeLine?.endMs !== undefined &&
    playheadMs >= activeLine.endMs &&
    activeIndex + 1 < song.lines.length;
  const requestedCenterIndex = centerLineId
    ? song.lines.findIndex((line) => line.id === centerLineId)
    : -1;
  let playbackCenterIndex = Math.max(0, activeIndex);
  if (firstLyricAfterSectionIndex >= 0) {
    // A section marker remains visible in the row above while its first real
    // lyric owns the readable center. Markers never consume the singing lane.
    playbackCenterIndex = firstLyricAfterSectionIndex;
  } else if (shouldPreReadSectionLyric && nextLyricIndex >= 0) {
    playbackCenterIndex = nextLyricIndex;
  } else if (shouldPrepareNext) {
    playbackCenterIndex = activeIndex + 1;
  }
  if (requestedCenterIndex >= 0) {
    playbackCenterIndex = requestedCenterIndex;
  }
  const centerIndex =
    requestedCenterIndex >= 0 || isFollowing
      ? playbackCenterIndex
      : clamp(manualCenterIndex, 0, Math.max(0, song.lines.length - 1));
  /**
   * The wait before the singing starts again, if there is one worth counting.
   *
   * An intro, a solo, the pause between verses: the words are on screen but
   * nothing says when to come in, so the singer either guesses or watches the
   * playhead. Measured from the end of the last line rather than from now, so
   * a wait is a property of the song and not of when somebody happened to
   * look at it.
   */
  const previousEndMs =
    detectedActiveIndex >= 0
      ? song.lines[detectedActiveIndex]?.endMs
      : undefined;
  const waitStartMs = detectedActiveIndex >= 0 ? previousEndMs : 0;
  const isSinging =
    activeLine?.kind !== 'section' &&
    activeLine?.startMs !== undefined &&
    activeLine.endMs !== undefined &&
    playheadMs >= activeLine.startMs &&
    playheadMs < activeLine.endMs;

  const drawStateRef = useRef<ILyricDrawState>({
    song,
    playheadMs,
    activeIndex,
    centerIndex,
    singLabel: t('karaoke.countdown.sing'),
  });
  drawStateRef.current = {
    song,
    playheadMs,
    activeIndex,
    centerIndex,
    nextStartMs: isSinging ? undefined : nextLyric?.startMs,
    waitStartMs,
    singLabel: t('karaoke.countdown.sing'),
  };

  useEffect(() => {
    setIsFollowing(true);
    setManualCenterIndex(0);
    wheelDeltaRef.current = 0;
    lineHitRegionsRef.current.length = 0;
    motionStateRef.current = undefined;
  }, [song.id]);

  useEffect(() => {
    setIsFollowing(true);
    wheelDeltaRef.current = 0;
  }, [followRequestKey]);

  useEffect(() => {
    const canvas = canvasRef.current;
    // Chromium provides ResizeObserver. The guard avoids trying to validate
    // pixels in DOM-only test environments that do not implement Canvas.
    if (!canvas || typeof ResizeObserver === 'undefined') {
      return undefined;
    }

    let animationFrame = 0;
    const hitRegions = lineHitRegionsRef.current;
    const draw = (frameTimeMs: number) => {
      const {
        song: currentSong,
        playheadMs: currentPlayheadMs,
        activeIndex: currentActiveIndex,
        centerIndex: targetCenterIndex,
      } = drawStateRef.current;
      const bounds = canvas.getBoundingClientRect();
      const width = Math.max(1, bounds.width);
      const height = Math.max(1, bounds.height);
      // Preserve native text resolution on common 125–250% Windows scaling
      // without allowing an unusually large DPR to create a huge surface.
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2.5);
      const pixelWidth = Math.round(width * pixelRatio);
      const pixelHeight = Math.round(height * pixelRatio);
      if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
        canvas.width = pixelWidth;
        canvas.height = pixelHeight;
      }

      const context = canvas.getContext('2d');
      if (!context) {
        return;
      }
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      context.clearRect(0, 0, width, height);
      context.fontKerning = 'normal';
      context.textRendering = 'optimizeLegibility';

      const previousMotion = motionStateRef.current;
      const reducedMotion = window.matchMedia?.(
        '(prefers-reduced-motion: reduce)',
      ).matches;
      const songEntranceOpacity = reducedMotion
        ? 1
        : karaokeLyricEntranceOpacity(
            frameTimeMs - entranceStateRef.current.startedAtMs,
          );
      const isEuphoric =
        typeof document !== 'undefined' &&
        document.documentElement.classList.contains('is-euphoric');
      // Matches the 3.6-second sweep used by the rest of Euphoria without
      // reading an animated CSS property or asking React to render every
      // frame. Reduced-motion keeps the treatment and simply holds its hue.
      const euphoriaHue = reducedMotion
        ? 160
        : ((frameTimeMs % EUPHORIA_SWEEP_TIME_MS) / EUPHORIA_SWEEP_TIME_MS) *
          360;
      let animatedCenter = targetCenterIndex;
      if (previousMotion && !reducedMotion) {
        const elapsedMs = clamp(
          frameTimeMs - previousMotion.frameTimeMs,
          0,
          50,
        );
        const smoothing = 1 - Math.exp(-elapsedMs / LYRIC_MOTION_TIME_MS);
        animatedCenter =
          previousMotion.center +
          (targetCenterIndex - previousMotion.center) * smoothing;
        if (Math.abs(animatedCenter - targetCenterIndex) < 0.001) {
          animatedCenter = targetCenterIndex;
        }
      }
      motionStateRef.current = {
        center: animatedCenter,
        frameTimeMs,
      };

      const centerY = height * 0.5;
      const textScale = textSizeRef.current / 100;
      const rowSpacing = clamp(
        Math.max(height * 0.155, 38) * textScale,
        38,
        96,
      );
      // No band behind the lead line. The teal wash and its two hairlines
      // drew a visible box across the stage, which fought the artwork behind
      // it and framed a line that already stands out by being the only bright
      // one. Emphasis here is the lyric's own colour and glow, not a plate.

      const first = Math.max(0, Math.floor(animatedCenter) - 3);
      const last = Math.min(
        currentSong.lines.length - 1,
        Math.ceil(animatedCenter) + 3,
      );
      let hitRegionCount = 0;
      for (let index = first; index <= last; index += 1) {
        const line = currentSong.lines[index];
        const isSection = line.kind === 'section';
        const isCaptureLine = line.id === captureLineId;
        const isCapturePending =
          isCaptureLine && captureLineState === 'pending';
        const isCaptureStarted =
          isCaptureLine && captureLineState === 'started';
        const isCaptureComplete =
          isCaptureLine && captureLineState === 'complete';
        const offset = index - animatedCenter;
        const motion = lyricLineMotion(offset);
        const y = centerY + offset * rowSpacing;
        const viewportFade = clamp(
          1 - Math.abs(y - centerY) / Math.max(1, height * 0.53),
          0,
          1,
        );
        // Interpolate typography from the animated position. Switching the
        // focused font immediately would make the incoming line pop before it
        // actually reaches the center.
        const focusAmount = clamp(1 - Math.abs(offset), 0, 1);
        const isTimingActive =
          index === currentActiveIndex &&
          !isSection &&
          !isCapturePending &&
          !isCaptureStarted;
        const restingFontSize = isSection
          ? clamp(width * 0.011, 10.5, 14)
          : clamp(width * 0.0145, 12, 17);
        const focusedFontSize = isSection
          ? clamp(width * 0.017, 15, 23)
          : clamp(width * 0.032, 22, 38);
        let fontSize =
          restingFontSize + (focusedFontSize - restingFontSize) * focusAmount;
        fontSize *= motion.scale * textScale;
        const fontWeight = Math.round(
          (isSection ? 760 : 720) + (isSection ? 80 : 180) * focusAmount,
        );
        context.font = `${fontWeight} ${fontSize}px ${LYRIC_FONT_FAMILY}`;

        const visualWords = groupKaraokeTokensIntoWords(line.tokens);
        let textWidth = 0;
        for (
          let wordIndex = 0;
          wordIndex < visualWords.length;
          wordIndex += 1
        ) {
          const word = visualWords[wordIndex];
          textWidth += context.measureText(
            karaokeVisualWordDisplayText(
              word,
              wordIndex,
              visualWords[wordIndex - 1],
            ),
          ).width;
        }
        const availableWidth = Math.max(1, width - 40);
        if (textWidth > availableWidth) {
          // Fit the complete phrase even in the shorter Maker preview. A hard
          // font-size floor allowed exceptionally long lines to be clipped in
          // the middle of their first/last word.
          fontSize = Math.max(1, fontSize * (availableWidth / textWidth));
          context.font = `${fontWeight} ${fontSize}px ${LYRIC_FONT_FAMILY}`;
          textWidth = 0;
          for (
            let wordIndex = 0;
            wordIndex < visualWords.length;
            wordIndex += 1
          ) {
            const word = visualWords[wordIndex];
            textWidth += context.measureText(
              karaokeVisualWordDisplayText(
                word,
                wordIndex,
                visualWords[wordIndex - 1],
              ),
            ).width;
          }
        }

        const alpha = motion.opacity * viewportFade * songEntranceOpacity;
        const textLeft = (width - textWidth) * 0.5;
        const hasEuphoriaText =
          isEuphoric &&
          focusAmount > 0.08 &&
          (!isCaptureLine || isCaptureComplete);
        const euphoriaFill = hasEuphoriaText
          ? context.createLinearGradient(
              textLeft,
              y,
              textLeft + Math.max(1, textWidth),
              y,
            )
          : undefined;
        if (euphoriaFill) {
          euphoriaFill.addColorStop(
            0,
            `hsl(${(euphoriaHue + 318) % 360}, 96%, 70%)`,
          );
          euphoriaFill.addColorStop(
            0.48,
            `hsl(${(euphoriaHue + 18) % 360}, 98%, 72%)`,
          );
          euphoriaFill.addColorStop(
            1,
            `hsl(${(euphoriaHue + 92) % 360}, 96%, 69%)`,
          );
        }
        context.save();
        context.globalAlpha = alpha;
        context.textAlign = 'left';
        context.textBaseline = 'middle';
        let shadowColor = `rgba(34, 224, 214, ${0.2 * focusAmount})`;
        if (hasEuphoriaText) {
          shadowColor = `hsla(${euphoriaHue}, 96%, 64%, ${0.32 * focusAmount})`;
        } else if (isCapturePending) {
          shadowColor = 'rgba(0, 0, 0, 0)';
        } else if (isCaptureStarted) {
          shadowColor = `rgba(34, 224, 214, ${0.3 * focusAmount})`;
        } else if (isCaptureComplete) {
          shadowColor = `rgba(112, 255, 246, ${0.42 * focusAmount})`;
        }
        context.shadowColor = shadowColor;
        context.shadowBlur = hasEuphoriaText
          ? 18 * focusAmount
          : 20 * focusAmount;
        let wordX = textLeft;
        for (
          let wordIndex = 0;
          wordIndex < visualWords.length;
          wordIndex += 1
        ) {
          const word = visualWords[wordIndex];
          const displayText = karaokeVisualWordDisplayText(
            word,
            wordIndex,
            visualWords[wordIndex - 1],
          );
          const wordWidth = context.measureText(displayText).width;
          let red = isSection ? 96 : Math.round(225 + 17 * focusAmount);
          let green = isSection ? 232 : Math.round(231 + 15 * focusAmount);
          let blue = isSection ? 219 : Math.round(244 + 11 * focusAmount);
          if (isCaptureStarted) {
            red = 70;
            green = 220;
            blue = 214;
          } else if (isCaptureComplete && !isEuphoric) {
            red = 132;
            green = 255;
            blue = 247;
          }
          const textAlpha = 0.42 + 0.56 * focusAmount;

          if (hasEuphoriaText) {
            // A dark outside key keeps every glyph readable; the thinner
            // travelling colour on top is the actual Euphoria edge. Only the
            // focused line receives it, so upcoming lyrics stay quiet.
            context.save();
            context.lineJoin = 'round';
            context.shadowBlur = 0;
            context.lineWidth = 3.2 * focusAmount;
            context.strokeStyle = `rgba(2, 8, 15, ${0.72 * focusAmount})`;
            context.strokeText(displayText, wordX, y);
            context.lineWidth = Math.max(0.7, 1.15 * focusAmount);
            context.strokeStyle = `hsla(${
              (euphoriaHue + wordIndex * 11) % 360
            }, 96%, 70%, ${0.72 * focusAmount})`;
            context.shadowColor = `hsla(${euphoriaHue}, 98%, 64%, ${
              0.4 * focusAmount
            })`;
            context.shadowBlur = 10 * focusAmount;
            context.strokeText(displayText, wordX, y);
            context.restore();
          } else if (focusAmount > 0.55 && !isSection && !isCapturePending) {
            // A compact dark key gives the focused phrase the crisp television
            // karaoke silhouette that glow alone cannot provide. It appears
            // only near the centre, so surrounding lyrics stay soft and quiet.
            context.save();
            context.lineJoin = 'round';
            context.shadowBlur = 0;
            context.lineWidth = 2.4 * focusAmount;
            context.strokeStyle = `rgba(2, 8, 15, ${0.64 * focusAmount})`;
            context.strokeText(displayText, wordX, y);
            context.restore();
          }

          context.fillStyle = `rgba(${red}, ${green}, ${blue}, ${textAlpha})`;
          context.fillText(displayText, wordX, y);

          if (isTimingActive) {
            const progressWidth = karaokeVisualWordProgressWidth(
              context,
              word,
              displayText,
              currentPlayheadMs,
            );
            if (progressWidth > 0) {
              context.save();
              context.beginPath();
              context.rect(
                wordX,
                y - fontSize * 0.72,
                Math.min(wordWidth, progressWidth),
                fontSize * 1.44,
              );
              context.clip();
              context.fillStyle =
                euphoriaFill ??
                (isCaptureComplete
                  ? 'rgb(208, 255, 251)'
                  : 'rgb(103, 241, 232)');
              if (euphoriaFill) {
                context.shadowColor = `hsla(${euphoriaHue}, 98%, 65%, 0.5)`;
                context.shadowBlur = 13 * focusAmount;
              }
              context.fillText(displayText, wordX, y);
              context.restore();
            }
          }
          wordX += wordWidth;
        }
        context.restore();

        let hitRegion = hitRegions[hitRegionCount];
        if (!hitRegion) {
          hitRegion = {
            index,
            left: 0,
            right: 0,
            top: 0,
            bottom: 0,
          };
          hitRegions[hitRegionCount] = hitRegion;
        }
        hitRegion.index = index;
        // Only the painted lyric is interactive. Previously these regions had
        // vertical bounds alone, making the empty margins across the whole
        // canvas seek to whichever line happened to share that row.
        hitRegion.left = textLeft;
        hitRegion.right = textLeft + textWidth;
        hitRegion.top = y - fontSize * 0.68;
        hitRegion.bottom = y + fontSize * 0.68;
        hitRegionCount += 1;
      }
      hitRegions.length = hitRegionCount;

      // *** The count-in ****************************************************
      //
      // Three, two, one, sing. Only where there is a wait long enough to lose
      // your place in — three seconds is about where a gap stops being a
      // breath and starts being a silence — and never while a line is being
      // sung, where it would be a second thing moving over the words.
      //
      // Drawn under the lyric lane rather than in it: the line about to be
      // sung is already at the centre, and the count is a thing to glance at,
      // not to read.
      const {
        nextStartMs,
        waitStartMs: silenceFromMs,
        singLabel,
      } = drawStateRef.current;
      if (
        nextStartMs !== undefined &&
        silenceFromMs !== undefined &&
        nextStartMs - silenceFromMs >= COUNTDOWN_MIN_WAIT_MS
      ) {
        const remainingMs = nextStartMs - currentPlayheadMs;
        if (remainingMs > -COUNTDOWN_SING_MS && remainingMs <= COUNTDOWN_MS) {
          const isSing = remainingMs <= 0;
          // Three at most. The window is a fraction over three seconds so the
          // first beat lands with its swell rather than appearing mid-pulse,
          // and without the clamp that fraction reads as a "4" nobody counted.
          const beat = clamp(Math.ceil(remainingMs / 1000), 1, 3);
          const label = isSing ? singLabel : String(beat);
          // Each beat swells as it arrives and settles: the fraction of the
          // current second that has passed drives both, so the pulse is on
          // the beat rather than on the frame.
          const beatProgress = isSing
            ? clamp(-remainingMs / COUNTDOWN_SING_MS, 0, 1)
            : 1 - ((remainingMs % 1000) + 1000) / 1000;
          const swell = 1 + 0.18 * Math.max(0, 1 - beatProgress * 3);
          const fade = isSing ? 1 - beatProgress : 1;
          const size = clamp(width * 0.028, 20, 34) * swell;
          context.save();
          context.font = `800 ${size}px ${LYRIC_FONT_FAMILY}`;
          context.textAlign = 'center';
          context.textBaseline = 'middle';
          context.shadowColor = 'rgba(0, 229, 207, 0.55)';
          context.shadowBlur = 18;
          context.fillStyle = `rgba(126, 245, 232, ${0.9 * fade})`;
          context.fillText(label, width / 2, height - size * 1.1);
          context.restore();
        }
      }
    };

    const animate = (frameTimeMs: number) => {
      draw(frameTimeMs);
      animationFrame = requestAnimationFrame(animate);
    };
    const observer = new ResizeObserver(() => draw(performance.now()));
    observer.observe(canvas);
    animationFrame = requestAnimationFrame(animate);
    return () => {
      cancelAnimationFrame(animationFrame);
      observer.disconnect();
      hitRegions.length = 0;
    };
  }, [captureLineId, captureLineState, song.lines.length]);

  const browseLyrics = (direction: -1 | 1) => {
    setManualCenterIndex((current) =>
      clamp(
        (isFollowing ? playbackCenterIndex : current) + direction,
        0,
        Math.max(0, song.lines.length - 1),
      ),
    );
    setIsFollowing(false);
  };

  // The wheel listener is attached once and must not be torn down on every
  // render, so it reaches the current browse through a ref rather than closing
  // over the render that created it.
  const browseLyricsRef = useRef(browseLyrics);
  browseLyricsRef.current = browseLyrics;

  /**
   * Wheel browsing, attached by hand because React will not do it.
   *
   * React registers `onWheel` at the root as a passive listener, so the
   * `preventDefault` this needs was silently refused on every tick — the
   * console filled with "Unable to preventDefault inside passive event
   * listener invocation" and the page kept scrolling underneath the lyrics
   * anyway. A listener this component owns can say `passive: false` and mean
   * it.
   */
  useEffect(() => {
    if (!shell) {
      return undefined;
    }
    const onWheel = (event: WheelEvent) => {
      if (!event.deltaY) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      wheelDeltaRef.current += event.deltaY;
      if (Math.abs(wheelDeltaRef.current) < WHEEL_STEP_THRESHOLD) {
        return;
      }
      browseLyricsRef.current(wheelDeltaRef.current > 0 ? 1 : -1);
      wheelDeltaRef.current = 0;
    };
    shell.addEventListener('wheel', onWheel, { passive: false });
    return () => shell.removeEventListener('wheel', onWheel);
  }, [shell]);

  const resumeFollowing = () => {
    wheelDeltaRef.current = 0;
    setManualCenterIndex(playbackCenterIndex);
    setIsFollowing(true);
  };

  const selectLyricLine = (index: number) => {
    const line = song.lines[index];
    if (!line) {
      return;
    }
    wheelDeltaRef.current = 0;
    setManualCenterIndex(index);
    setIsFollowing(true);
    onSeek(line.startMs ?? 0);
  };

  const onCanvasPointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - bounds.left;
    const y = event.clientY - bounds.top;
    event.currentTarget.style.cursor = lineHitRegionsRef.current.some(
      (region) => lyricHitRegionContains(region, x, y),
    )
      ? 'pointer'
      : 'default';
  };

  const onCanvasPointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - bounds.left;
    const y = event.clientY - bounds.top;
    const hitRegion = lineHitRegionsRef.current.find((region) =>
      lyricHitRegionContains(region, x, y),
    );
    if (hitRegion) {
      selectLyricLine(hitRegion.index);
    }
  };

  const onCanvasKeyDown = (event: ReactKeyboardEvent<HTMLCanvasElement>) => {
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault();
      browseLyrics(event.key === 'ArrowUp' ? -1 : 1);
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      selectLyricLine(centerIndex);
    }
  };

  if (!song.lines.length) {
    return (
      <div className="karaoke-lyrics-shell">
        <div className="karaoke-lyrics karaoke-lyrics--empty">
          <p>{t('karaoke.lyrics.none')}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`karaoke-lyrics-shell${isFollowing ? '' : ' is-browsing'}`}
      ref={setShell}
    >
      <canvas
        ref={canvasRef}
        className="karaoke-lyrics__canvas"
        role="button"
        aria-current="true"
        aria-label={t('karaoke.lyrics.line', { number: centerIndex + 1 })}
        tabIndex={0}
        onPointerMove={onCanvasPointerMove}
        onPointerLeave={(event) => {
          event.currentTarget.style.cursor = 'default';
        }}
        onPointerDown={onCanvasPointerDown}
        onKeyDown={onCanvasKeyDown}
      />
      {showFollowButton && !isFollowing && (
        <button
          type="button"
          className="button small subtle karaoke-lyrics__follow"
          onClick={resumeFollowing}
        >
          <MenuIcon name="restart" className="karaoke-button__icon" />
          <span>{t('karaoke.lyrics.follow')}</span>
        </button>
      )}
    </div>
  );
};

export default KaraokeLyrics;
