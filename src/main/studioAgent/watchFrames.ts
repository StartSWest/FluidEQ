/**
 * A few pictures of a scene taken a moment apart, laid side by side for the
 * member's AI to watch, with what moved between them said in numbers.
 *
 * One picture cannot say which way a thing is going or whether it goes
 * there evenly, and those are what an animation is judged by (Ivan,
 * 2026-11-11: "see ... a particular part of the scene animation like 3 or 5
 * frames so it can tell the direction or smooth of the animation"). So the
 * frames are cut to the part asked for, each under its number and its
 * moment, and every step between two frames is measured: how much of the
 * picture changed, and which way it moved if it moved as one.
 *
 * Pure arithmetic on pixels, so it is tested without a GPU or a decoder.
 * Pixels are four bytes each, alpha last, in whatever colour order the
 * decoder gives: nothing here depends on which of the first three is red.
 */

export interface IPixels {
  data: Uint8Array;
  width: number;
  height: number;
}

/** A part of the picture in uv: its bottom-left corner and its size, 0..1. */
export interface IWatchRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const WHOLE_PICTURE: IWatchRegion = { x: 0, y: 0, width: 1, height: 1 };

/** What one step between two frames did. */
export interface IWatchStep {
  /** The share of the picture's light that changed, 0..1. */
  change: number;
  /**
   * How far the picture moved as one, in shares of the part watched: right
   * and up are positive. Absent when no single move explains the change.
   */
  shift?: { x: number; y: number };
}

/** The widest the strip is made: it has to be read, not just be there. */
const STRIP_WIDTH = 1960;
const GAP = 8;
const LABEL = 24;
/** The most a small part is enlarged, in whole pixels: 8 is plenty to see. */
const MOST_ENLARGED = 8;
/** The grid the motion is measured on: wide enough for a move of a twelfth. */
const MEASURE_WIDTH = 96;
const SEARCH = 8;
/** A move has to explain this much of the change to be called a move. */
const MOVE_EXPLAINS = 0.25;

/** `picture` cut to `region`, never smaller than two pixels a side. */
export const cutTo = (picture: IPixels, region: IWatchRegion): IPixels => {
  const left = Math.min(
    picture.width - 2,
    Math.max(0, Math.round(region.x * picture.width)),
  );
  const width = Math.max(
    2,
    Math.min(picture.width - left, Math.round(region.width * picture.width)),
  );
  // uv counts up from the bottom; rows count down from the top.
  const height = Math.max(
    2,
    Math.min(picture.height, Math.round(region.height * picture.height)),
  );
  const top = Math.min(
    picture.height - height,
    Math.max(0, Math.round((1 - region.y - region.height) * picture.height)),
  );
  const data = new Uint8Array(width * height * 4);
  for (let row = 0; row < height; row += 1) {
    const from = ((top + row) * picture.width + left) * 4;
    data.set(picture.data.subarray(from, from + width * 4), row * width * 4);
  }
  return { data, width, height };
};

/** `picture` at `width` by `height`, each new pixel the mean of what it covers. */
export const resized = (
  picture: IPixels,
  width: number,
  height: number,
): IPixels => {
  if (picture.width === width && picture.height === height) {
    return picture;
  }
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    const top = Math.floor((y * picture.height) / height);
    const bottom = Math.max(
      top + 1,
      Math.floor(((y + 1) * picture.height) / height),
    );
    for (let x = 0; x < width; x += 1) {
      const left = Math.floor((x * picture.width) / width);
      const right = Math.max(
        left + 1,
        Math.floor(((x + 1) * picture.width) / width),
      );
      const sum = [0, 0, 0, 0];
      for (let sy = top; sy < bottom; sy += 1) {
        for (let sx = left; sx < right; sx += 1) {
          const at = (sy * picture.width + sx) * 4;
          sum[0] += picture.data[at];
          sum[1] += picture.data[at + 1];
          sum[2] += picture.data[at + 2];
          sum[3] += picture.data[at + 3];
        }
      }
      const count = (bottom - top) * (right - left);
      const to = (y * width + x) * 4;
      data[to] = sum[0] / count;
      data[to + 1] = sum[1] / count;
      data[to + 2] = sum[2] / count;
      data[to + 3] = sum[3] / count;
    }
  }
  return { data, width, height };
};

/** The picture's light alone, on the grid motion is measured on. */
const lightOf = (picture: IPixels) => {
  const width = Math.min(MEASURE_WIDTH, picture.width);
  const height = Math.max(
    2,
    Math.round((picture.height * width) / picture.width),
  );
  const small = resized(picture, width, Math.min(height, picture.height));
  const light = new Float32Array(small.width * small.height);
  for (let i = 0; i < light.length; i += 1) {
    light[i] =
      (small.data[i * 4] + small.data[i * 4 + 1] + small.data[i * 4 + 2]) / 3;
  }
  return { light, width: small.width, height: small.height };
};

/**
 * The mean difference between `after` and `before` moved by (dx, dy), over
 * the part both cover.
 */
const offBy = (
  before: Float32Array,
  after: Float32Array,
  width: number,
  height: number,
  dx: number,
  dy: number,
) => {
  let sum = 0;
  let count = 0;
  for (let y = Math.max(0, dy); y < Math.min(height, height + dy); y += 1) {
    for (let x = Math.max(0, dx); x < Math.min(width, width + dx); x += 1) {
      sum += Math.abs(after[y * width + x] - before[(y - dy) * width + x - dx]);
      count += 1;
    }
  }
  return count > 0 ? sum / count : Infinity;
};

/** What changed from `before` to `after`: how much, and which way. */
export const stepBetween = (before: IPixels, after: IPixels): IWatchStep => {
  const a = lightOf(before);
  const b = lightOf(after);
  const { width, height } = a;
  const still = offBy(a.light, b.light, width, height, 0, 0);
  const change = still / 255;
  // Nothing to speak of moved: no direction to look for in the noise.
  if (change < 0.002) {
    return { change };
  }
  const reach = Math.min(SEARCH, Math.floor(Math.min(width, height) / 3));
  let best = { dx: 0, dy: 0, off: still };
  for (let dy = -reach; dy <= reach; dy += 1) {
    for (let dx = -reach; dx <= reach; dx += 1) {
      const off = offBy(a.light, b.light, width, height, dx, dy);
      if (off < best.off) {
        best = { dx, dy, off };
      }
    }
  }
  if (
    (best.dx === 0 && best.dy === 0) ||
    best.off > still * (1 - MOVE_EXPLAINS)
  ) {
    return { change };
  }
  // Rows count down; up is positive, as uv is.
  return { change, shift: { x: best.dx / width, y: -best.dy / height } };
};

/** Digits, a point and an s, five rows of three, for a frame's label. */
const GLYPHS: Readonly<Record<string, readonly string[]>> = {
  '0': ['###', '# #', '# #', '# #', '###'],
  '1': [' # ', '## ', ' # ', ' # ', '###'],
  '2': ['###', '  #', '###', '#  ', '###'],
  '3': ['###', '  #', '###', '  #', '###'],
  '4': ['# #', '# #', '###', '  #', '  #'],
  '5': ['###', '#  ', '###', '  #', '###'],
  '6': ['###', '#  ', '###', '# #', '###'],
  '7': ['###', '  #', '  #', '  #', '  #'],
  '8': ['###', '# #', '###', '# #', '###'],
  '9': ['###', '# #', '###', '  #', '###'],
  '.': ['   ', '   ', '   ', '   ', ' # '],
  s: ['   ', '###', '## ', ' ##', '###'],
  ' ': ['   ', '   ', '   ', '   ', '   '],
};

const DOT = 3;

const write = (
  onto: IPixels,
  words: string,
  left: number,
  top: number,
  shade: number,
) => {
  [...words].forEach((letter, place) => {
    const rows = GLYPHS[letter] ?? GLYPHS[' '];
    rows.forEach((row, y) => {
      [...row].forEach((mark, x) => {
        if (mark !== '#') {
          return;
        }
        for (let py = 0; py < DOT; py += 1) {
          for (let px = 0; px < DOT; px += 1) {
            const at =
              ((top + y * DOT + py) * onto.width +
                left +
                place * 4 * DOT +
                x * DOT +
                px) *
              4;
            if (at >= 0 && at + 3 < onto.data.length) {
              onto.data.fill(shade, at, at + 3);
            }
          }
        }
      });
    });
  });
};

/** How large one frame stands in the strip. */
const cellFor = (part: IPixels, columns: number) => {
  const room = Math.floor((STRIP_WIDTH - GAP * (columns + 1)) / columns);
  if (part.width > room) {
    return {
      width: room,
      height: Math.max(2, Math.round((part.height * room) / part.width)),
    };
  }
  // A small part is enlarged by whole pixels, so each of its pixels stays a
  // square and nothing is invented between them.
  const times = Math.max(
    1,
    Math.min(MOST_ENLARGED, Math.floor(room / part.width)),
  );
  return { width: part.width * times, height: part.height * times };
};

export interface IWatched {
  /** The frames side by side, each under its number and its moment. */
  strip: IPixels;
  steps: IWatchStep[];
  /** The part watched, in the pixels of one whole picture. */
  cut: { width: number; height: number };
  /** One frame as it stands in the strip. */
  cell: { width: number; height: number };
}

/**
 * `frames`, taken at `seconds`, cut to `region` and laid in a row — two rows
 * past five — with every step between them measured.
 */
export const watchFrames = (
  frames: readonly IPixels[],
  seconds: readonly number[],
  region: IWatchRegion,
): IWatched => {
  const parts = frames.map((frame) => cutTo(frame, region));
  const columns = parts.length > 5 ? Math.ceil(parts.length / 2) : parts.length;
  const rows = Math.ceil(parts.length / columns);
  const cell = cellFor(parts[0], columns);
  const width = GAP + columns * (cell.width + GAP);
  const height = GAP + rows * (LABEL + cell.height + GAP);
  const strip: IPixels = {
    data: new Uint8Array(width * height * 4),
    width,
    height,
  };
  // A dark ground, opaque: the frames are what is looked at.
  for (let at = 0; at < strip.data.length; at += 4) {
    strip.data[at] = 24;
    strip.data[at + 1] = 24;
    strip.data[at + 2] = 24;
    strip.data[at + 3] = 255;
  }
  parts.forEach((part, index) => {
    const shown = resized(part, cell.width, cell.height);
    const left = GAP + (index % columns) * (cell.width + GAP);
    const top = GAP + Math.floor(index / columns) * (LABEL + cell.height + GAP);
    write(
      strip,
      `${String(index + 1)}  ${seconds[index].toFixed(2)}s`,
      left,
      top + 4,
      235,
    );
    for (let row = 0; row < cell.height; row += 1) {
      const to = ((top + LABEL + row) * width + left) * 4;
      strip.data.set(
        shown.data.subarray(row * cell.width * 4, (row + 1) * cell.width * 4),
        to,
      );
    }
    // Opaque, whatever the frame's own alpha said.
    for (let row = 0; row < cell.height; row += 1) {
      for (let x = 0; x < cell.width; x += 1) {
        strip.data[((top + LABEL + row) * width + left + x) * 4 + 3] = 255;
      }
    }
  });
  return {
    strip,
    steps: parts.slice(1).map((part, index) => stepBetween(parts[index], part)),
    cut: { width: parts[0].width, height: parts[0].height },
    cell,
  };
};

const percent = (share: number) => `${(share * 100).toFixed(1)}%`;

const direction = ({ x, y }: { x: number; y: number }) => {
  const across = x > 0 ? 'right' : 'left';
  const along = y > 0 ? 'up' : 'down';
  const parts = [
    ...(x !== 0 ? [`${percent(Math.abs(x))} of its width ${across}`] : []),
    ...(y !== 0 ? [`${percent(Math.abs(y))} of its height ${along}`] : []),
  ];
  return parts.join(' and ');
};

/**
 * The steps in words: one line a step, then what the run of them says about
 * how even the motion is.
 */
export const describeSteps = (steps: readonly IWatchStep[]): string[] => {
  const lines = steps.map((step, index) => {
    const from = `Frame ${String(index + 1)} to ${String(index + 2)}`;
    if (step.change < 0.002) {
      return `${from}: nothing to speak of changed.`;
    }
    return step.shift
      ? `${from}: ${percent(step.change)} of the light changed; the picture moved ${direction(step.shift)}.`
      : `${from}: ${percent(step.change)} of the light changed, in place: no single move explains it (a pulse, a flicker, a change of shape or colour, or things moving different ways).`;
  });
  const moving = steps.filter((step) => step.change >= 0.002);
  if (moving.length === 0) {
    return [
      ...lines,
      'Nothing moves in this part over these frames. If something should, it is not moving, is moving too slowly for this spacing, or is outside the part watched.',
    ];
  }
  if (moving.length < steps.length) {
    return [
      ...lines,
      'It moves in some steps and stands still in others: a start, a stop, or a stutter. Look at which.',
    ];
  }
  const changes = moving.map((step) => step.change);
  const most = Math.max(...changes);
  const least = Math.min(...changes);
  const turned = steps.some(
    (step, index) =>
      index > 0 &&
      step.shift !== undefined &&
      steps[index - 1].shift !== undefined &&
      step.shift.x * (steps[index - 1].shift?.x ?? 0) +
        step.shift.y * (steps[index - 1].shift?.y ?? 0) <
        0,
  );
  return [
    ...lines,
    most <= least * 1.6
      ? 'Every step changes about as much as the others: even motion.'
      : `The steps are uneven: the largest changes ${(most / least).toFixed(1)} times as much as the smallest. That is right for an ease, a hit or a beat, and a fault in something meant to glide.`,
    ...(turned
      ? [
          'The direction reverses between two steps: a swing or a bounce if meant, a jitter if not.',
        ]
      : []),
  ];
};
