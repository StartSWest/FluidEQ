/* FluidEQ Karaoke Maker canvas layout helpers. GPL-3.0-or-later. */

export const KARAOKE_MAKER_LYRIC_LANE_COUNT = 3;

export interface IKaraokeMakerLyricLabel {
  id: string;
  naturalLeft: number;
  width: number;
  preferredLane: number;
  priority?: number;
}

export interface IKaraokeMakerPlacedLyricLabel extends IKaraokeMakerLyricLabel {
  lane: number;
  left: number;
}

export interface IKaraokeMakerSectionMarker {
  id: string;
  text: string;
  startMs: number;
}

export interface IKaraokeMakerSectionGroup extends IKaraokeMakerSectionMarker {
  endMs: number;
}

/**
 * Turn section markers into non-overlapping timeline groups. The marker owns
 * everything up to the next marker, so the editor can render structure in one
 * dedicated row instead of spending lyric lanes on labels such as [CHORUS].
 */
export const karaokeMakerSectionGroups = (
  markers: readonly IKaraokeMakerSectionMarker[],
  durationMs: number,
): IKaraokeMakerSectionGroup[] => {
  const ordered = [...markers]
    .filter((marker) => Number.isFinite(marker.startMs))
    .sort(
      (left, right) =>
        left.startMs - right.startMs || left.id.localeCompare(right.id),
    );
  return ordered.map((marker, index) => ({
    ...marker,
    endMs: Math.max(
      marker.startMs,
      ordered[index + 1]?.startMs ?? Math.max(marker.startMs, durationMs),
    ),
  }));
};

/**
 * Preserve provider-authored syllable boundaries while exposing the readable
 * words they form. A token with `startsWord: false` continues the preceding
 * token, matching the grouping used by the tuning guide.
 */
export const groupKaraokeMakerWordSyllables = <
  T extends { startsWord: boolean },
>(
  tokens: readonly T[],
): T[][] => {
  const groups: T[][] = [];
  tokens.forEach((token) => {
    if (!groups.length || token.startsWord !== false) {
      groups.push([token]);
      return;
    }
    groups[groups.length - 1].push(token);
  });
  return groups;
};

/**
 * Keep lyric labels on their exact timeline X coordinate. At wide zoom levels
 * there is not enough room for every word; culling lower-priority labels is
 * less misleading than pushing them away from the playhead that owns them.
 */
export const layoutKaraokeMakerAnchoredLyricLabels = (
  labels: readonly IKaraokeMakerLyricLabel[],
  plotLeft: number,
  plotRight: number,
  laneCount = KARAOKE_MAKER_LYRIC_LANE_COUNT,
  gap = 12,
  strictPreferredLane = false,
): IKaraokeMakerPlacedLyricLabel[] => {
  const safeLaneCount = Math.max(1, Math.round(laneCount));
  const occupied: Array<Array<{ left: number; right: number }>> = Array.from(
    { length: safeLaneCount },
    () => [],
  );
  // Playback focus must never decide which labels survive a dense zoom. That
  // made a different word evict its neighbour every time the playhead moved.
  // Time and id are stable, so the same viewport always produces the same set.
  const stableOrder = [...labels].sort(
    (left, right) =>
      left.naturalLeft - right.naturalLeft ||
      left.preferredLane - right.preferredLane ||
      left.id.localeCompare(right.id),
  );
  const placed: IKaraokeMakerPlacedLyricLabel[] = [];
  stableOrder.forEach((label) => {
    const left = label.naturalLeft;
    const right = left + label.width;
    if (right < plotLeft || left > plotRight) {
      return;
    }
    const preferred =
      ((label.preferredLane % safeLaneCount) + safeLaneCount) % safeLaneCount;
    const lanes = strictPreferredLane
      ? [preferred]
      : [
          preferred,
          ...new Array(safeLaneCount)
            .fill(undefined)
            .map((_value, lane) => lane)
            .filter((lane) => lane !== preferred),
        ];
    const lane = lanes.find((candidate) =>
      occupied[candidate].every(
        (interval) =>
          right + gap <= interval.left || left >= interval.right + gap,
      ),
    );
    if (lane === undefined) {
      return;
    }
    occupied[lane].push({ left, right });
    placed.push({ ...label, lane, left });
  });
  return placed.sort(
    (left, right) =>
      left.naturalLeft - right.naturalLeft || left.lane - right.lane,
  );
};

export interface IKaraokeMakerTimedLabelForFit {
  id: string;
  startMs: number;
  endMs: number;
  width: number;
  preferredLane: number;
  priority?: number;
}

export interface IKaraokeMakerFittedViewport {
  startMs: number;
  durationMs: number;
}

/**
 * Find the widest useful viewport around a focus time where every visible
 * lyric label can retain its exact timeline X coordinate. This powers the
 * navigator's double-click reset. It deliberately zooms in instead of
 * horizontally shuffling labels when a provider supplies very dense timing.
 */
export const karaokeMakerFittedLyricViewport = (
  labels: readonly IKaraokeMakerTimedLabelForFit[],
  focusMs: number,
  plotWidth: number,
  songDurationMs: number,
  minimumViewportMs: number,
  laneCount = KARAOKE_MAKER_LYRIC_LANE_COUNT,
  gap = 12,
  strictPreferredLane = false,
): IKaraokeMakerFittedViewport => {
  const safeSongDurationMs = Math.max(1, songDurationMs);
  const safeMinimumMs = Math.min(
    safeSongDurationMs,
    Math.max(1, minimumViewportMs),
  );
  const safePlotWidth = Math.max(1, plotWidth);
  const safeFocusMs = Math.max(0, Math.min(safeSongDurationMs, focusMs));
  const viewportAt = (durationMs: number): IKaraokeMakerFittedViewport => {
    const safeDurationMs = Math.max(
      safeMinimumMs,
      Math.min(safeSongDurationMs, durationMs),
    );
    return {
      startMs: Math.max(
        0,
        Math.min(
          safeSongDurationMs - safeDurationMs,
          safeFocusMs - safeDurationMs / 2,
        ),
      ),
      durationMs: safeDurationMs,
    };
  };
  const fits = (durationMs: number): boolean => {
    const viewport = viewportAt(durationMs);
    const visible = labels.filter(
      (label) =>
        label.endMs >= viewport.startMs &&
        label.startMs <= viewport.startMs + viewport.durationMs,
    );
    const packed = layoutKaraokeMakerAnchoredLyricLabels(
      visible.map((label) => ({
        id: label.id,
        naturalLeft:
          (((label.startMs + label.endMs) / 2 - viewport.startMs) /
            viewport.durationMs) *
            safePlotWidth -
          label.width / 2,
        width: label.width,
        preferredLane: label.preferredLane,
        priority: label.priority,
      })),
      0,
      safePlotWidth,
      laneCount,
      gap,
      strictPreferredLane,
    );
    return packed.length === visible.length;
  };

  if (fits(safeSongDurationMs)) {
    return viewportAt(safeSongDurationMs);
  }

  // Scan from wide to narrow first. Provider overlaps make the fit function
  // not perfectly monotonic as labels enter and leave the viewport, so a
  // coarse logarithmic scan is safer than assuming one binary-search edge.
  const sampleCount = 72;
  let fittedDurationMs = safeMinimumMs;
  let failedDurationAboveMs = safeSongDurationMs;
  let found = false;
  for (let index = 1; index <= sampleCount; index += 1) {
    const progress = index / sampleCount;
    const candidate =
      safeSongDurationMs * (safeMinimumMs / safeSongDurationMs) ** progress;
    if (fits(candidate)) {
      fittedDurationMs = candidate;
      found = true;
      break;
    }
    failedDurationAboveMs = candidate;
  }
  if (!found) {
    return viewportAt(safeMinimumMs);
  }

  // Refine the first safe transition to avoid a visible jump to an overly
  // narrow preset while keeping the result deterministic at every DPI.
  for (let iteration = 0; iteration < 18; iteration += 1) {
    const candidate = (fittedDurationMs + failedDurationAboveMs) / 2;
    if (fits(candidate)) {
      fittedDurationMs = candidate;
    } else {
      failedDurationAboveMs = candidate;
    }
  }
  return viewportAt(fittedDurationMs);
};

export interface IKaraokeMakerTimedLyricToken {
  id: string;
  lineIndex: number;
  lineStartMs: number;
  lineEndMs: number;
  startMs: number;
  endMs: number;
}

export interface IKaraokeMakerLyricFocus {
  lineIndex: number;
  tokenId?: string;
}

/**
 * Resolve imported timing overlaps to one playback focus. Providers sometimes
 * overlap whole lyric lines (or even adjacent words); treating every matching
 * interval as active makes several words glow at once. The most recently
 * started line wins, then the most recently started word within that line.
 */
export const karaokeMakerLyricFocus = (
  tokens: readonly IKaraokeMakerTimedLyricToken[],
  playheadMs: number,
): IKaraokeMakerLyricFocus | undefined => {
  const activeLines = new Map<
    number,
    { lineIndex: number; startMs: number; endMs: number }
  >();
  tokens.forEach((token) => {
    if (
      token.lineEndMs <= token.lineStartMs ||
      playheadMs < token.lineStartMs ||
      playheadMs >= token.lineEndMs
    ) {
      return;
    }
    const current = activeLines.get(token.lineIndex);
    if (!current || token.lineStartMs > current.startMs) {
      activeLines.set(token.lineIndex, {
        lineIndex: token.lineIndex,
        startMs: token.lineStartMs,
        endMs: token.lineEndMs,
      });
    }
  });
  const activeLine = [...activeLines.values()].sort(
    (left, right) =>
      right.startMs - left.startMs ||
      left.endMs - right.endMs ||
      right.lineIndex - left.lineIndex,
  )[0];
  if (!activeLine) {
    return undefined;
  }
  const activeToken = tokens
    .filter(
      (token) =>
        token.lineIndex === activeLine.lineIndex &&
        token.endMs > token.startMs &&
        playheadMs >= token.startMs &&
        playheadMs < token.endMs,
    )
    .sort(
      (left, right) =>
        right.startMs - left.startMs ||
        left.endMs - right.endMs ||
        left.id.localeCompare(right.id),
    )[0];
  return { lineIndex: activeLine.lineIndex, tokenId: activeToken?.id };
};

export const karaokeMakerWordProgress = (
  startMs: number,
  endMs: number,
  playheadMs: number,
): number => {
  if (playheadMs <= startMs) {
    return 0;
  }
  if (playheadMs >= endMs || endMs <= startMs) {
    return 1;
  }
  return Math.max(0, Math.min(1, (playheadMs - startMs) / (endMs - startMs)));
};

export const karaokeMakerNoteProgress = karaokeMakerWordProgress;

export const karaokeMakerPannedViewportStart = (
  initialStartMs: number,
  dragDeltaPx: number,
  plotWidth: number,
  viewDurationMs: number,
  maximumStartMs: number,
): number =>
  Math.max(
    0,
    Math.min(
      Math.max(0, maximumStartMs),
      initialStartMs -
        (dragDeltaPx / Math.max(1, plotWidth)) * Math.max(0, viewDurationMs),
    ),
  );

/** Use a half-open interval so adjacent melody notes never light together. */
export const karaokeMakerNoteIsActive = (
  startMs: number,
  endMs: number,
  playheadMs: number,
): boolean => endMs > startMs && playheadMs >= startMs && playheadMs < endMs;
