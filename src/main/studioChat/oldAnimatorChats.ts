/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import fs from 'fs';
import path from 'path';
import writeFileAtomically from '../atomicWrite';

/**
 * What the animations' own chats left in the Studio chat's folder, taken
 * away now those chats are gone (Ivan, 2026-11-10: "remove that second chat
 * and make the root chat work on animations and all"). Each kept its
 * transcript, drafts and files in a folder named by its key, the project's
 * id with `#animator:<name>` after it, encoded as a file name.
 *
 * Removed without ever following a link: a link or junction inside is
 * unlinked as a link, so nothing it points at is touched - a recursive
 * delete that followed links once emptied this project's own checkout.
 * Folders of the scene's own chats never carry the mark and stay.
 */

/** The animator mark as it appears in a folder name. */
const MARK = encodeURIComponent('#animator:');

const removeWithoutFollowing = (target: string) => {
  const stats = fs.lstatSync(target);
  if (stats.isSymbolicLink() || !stats.isDirectory()) {
    try {
      fs.unlinkSync(target);
    } catch {
      // A directory link Windows will only remove as a directory.
      fs.rmdirSync(target);
    }
    return;
  }
  fs.readdirSync(target).forEach((name) =>
    removeWithoutFollowing(path.join(target, name)),
  );
  fs.rmdirSync(target);
};

/**
 * Claude Code's conversations the animators had. Claude Code keeps them
 * beside the scene's, in the project's folder, and the past-chats list
 * offered them as the scene's own earlier chats until it knew them
 * (`pastChats.ts`); with the animators' folders gone it learns them here.
 */
export const RETIRED_FILE = 'retired-sessions.json';
const MAX_RETIRED = 2000;

/** The conversations FluidEQ no longer offers as anybody's earlier chats. */
export const readRetiredSessions = (root: string): string[] => {
  try {
    const raw: unknown = JSON.parse(
      fs.readFileSync(path.join(root, RETIRED_FILE), 'utf8'),
    );
    return Array.isArray(raw)
      ? raw.filter((id): id is string => typeof id === 'string')
      : [];
  } catch {
    return [];
  }
};

/**
 * Removes every animator chat's folder under `root`, its conversation's id
 * kept as retired first (`sessionOf` reads it from the chat's transcript);
 * how many went.
 */
const removeAnimatorChats = (
  root: string,
  sessionOf: (folderName: string) => string | undefined,
): number => {
  let names: string[];
  try {
    names = fs.readdirSync(root);
  } catch {
    return 0;
  }
  const marked = names.filter((name) => name.includes(MARK));
  if (marked.length === 0) {
    return 0;
  }
  const retired = [
    ...new Set([
      ...readRetiredSessions(root),
      ...marked
        .map((name) => sessionOf(name))
        .filter((id): id is string => id !== undefined),
    ]),
  ].slice(-MAX_RETIRED);
  writeFileAtomically(path.join(root, RETIRED_FILE), JSON.stringify(retired));
  marked.forEach((name) => removeWithoutFollowing(path.join(root, name)));
  return marked.length;
};

export default removeAnimatorChats;
