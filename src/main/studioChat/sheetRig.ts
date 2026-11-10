/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A picture bent into poses along a spine (`pose_sheet`): the frames of an
 * animation made from the project's own picture, so every frame is the same
 * animal, photo-real, without a picture being drawn for it.
 *
 * The spine is a chain of points along the body, head first. One of them is
 * the root, which stays where it is; every joint between the root and an
 * end turns everything beyond it. A pose is the bend at each interior
 * joint, plus a turn, a move and a scale of the whole. The picture is cut
 * into a fine mesh, each vertex follows the bone it lies along - two bones
 * blended across each joint, so a bend is a curve and not a crease - and
 * each triangle is drawn into the cell from the picture's own pixels.
 *
 * Pixels are premultiplied, four bytes each with alpha last (the order of
 * the other three is the caller's); nothing here knows Electron.
 */

export interface IPixels {
  data: Uint8Array;
  width: number;
  height: number;
}

export type TPoint = readonly [number, number];

export interface IRigPose {
  /** Degrees at each interior joint, head first; positive turns clockwise. */
  bend: readonly number[];
  /** Degrees the whole turns about its middle; positive is clockwise. */
  turn: number;
  /** Where its middle moves, in shares of the cell (right and down). */
  x: number;
  y: number;
  scale: number;
}

export interface IRigKey {
  /** Where in the animation this pose stands, 0 to 1. */
  at: number;
  pose: IRigPose;
}

/** The drawing's box in a picture: what is more than faintly opaque. */
const DRAWN_ALPHA = 8;

export interface IBox {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** The drawn box, inclusive, or undefined for a picture with nothing drawn. */
export const drawnBox = (picture: IPixels): IBox | undefined => {
  const { data, width, height } = picture;
  let box: IBox | undefined;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (data[(y * width + x) * 4 + 3] > DRAWN_ALPHA) {
        if (!box) {
          box = { left: x, top: y, right: x, bottom: y };
        } else {
          box.left = Math.min(box.left, x);
          box.right = Math.max(box.right, x);
          box.bottom = y;
        }
      }
    }
  }
  return box;
};

/**
 * A spine along the drawing when none is given: `points` points across its
 * box from left to right, each at the middle of what is drawn in its
 * column, so it follows a body that curves.
 */
export const traceSpine = (
  picture: IPixels,
  box: IBox,
  points: number,
): TPoint[] =>
  Array.from({ length: points }, (_, index) => {
    const x = Math.round(
      box.left + ((box.right - box.left) * index) / (points - 1),
    );
    let top = -1;
    let bottom = -1;
    for (let y = box.top; y <= box.bottom; y += 1) {
      if (picture.data[(y * picture.width + x) * 4 + 3] > DRAWN_ALPHA) {
        top = top < 0 ? y : top;
        bottom = y;
      }
    }
    return [
      x + 0.5,
      top < 0 ? (box.top + box.bottom + 1) / 2 : (top + bottom + 1) / 2,
    ];
  });

const rotate = (point: TPoint, degrees: number): TPoint => {
  const radians = (degrees * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return [point[0] * cos - point[1] * sin, point[0] * sin + point[1] * cos];
};

/** Catmull-Rom through four values, at `u` between the middle two. */
const spline = (a: number, b: number, c: number, d: number, u: number) =>
  0.5 *
  (2 * b +
    (c - a) * u +
    (2 * a - 5 * b + 4 * c - d) * u * u +
    (3 * b - a - 3 * c + d) * u * u * u);

/**
 * The pose at `t` (0 to 1) between the keys, eased through them so a cycle
 * keeps moving at each key instead of stopping there. A loop runs from the
 * last key back into the first.
 */
export const poseAt = (
  keys: readonly IRigKey[],
  t: number,
  loop: boolean,
): IRigPose => {
  const sorted = [...keys].sort((a, b) => a.at - b.at);
  const count = sorted.length;
  if (count === 1) {
    return sorted[0].pose;
  }
  const atOf = (index: number) => {
    if (!loop) {
      return sorted[Math.min(count - 1, Math.max(0, index))].at;
    }
    const lap = Math.floor(index / count);
    return sorted[((index % count) + count) % count].at + lap;
  };
  const keyOf = (index: number) =>
    loop
      ? sorted[((index % count) + count) % count].pose
      : sorted[Math.min(count - 1, Math.max(0, index))].pose;
  // The interval holding t starts at the last key at or before it; in a
  // loop, a t before the first key starts at the last key, one lap back
  // (`atOf(-1)`).
  let start = -1;
  const time = loop
    ? t
    : Math.min(sorted[count - 1].at, Math.max(sorted[0].at, t));
  for (let index = 0; index < count; index += 1) {
    if (sorted[index].at <= time) {
      start = index;
    }
  }
  const from = atOf(start);
  const to = atOf(start + 1);
  const u = to > from ? (time - from) / (to - from) : 0;
  const [a, b, c, d] = [
    keyOf(start - 1),
    keyOf(start),
    keyOf(start + 1),
    keyOf(start + 2),
  ];
  const joints = Math.max(
    a.bend.length,
    b.bend.length,
    c.bend.length,
    d.bend.length,
  );
  const value = (pick: (pose: IRigPose) => number) =>
    spline(pick(a), pick(b), pick(c), pick(d), u);
  return {
    bend: Array.from({ length: joints }, (_, joint) =>
      value((pose) => pose.bend[joint] ?? 0),
    ),
    turn: value((pose) => pose.turn),
    x: value((pose) => pose.x),
    y: value((pose) => pose.y),
    scale: Math.max(
      0.05,
      value((pose) => pose.scale),
    ),
  };
};

interface IBones {
  /** Each bone's rest pivot, rotation and posed pivot. */
  pivot: TPoint[];
  angle: number[];
  posed: TPoint[];
  /** Arc length at each spine point, and the blend half-width at joints. */
  along: number[];
  blend: number;
}

/**
 * Each bone (segment `k` joins points `k` and `k + 1`) turned by the bends
 * between it and the root, and moved to where its root-side joint now is.
 */
const poseBones = (
  spine: readonly TPoint[],
  root: number,
  bend: readonly number[],
): IBones => {
  const bones = spine.length - 1;
  const angle = Array.from({ length: bones }, (_, k) => {
    let sum = 0;
    if (k >= root) {
      for (let joint = root + 1; joint <= k; joint += 1) {
        sum += bend[joint - 1] ?? 0;
      }
    } else {
      for (let joint = k + 1; joint <= root - 1; joint += 1) {
        sum += bend[joint - 1] ?? 0;
      }
    }
    return sum;
  });
  const placed: TPoint[] = spine.map((point) => point);
  for (let k = root; k < bones; k += 1) {
    const offset = rotate(
      [spine[k + 1][0] - spine[k][0], spine[k + 1][1] - spine[k][1]],
      angle[k],
    );
    placed[k + 1] = [placed[k][0] + offset[0], placed[k][1] + offset[1]];
  }
  for (let k = root - 1; k >= 0; k -= 1) {
    const offset = rotate(
      [spine[k][0] - spine[k + 1][0], spine[k][1] - spine[k + 1][1]],
      angle[k],
    );
    placed[k] = [placed[k + 1][0] + offset[0], placed[k + 1][1] + offset[1]];
  }
  const pivotIndex = (k: number) => (k >= root ? k : k + 1);
  const lengths = Array.from({ length: bones }, (_, k) =>
    Math.hypot(spine[k + 1][0] - spine[k][0], spine[k + 1][1] - spine[k][1]),
  );
  const along = [0];
  lengths.forEach((length) => along.push(along[along.length - 1] + length));
  return {
    pivot: Array.from({ length: bones }, (_, k) => spine[pivotIndex(k)]),
    angle,
    posed: Array.from({ length: bones }, (_, k) => placed[pivotIndex(k)]),
    along,
    // Blends never overlap: each reaches a third of the shortest bone.
    blend: Math.max(0.5, Math.min(...lengths) * 0.33),
  };
};

/** Where a picture point lies along the spine: its nearest bone and arc length. */
const alongSpine = (
  spine: readonly TPoint[],
  along: number[],
  point: TPoint,
) => {
  let best = { bone: 0, at: 0, distance: Infinity };
  for (let k = 0; k < spine.length - 1; k += 1) {
    const [ax, ay] = spine[k];
    const dx = spine[k + 1][0] - ax;
    const dy = spine[k + 1][1] - ay;
    const length = dx * dx + dy * dy;
    const u =
      length > 0
        ? Math.min(
            1,
            Math.max(0, ((point[0] - ax) * dx + (point[1] - ay) * dy) / length),
          )
        : 0;
    const distance = Math.hypot(
      point[0] - (ax + u * dx),
      point[1] - (ay + u * dy),
    );
    if (distance < best.distance) {
      best = {
        bone: k,
        at: along[k] + u * (along[k + 1] - along[k]),
        distance,
      };
    }
  }
  return best;
};

const smoothstep = (value: number) => {
  const t = Math.min(1, Math.max(0, value));
  return t * t * (3 - 2 * t);
};

/** A picture point carried by the posed bones, blended across each joint. */
const skin = (
  spine: readonly TPoint[],
  bones: IBones,
  point: TPoint,
): TPoint => {
  const { bone, at } = alongSpine(spine, bones.along, point);
  const carried = (k: number): TPoint => {
    const moved = rotate(
      [point[0] - bones.pivot[k][0], point[1] - bones.pivot[k][1]],
      bones.angle[k],
    );
    return [bones.posed[k][0] + moved[0], bones.posed[k][1] + moved[1]];
  };
  const last = spine.length - 2;
  const start = bones.along[bone];
  const end = bones.along[bone + 1];
  let other = -1;
  let weight = 0;
  if (bone > 0 && at < start + bones.blend) {
    other = bone - 1;
    weight = 1 - smoothstep((at - (start - bones.blend)) / (2 * bones.blend));
  } else if (bone < last && at > end - bones.blend) {
    other = bone + 1;
    weight = smoothstep((at - (end - bones.blend)) / (2 * bones.blend));
  }
  const own = carried(bone);
  if (other < 0 || weight <= 0) {
    return own;
  }
  const theirs = carried(other);
  return [
    own[0] * (1 - weight) + theirs[0] * weight,
    own[1] * (1 - weight) + theirs[1] * weight,
  ];
};

/** The premultiplied colour at a picture point, between its four pixels. */
const sample = (picture: IPixels, x: number, y: number, out: Float64Array) => {
  const { data, width, height } = picture;
  const fx = x - 0.5;
  const fy = y - 0.5;
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const tx = fx - x0;
  const ty = fy - y0;
  out.fill(0);
  for (let dy = 0; dy <= 1; dy += 1) {
    for (let dx = 0; dx <= 1; dx += 1) {
      const px = x0 + dx;
      const py = y0 + dy;
      if (px >= 0 && py >= 0 && px < width && py < height) {
        const weight = (dx ? tx : 1 - tx) * (dy ? ty : 1 - ty);
        const at = (py * width + px) * 4;
        for (let channel = 0; channel < 4; channel += 1) {
          out[channel] += data[at + channel] * weight;
        }
      }
    }
  }
};

/**
 * One triangle of the mesh drawn into the cell: every cell pixel inside it
 * takes the picture's colour where the triangle came from. Where two
 * triangles meet, or a strong bend folds the body over itself, the more
 * opaque of the two is kept, so no seam is drawn twice.
 */
const drawTriangle = (
  picture: IPixels,
  cell: IPixels,
  from: readonly [TPoint, TPoint, TPoint],
  to: readonly [TPoint, TPoint, TPoint],
  colour: Float64Array,
) => {
  const [[ax, ay], [bx, by], [cx, cy]] = to;
  const area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
  if (Math.abs(area) < 1e-9) {
    return;
  }
  const left = Math.max(0, Math.floor(Math.min(ax, bx, cx)));
  const right = Math.min(cell.width - 1, Math.ceil(Math.max(ax, bx, cx)));
  const top = Math.max(0, Math.floor(Math.min(ay, by, cy)));
  const bottom = Math.min(cell.height - 1, Math.ceil(Math.max(ay, by, cy)));
  const edge = -1e-6;
  for (let y = top; y <= bottom; y += 1) {
    for (let x = left; x <= right; x += 1) {
      const px = x + 0.5;
      const py = y + 0.5;
      const wa = ((bx - px) * (cy - py) - (by - py) * (cx - px)) / area;
      const wb = ((cx - px) * (ay - py) - (cy - py) * (ax - px)) / area;
      const wc = 1 - wa - wb;
      if (wa >= edge && wb >= edge && wc >= edge) {
        sample(
          picture,
          wa * from[0][0] + wb * from[1][0] + wc * from[2][0],
          wa * from[0][1] + wb * from[1][1] + wc * from[2][1],
          colour,
        );
        const at = (y * cell.width + x) * 4;
        if (colour[3] > cell.data[at + 3]) {
          for (let channel = 0; channel < 4; channel += 1) {
            cell.data[at + channel] = Math.round(
              Math.min(255, Math.max(0, colour[channel])),
            );
          }
        }
      }
    }
  }
};

/** Mesh cells along the drawing's longer side: fine enough for a curve. */
const MESH_STEPS = 48;

export interface IRigFrame {
  picture: IPixels;
  /** The drawn box the mesh covers, and the spine through it, in its pixels. */
  box: IBox;
  spine: readonly TPoint[];
  root: number;
  /** Picture pixels to cell pixels at scale 1. */
  fit: number;
}

/** One frame: the picture in `pose`, drawn into a clear cell. */
export const drawPose = (
  rig: IRigFrame,
  pose: IRigPose,
  cellWidth: number,
  cellHeight: number,
): IPixels => {
  const cell: IPixels = {
    data: new Uint8Array(cellWidth * cellHeight * 4),
    width: cellWidth,
    height: cellHeight,
  };
  const { box, picture, spine } = rig;
  const bones = poseBones(spine, rig.root, pose.bend);
  const centre: TPoint = [
    (box.left + box.right + 1) / 2,
    (box.top + box.bottom + 1) / 2,
  ];
  const spanX = box.right - box.left + 1;
  const spanY = box.bottom - box.top + 1;
  const step = Math.max(spanX, spanY) / MESH_STEPS;
  const columns = Math.max(1, Math.ceil(spanX / step));
  const rows = Math.max(1, Math.ceil(spanY / step));
  // One pixel of clear border around the box, so its edge samples clear.
  const left = box.left - 1;
  const top = box.top - 1;
  const meshWidth = spanX + 2;
  const meshHeight = spanY + 2;
  const toCell = (point: TPoint): TPoint => {
    const moved = rotate(
      [
        (point[0] - centre[0]) * pose.scale,
        (point[1] - centre[1]) * pose.scale,
      ],
      pose.turn,
    );
    return [
      cellWidth / 2 + pose.x * cellWidth + moved[0] * rig.fit,
      cellHeight / 2 + pose.y * cellHeight + moved[1] * rig.fit,
    ];
  };
  const source: TPoint[] = [];
  const placed: TPoint[] = [];
  for (let row = 0; row <= rows; row += 1) {
    for (let column = 0; column <= columns; column += 1) {
      const point: TPoint = [
        left + (meshWidth * column) / columns,
        top + (meshHeight * row) / rows,
      ];
      source.push(point);
      placed.push(toCell(skin(spine, bones, point)));
    }
  }
  const colour = new Float64Array(4);
  const index = (row: number, column: number) => row * (columns + 1) + column;
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const a = index(row, column);
      const b = index(row, column + 1);
      const c = index(row + 1, column);
      const d = index(row + 1, column + 1);
      drawTriangle(
        picture,
        cell,
        [source[a], source[b], source[d]],
        [placed[a], placed[b], placed[d]],
        colour,
      );
      drawTriangle(
        picture,
        cell,
        [source[a], source[d], source[c]],
        [placed[a], placed[d], placed[c]],
        colour,
      );
    }
  }
  return cell;
};
