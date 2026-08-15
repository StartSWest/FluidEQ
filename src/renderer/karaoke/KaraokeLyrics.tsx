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
  WheelEvent as ReactWheelEvent,
  useEffect,
  useRef,
  useState,
} from 'react';
import { findActiveKaraokeLine } from '../../common/karaoke/clock';
import { IKaraokeSong, IKaraokeToken } from '../../common/karaoke/types';
import MenuIcon from '../icons/MenuIcon';
import { useTranslation } from '../utils/I18nContext';

const WHEEL_STEP_THRESHOLD = 24;
const LYRIC_MOTION_TIME_MS = 105;
const SONG_LYRIC_ENTRANCE_TIME_MS = 560;
const EUPHORIA_SWEEP_TIME_MS = 3_600;
const LYRIC_FONT_FAMILY = 'Inter, system-ui, -apple-system, sans-serif';
const LYRIC_TEXT_SIZE_KEY = 'fluideq-karaoke-lyric-text-size';
export const DEFAULT_LYRIC_TEXT_SIZE = 100;
export const MIN_LYRIC_TEXT_SIZE = 75;
export const MAX_LYRIC_TEXT_SIZE = 300;

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value));

/** A soft ease-out used only when a different song enters the player. */
export const karaokeLyricEntranceOpacity = (elapsedMs: number): number => {
  const progress = clamp(elapsedMs / SONG_LYRIC_ENTRANCE_TIME_MS, 0, 1);
  return 1 - (1 - progress) ** 3;
};

export const readLyricTextSize = (): number => {
  try {
    const stored = Number(window.localStorage.getItem(LYRIC_TEXT_SIZE_KEY));
    return Number.isFinite(stored) && stored > 0
      ? clamp(stored, MIN_LYRIC_TEXT_SIZE, MAX_LYRIC_TEXT_SIZE)
      : DEFAULT_LYRIC_TEXT_SIZE;
  } catch {
    return DEFAULT_LYRIC_TEXT_SIZE;
  }
};

export const writeLyricTextSize = (textSize: number): void => {
  try {
    window.localStorage.setItem(LYRIC_TEXT_SIZE_KEY, String(textSize));
  } catch {
    // The live setting still works when storage is unavailable.
  }
};

const timingProgress = (
  startMs: number | undefined,
  endMs: number | undefined,
  playheadMs: number,
): number => {
  if (startMs === undefined) {
    return 0;
  }
  if (playheadMs <= startMs) {
    return 0;
  }
  if (endMs === undefined || endMs <= startMs) {
    return 1;
  }
  return clamp((playheadMs - startMs) / (endMs - startMs), 0, 1);
};

/** Preserve provider word boundaries after Maker normalization trims tokens. */
export const karaokeTokenDisplayText = (
  token: IKaraokeToken,
  tokenIndex: number,
  previousToken?: IKaraokeToken,
): string =>
  tokenIndex > 0 &&
  token.startsWord === true &&
  !/^\s/u.test(token.text) &&
  !/\s$/u.test(previousToken?.text ?? '')
    ? ` ${token.text}`
    : token.text;

export interface IKaraokeVisualWord {
  /** Provider syllables that must be painted as one indivisible word. */
  tokens: IKaraokeToken[];
  text: string;
}

const karaokeVisualWordCache = new WeakMap<
  readonly IKaraokeToken[],
  IKaraokeVisualWord[]
>();

/**
 * Providers such as UltraStar time syllables independently. Keep those
 * timings, but combine continuation tokens before measuring or painting so a
 * glyph run can never acquire a seam in the middle of a word.
 */
export const groupKaraokeTokensIntoWords = (
  tokens: readonly IKaraokeToken[],
): IKaraokeVisualWord[] => {
  const cached = karaokeVisualWordCache.get(tokens);
  if (cached) {
    return cached;
  }
  const words: IKaraokeVisualWord[] = [];
  tokens.forEach((token) => {
    const current = words[words.length - 1];
    if (!current || token.startsWord !== false) {
      words.push({ tokens: [token], text: token.text });
      return;
    }
    current.tokens.push(token);
    current.text += token.text;
  });
  karaokeVisualWordCache.set(tokens, words);
  return words;
};

const karaokeVisualWordDisplayText = (
  word: IKaraokeVisualWord,
  wordIndex: number,
  previousWord?: IKaraokeVisualWord,
): string =>
  wordIndex > 0 &&
  word.tokens[0]?.startsWord === true &&
  !/^\s/u.test(word.text) &&
  !/\s$/u.test(previousWord?.text ?? '')
    ? ` ${word.text}`
    : word.text;

const karaokeVisualWordProgressWidth = (
  context: CanvasRenderingContext2D,
  word: IKaraokeVisualWord,
  displayText: string,
  playheadMs: number,
): number => {
  const leadingText = displayText.slice(
    0,
    displayText.length - word.text.length,
  );
  let precedingText = leadingText;
  let paintedWidth = 0;

  word.tokens.forEach((token, tokenIndex) => {
    if (!token.text) {
      return;
    }
    const segmentStart = context.measureText(precedingText).width;
    precedingText += token.text;
    const segmentEnd = context.measureText(precedingText).width;
    let effectiveEndMs = token.endMs;
    // Empty following tokens are sustained melody notes for this same
    // syllable. Include them in its sweep instead of completing the word at
    // the first note boundary.
    for (
      let nextIndex = tokenIndex + 1;
      nextIndex < word.tokens.length && !word.tokens[nextIndex].text;
      nextIndex += 1
    ) {
      const continuation = word.tokens[nextIndex];
      effectiveEndMs = Math.max(
        effectiveEndMs ?? continuation.endMs ?? 0,
        continuation.endMs ?? continuation.startMs ?? 0,
      );
    }
    const progress = timingProgress(token.startMs, effectiveEndMs, playheadMs);
    if (progress > 0) {
      paintedWidth = Math.max(
        paintedWidth,
        segmentStart + (segmentEnd - segmentStart) * progress,
      );
    }
  });

  return paintedWidth;
};

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

interface ILyricDrawState {
  song: IKaraokeSong;
  playheadMs: number;
  activeIndex: number;
  centerIndex: number;
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
    const directionOpacity = offset >= 0 ? 0.76 : 0.42;
    const directionScale = offset >= 0 ? 0.94 : 0.9;
    return {
      opacity: 1 + (directionOpacity - 1) * distance,
      scale: 1 + (directionScale - 1) * distance,
    };
  }
  const isUpcoming = offset > 0;
  const nearOpacity = isUpcoming ? 0.76 : 0.42;
  const farOpacity = isUpcoming ? 0.3 : 0.16;
  const nearScale = isUpcoming ? 0.94 : 0.9;
  const farScale = 0.82;
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
  const drawStateRef = useRef<ILyricDrawState>({
    song,
    playheadMs,
    activeIndex,
    centerIndex,
  });
  drawStateRef.current = { song, playheadMs, activeIndex, centerIndex };

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
      const focusHeight = clamp(
        Math.max(height * 0.22, 44) * textScale,
        44,
        124,
      );
      const focusLeft = width * 0.07;
      const focusRight = width * 0.93;
      const focusGradient = context.createRadialGradient(
        width * 0.5,
        centerY,
        0,
        width * 0.5,
        centerY,
        Math.max(1, width * 0.43),
      );
      focusGradient.addColorStop(0, 'rgba(34, 224, 214, 0.065)');
      focusGradient.addColorStop(1, 'rgba(34, 224, 214, 0)');
      context.fillStyle = focusGradient;
      context.fillRect(
        focusLeft,
        centerY - focusHeight * 0.5,
        focusRight - focusLeft,
        focusHeight,
      );
      context.strokeStyle = 'rgba(34, 224, 214, 0.055)';
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(focusLeft, centerY - focusHeight * 0.5);
      context.lineTo(focusRight, centerY - focusHeight * 0.5);
      context.moveTo(focusLeft, centerY + focusHeight * 0.5);
      context.lineTo(focusRight, centerY + focusHeight * 0.5);
      context.stroke();

      const first = Math.max(0, Math.floor(animatedCenter) - 4);
      const last = Math.min(
        currentSong.lines.length - 1,
        Math.ceil(animatedCenter) + 4,
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
          ? clamp(width * 0.012, 11, 15)
          : clamp(width * 0.0155, 13, 18.5);
        const focusedFontSize = isSection
          ? clamp(width * 0.017, 15, 22)
          : clamp(width * 0.028, 20, 32);
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
        let shadowColor = `rgba(34, 224, 214, ${0.13 * focusAmount})`;
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
          : 28 * focusAmount;
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

  const onWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    if (!event.deltaY) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    wheelDeltaRef.current += event.deltaY;
    if (Math.abs(wheelDeltaRef.current) < WHEEL_STEP_THRESHOLD) {
      return;
    }
    browseLyrics(wheelDeltaRef.current > 0 ? 1 : -1);
    wheelDeltaRef.current = 0;
  };

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
      onWheel={onWheel}
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
