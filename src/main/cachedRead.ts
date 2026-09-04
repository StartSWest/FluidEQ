/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import fs from 'fs';
import { peekScheduled } from './asyncWriter';

/**
 * A text file read that is free when the file has not changed.
 *
 * Rendering the Equalizer APO config reads every attached profile and every
 * custom-effects file, and it renders on every slider movement — so a drag
 * was reading and re-parsing the same handful of unchanged files many times
 * a second, synchronously, in the main process. A stat is a fraction of a
 * read, and when the size and modification time match the last read the
 * contents are the same; the parse that follows is the caller's, so it gets
 * the same string back and can cache on identity if it likes.
 *
 * What the coalescing writer has accepted for a path wins over the disk, so a
 * render that lands while a write is still in flight sees the version it was
 * asked to render, not the one before.
 */

interface ICachedFile {
  mtimeMs: number;
  size: number;
  contents: string;
}

const cache = new Map<string, ICachedFile>();

const readTextCached = (filePath: string): string => {
  const scheduled = peekScheduled(filePath);
  if (scheduled !== undefined) {
    return scheduled;
  }
  const stat = fs.statSync(filePath);
  const hit = cache.get(filePath);
  if (hit && hit.mtimeMs === stat.mtimeMs && hit.size === stat.size) {
    return hit.contents;
  }
  const contents = fs.readFileSync(filePath, 'utf8');
  cache.set(filePath, { mtimeMs: stat.mtimeMs, size: stat.size, contents });
  return contents;
};

export default readTextCached;
