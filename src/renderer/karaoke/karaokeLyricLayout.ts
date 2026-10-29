/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.
*/

import { IKaraokeToken } from '../../common/karaoke/types';
import {
  clamp,
  groupKaraokeTokensIntoWords,
  karaokeVisualWordDisplayText,
  LYRIC_FONT_FAMILY,
} from './karaokeLyricText';

interface ILyricPiece {
  wordIndex: number;
  /** Complete provider word, including its original leading space. */
  displayText: string;
  text: string;
  start: number;
}

export interface IKaraokeLyricFragment extends ILyricPiece {
  x: number;
  width: number;
  /** The sweep remains relative to the unsplit provider word. */
  prefixWidth: number;
}

export interface IKaraokeLyricRow {
  fragments: IKaraokeLyricFragment[];
  width: number;
}

export interface IKaraokeLyricLayout {
  rows: IKaraokeLyricRow[];
  fontSize: number;
  fontWeight: number;
  lineHeight: number;
  height: number;
}

type TMeasureContext = Pick<CanvasRenderingContext2D, 'font' | 'measureText'>;
const wordSegmenter = new Intl.Segmenter(undefined, { granularity: 'word' });
const graphemeSegmenter = new Intl.Segmenter(undefined, {
  granularity: 'grapheme',
});
const piecesByTokens = new WeakMap<readonly IKaraokeToken[], ILyricPiece[]>();

const lyricPieces = (tokens: readonly IKaraokeToken[]): ILyricPiece[] => {
  const cached = piecesByTokens.get(tokens);
  if (cached) {
    return cached;
  }
  const pieces: ILyricPiece[] = [];
  const words = groupKaraokeTokensIntoWords(tokens);
  words.forEach((word, wordIndex) => {
    const displayText = karaokeVisualWordDisplayText(
      word,
      wordIndex,
      words[wordIndex - 1],
    );
    Array.from(wordSegmenter.segment(displayText)).forEach((segment) => {
      pieces.push({
        wordIndex,
        displayText,
        text: segment.segment,
        start: segment.index,
      });
    });
  });
  piecesByTokens.set(tokens, pieces);
  return pieces;
};

/** Only an oversized word is split, and never inside a grapheme cluster. */
const splitOversizedPiece = (
  piece: ILyricPiece,
  availableWidth: number,
  measure: (text: string) => number,
): ILyricPiece[] => {
  if (measure(piece.text) <= availableWidth) {
    return [piece];
  }
  const chunks: ILyricPiece[] = [];
  let text = '';
  let { start } = piece;
  Array.from(graphemeSegmenter.segment(piece.text)).forEach((grapheme) => {
    if (text && measure(text + grapheme.segment) > availableWidth) {
      chunks.push({ ...piece, text, start });
      text = '';
      start = piece.start + grapheme.index;
    }
    text += grapheme.segment;
  });
  if (text) {
    chunks.push({ ...piece, text, start });
  }
  return chunks;
};

/**
 * Open stage wraps before reducing type. Provider words retain their timing
 * and syllable grouping; wrapping an LRC sentence must not restart its sweep
 * at the beginning of each visual row. No letter spacing is introduced for
 * any script. The two weights mirror the app's bold/display scale, with the
 * display cut allowed only above 20px.
 */
export const fitKaraokeLyricLayout = (
  context: TMeasureContext,
  tokens: readonly IKaraokeToken[],
  preferredSize: number,
  availableWidth: number,
  maximumHeight: number,
  isFocused: boolean,
): IKaraokeLyricLayout => {
  const width = Math.max(1, availableWidth);
  // Rows break at `wrapWidth`, but a word is only ever split at the stage's
  // own width: balancing must never cut a word that fits the stage.
  const measureAt = (
    fontSize: number,
    wrapWidth = width,
  ): IKaraokeLyricLayout => {
    const fontWeight = isFocused && fontSize > 20 ? 900 : 700;
    context.font = `${fontWeight} ${fontSize}px ${LYRIC_FONT_FAMILY}`;
    const measure = (text: string) => context.measureText(text).width;
    const rows: IKaraokeLyricRow[] = [];
    let row: IKaraokeLyricRow = { fragments: [], width: 0 };
    let spaces: ILyricPiece[] = [];
    const append = (piece: ILyricPiece) => {
      const pieceWidth = measure(piece.text);
      row.fragments.push({
        ...piece,
        x: row.width,
        width: pieceWidth,
        prefixWidth: measure(piece.displayText.slice(0, piece.start)),
      });
      row.width += pieceWidth;
    };
    lyricPieces(tokens).forEach((original) => {
      if (/^\s+$/u.test(original.text)) {
        spaces.push(original);
        return;
      }
      splitOversizedPiece(original, width, measure).forEach((piece) => {
        const spaceWidth = spaces.reduce(
          (sum, space) => sum + measure(space.text),
          0,
        );
        if (
          row.fragments.length &&
          row.width + spaceWidth + measure(piece.text) > wrapWidth
        ) {
          rows.push(row);
          row = { fragments: [], width: 0 };
        }
        if (row.fragments.length) {
          spaces.forEach(append);
        }
        spaces = [];
        append(piece);
      });
    });
    if (row.fragments.length) {
      rows.push(row);
    }
    const lineHeight = fontSize * 1.24;
    return {
      rows,
      fontSize,
      fontWeight,
      lineHeight,
      height: Math.max(0, rows.length - 1) * lineHeight + fontSize * 1.36,
    };
  };
  const fits = (layout: IKaraokeLyricLayout) =>
    layout.rows.length <= 3 &&
    layout.height <= Math.max(1, maximumHeight) &&
    layout.rows.every((row) => row.width <= width + 0.01);
  // The narrowest wrap that keeps the same number of rows, as CSS's
  // `text-wrap: balance` does for a heading: filling each row greedily left
  // a phrase's last word alone on its own row ("Feel the low end fill the /
  // room") on a narrow stage. Only the breaks move; the size and the row
  // count stay, so the phrase still fits wherever it fitted.
  const balanced = (layout: IKaraokeLyricLayout): IKaraokeLyricLayout => {
    const count = layout.rows.length;
    if (count < 2) {
      return layout;
    }
    // Narrower than an even share of the words, `count` rows cannot hold them.
    let low = layout.rows.reduce((sum, row) => sum + row.width, 0) / count;
    let high = width;
    let best = layout;
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const middle = (low + high) / 2;
      const measured = measureAt(layout.fontSize, middle);
      if (measured.rows.length <= count) {
        high = middle;
        best = measured;
      } else {
        low = middle;
      }
    }
    return best;
  };
  const preferred = measureAt(Math.max(1, preferredSize));
  if (fits(preferred)) {
    return balanced(preferred);
  }
  let low = 1;
  let high = Math.max(1, preferredSize);
  let best = measureAt(low);
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const middle = (low + high) / 2;
    const measured = measureAt(middle);
    if (fits(measured)) {
      low = middle;
      best = measured;
    } else {
      high = middle;
    }
  }
  return balanced(best);
};

/**
 * A phrase's size away from the centre. The next phrase rests larger than
 * the one already sung, so it can be read ahead; a narrow stage caps both
 * low enough that a resting phrase never competes with the sung one.
 */
export const karaokeLyricRestingSize = (
  preferredSize: number,
  offset: number,
  width: number,
  isSection: boolean,
): number => {
  if (isSection) {
    return clamp(preferredSize * 0.28, 12, 16);
  }
  const isUpcoming = offset > 0;
  let ceiling = isUpcoming ? 30 : 25;
  if (width < 500) {
    ceiling = 23;
  }
  return clamp(
    preferredSize * (isUpcoming ? 0.52 : 0.45),
    isUpcoming ? 18 : 16,
    ceiling,
  );
};

/** The space between two phrases, tighter on a short or a narrow stage. */
export const karaokeLyricBlockGap = (width: number, height: number): number => {
  if (height < 250) {
    return 12;
  }
  return width < 500 ? 20 : 24;
};

export const karaokeLyricContextOpacity = (offset: number): number => {
  const distance = Math.abs(offset);
  const near = offset < 0 ? 0.62 : 0.94;
  if (distance < 1) {
    return 1 + (near - 1) * distance;
  }
  const far = offset < 0 ? 0.18 : 0;
  if (distance < 2) {
    return near + (far - near) * (distance - 1);
  }
  return far * clamp(3 - distance, 0, 1);
};

/** Keep a phrase's row breaks stable throughout its movement into focus. */
export const scaleKaraokeLyricLayout = (
  context: TMeasureContext,
  layout: IKaraokeLyricLayout,
  size: number,
  isFocused: boolean,
): IKaraokeLyricLayout => {
  const fontSize = Math.max(1, size);
  const fontWeight = isFocused && fontSize > 20 ? 900 : 700;
  context.font = `${fontWeight} ${fontSize}px ${LYRIC_FONT_FAMILY}`;
  const rows = layout.rows.map((row) => {
    let width = 0;
    const fragments = row.fragments.map((fragment) => {
      const measured = {
        ...fragment,
        x: width,
        width: context.measureText(fragment.text).width,
        prefixWidth: context.measureText(
          fragment.displayText.slice(0, fragment.start),
        ).width,
      };
      width += measured.width;
      return measured;
    });
    return { fragments, width };
  });
  const lineHeight = fontSize * 1.24;
  return {
    rows,
    fontSize,
    fontWeight,
    lineHeight,
    height: Math.max(0, rows.length - 1) * lineHeight + fontSize * 1.36,
  };
};

export interface IKaraokeLyricBlock {
  index: number;
  height: number;
}

/** Center complete blocks, including translation space, during a hand-off. */
export const positionKaraokeLyricBlocks = (
  blocks: readonly IKaraokeLyricBlock[],
  animatedCenter: number,
  height: number,
  gap: number,
) => {
  const floor = Math.floor(animatedCenter);
  const centerBlock = blocks.findIndex((block) => block.index === floor);
  const anchor = centerBlock >= 0 ? centerBlock : 0;
  const anchorHeight = blocks[anchor]?.height ?? 0;
  const nextHeight = blocks[anchor + 1]?.height ?? anchorHeight;
  let top =
    height * 0.5 -
    anchorHeight * 0.5 -
    (animatedCenter - floor) * (anchorHeight * 0.5 + gap + nextHeight * 0.5);
  for (let index = anchor - 1; index >= 0; index -= 1) {
    top -= blocks[index].height + gap;
  }
  return blocks.map((block) => {
    const bottom = top + block.height;
    // Fade the whole phrase before any glyph reaches a clipping boundary.
    // The same result determines hit regions, so an invisible ghost cannot
    // remain clickable after its words have faded out.
    const edgeOpacity = clamp(
      Math.min(top - 4, height - bottom - 4) / 24,
      0,
      1,
    );
    const position = {
      ...block,
      top,
      opacity:
        karaokeLyricContextOpacity(block.index - animatedCenter) * edgeOpacity,
    };
    top = bottom + gap;
    return position;
  });
};
