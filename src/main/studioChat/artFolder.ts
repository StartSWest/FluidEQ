/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import fs from 'fs';
import path from 'path';
import type { IMcpToolResult } from '../studioAgent/mcpProtocol';

/**
 * Where ChatGPT's pictures are kept, inside the project: `art/`, which the
 * build never reads, so a picture made and not used costs the published
 * scene nothing. Read and written only as plain files in a plain folder.
 */

export const ART_DIR = 'art';
export const ART_NAME = /^[a-z][a-z0-9-]{0,39}$/;
const MAX_ART_BYTES = 16 * 1024 * 1024;

export const text = (words: string): IMcpToolResult['content'][number] => ({
  type: 'text',
  text: words,
});

export const failure = (words: string): IMcpToolResult => ({
  content: [text(words)],
  isError: true,
});

export /** The project's `art/` folder, made if needed; never one that is a link. */
const artFolder = (folder: string): string | undefined => {
  const art = path.join(folder, ART_DIR);
  try {
    const stats = fs.lstatSync(art);
    return stats.isDirectory() && !stats.isSymbolicLink() ? art : undefined;
  } catch {
    fs.mkdirSync(art);
    return art;
  }
};

/** A made picture's bytes, read only as a plain file inside `art/`. */
export const readArt = (folder: string, name: string): Buffer | undefined => {
  if (!ART_NAME.test(name)) {
    return undefined;
  }
  const art = artFolder(folder);
  if (!art) {
    return undefined;
  }
  const file = path.join(art, `${name}.png`);
  try {
    const stats = fs.lstatSync(file);
    return stats.isFile() && stats.nlink === 1 && stats.size <= MAX_ART_BYTES
      ? fs.readFileSync(file)
      : undefined;
  } catch {
    return undefined;
  }
};
