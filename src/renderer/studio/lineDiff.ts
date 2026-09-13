/**
 * What changed between two versions of a scene's source, line by line: the
 * Studio's code pane marks the lines an outside save — the member's AI, their
 * editor — added, and shows the whole change as a diff on request.
 *
 * A longest-common-subsequence diff over the lines left once the unchanged
 * top and bottom are set aside, which is almost all of an AI's rewrite. The
 * table is bounded: past `MAX_CELLS` the middle is reported as removed and
 * re-added whole, which is still true, only less precise. A scene file is at
 * most 64 KB, so that takes a rewrite of well over a thousand lines.
 */

export type TDiffKind = 'same' | 'add' | 'remove';

export interface IDiffLine {
  kind: TDiffKind;
  text: string;
  /** One-based, in the old text; absent for an added line. */
  oldLine?: number;
  /** One-based, in the new text; absent for a removed line. */
  newLine?: number;
}

const MAX_CELLS = 4_000_000;

const middleDiff = (a: readonly string[], b: readonly string[]) => {
  const n = a.length;
  const m = b.length;
  const ops: TDiffKind[] = [];
  if (n * m > MAX_CELLS || n > 65535 || m > 65535) {
    return [
      ...a.map((): TDiffKind => 'remove'),
      ...b.map((): TDiffKind => 'add'),
    ];
  }
  // lcs[i * (m + 1) + j]: the common subsequence of a[i..] and b[j..].
  const width = m + 1;
  const lcs = new Uint16Array((n + 1) * width);
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      lcs[i * width + j] =
        a[i] === b[j]
          ? lcs[(i + 1) * width + j + 1] + 1
          : Math.max(lcs[(i + 1) * width + j], lcs[i * width + j + 1]);
    }
  }
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      ops.push('same');
      i += 1;
      j += 1;
    } else if (lcs[(i + 1) * width + j] >= lcs[i * width + j + 1]) {
      ops.push('remove');
      i += 1;
    } else {
      ops.push('add');
      j += 1;
    }
  }
  for (; i < n; i += 1) {
    ops.push('remove');
  }
  for (; j < m; j += 1) {
    ops.push('add');
  }
  return ops;
};

export const diffLines = (before: string, after: string): IDiffLine[] => {
  const a = before.split('\n');
  const b = after.split('\n');
  let top = 0;
  while (top < a.length && top < b.length && a[top] === b[top]) {
    top += 1;
  }
  let bottom = 0;
  while (
    bottom < a.length - top &&
    bottom < b.length - top &&
    a[a.length - 1 - bottom] === b[b.length - 1 - bottom]
  ) {
    bottom += 1;
  }
  const ops: TDiffKind[] = [
    ...a.slice(0, top).map((): TDiffKind => 'same'),
    ...middleDiff(
      a.slice(top, a.length - bottom),
      b.slice(top, b.length - bottom),
    ),
    ...a.slice(a.length - bottom).map((): TDiffKind => 'same'),
  ];
  const lines: IDiffLine[] = [];
  let oldAt = 0;
  let newAt = 0;
  ops.forEach((kind) => {
    if (kind === 'remove') {
      lines.push({ kind, text: a[oldAt], oldLine: oldAt + 1 });
      oldAt += 1;
    } else if (kind === 'add') {
      lines.push({ kind, text: b[newAt], newLine: newAt + 1 });
      newAt += 1;
    } else {
      lines.push({
        kind,
        text: b[newAt],
        oldLine: oldAt + 1,
        newLine: newAt + 1,
      });
      oldAt += 1;
      newAt += 1;
    }
  });
  return lines;
};

/** A change, as the code pane marks it on the new text. */
export interface ILineChange {
  lines: IDiffLine[];
  /** New-text lines that were added or rewritten. */
  added: Set<number>;
  /** New-text lines with lines removed just above them; past the end is `length + 1`. */
  removedAbove: Set<number>;
  addedCount: number;
  removedCount: number;
  /** The first new-text line the change touches, to bring into view. */
  firstLine: number;
}

export const describeChange = (
  before: string,
  after: string,
): ILineChange | undefined => {
  const lines = diffLines(before, after);
  const added = new Set<number>();
  const removedAbove = new Set<number>();
  let removedCount = 0;
  let nextNewLine = 1;
  let firstLine: number | undefined;
  lines.forEach((line) => {
    if (line.kind === 'add' && line.newLine !== undefined) {
      added.add(line.newLine);
      firstLine = firstLine ?? line.newLine;
    }
    if (line.kind === 'remove') {
      removedCount += 1;
      removedAbove.add(nextNewLine);
      firstLine = firstLine ?? nextNewLine;
    }
    if (line.newLine !== undefined) {
      nextNewLine = line.newLine + 1;
    }
  });
  if (firstLine === undefined) {
    return undefined;
  }
  return {
    lines,
    added,
    removedAbove,
    addedCount: added.size,
    removedCount,
    firstLine,
  };
};

export type TDiffRow = IDiffLine | { kind: 'skip'; count: number };

/**
 * The diff as it is read: every changed line with three unchanged lines of
 * context around it, and each longer unchanged run folded to a count.
 */
export const diffRows = (
  lines: readonly IDiffLine[],
  context = 3,
): TDiffRow[] => {
  const near = lines.map(() => false);
  lines.forEach((line, index) => {
    if (line.kind !== 'same') {
      for (
        let at = Math.max(0, index - context);
        at <= Math.min(lines.length - 1, index + context);
        at += 1
      ) {
        near[at] = true;
      }
    }
  });
  const rows: TDiffRow[] = [];
  let skipped = 0;
  lines.forEach((line, index) => {
    if (near[index]) {
      if (skipped > 0) {
        rows.push({ kind: 'skip', count: skipped });
        skipped = 0;
      }
      rows.push(line);
    } else {
      skipped += 1;
    }
  });
  if (skipped > 0) {
    rows.push({ kind: 'skip', count: skipped });
  }
  return rows;
};
