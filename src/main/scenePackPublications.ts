/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import fs from 'fs';
import path from 'path';
import writeFileAtomically from './atomicWrite';

/**
 * Which publication of each FluidEQ scene this computer last took.
 *
 * Asking for the scenes used to mean downloading every one of them whole,
 * signature and artwork included — Alpine alone is 11 MB — so the question was
 * rationed to once every four hours, and a scene republished at noon reached a
 * listener who opened the looks at one in the afternoon only by chance. The
 * server now answers the small question first (each scene's version and when
 * it was published), and only a scene whose answer differs from the one taken
 * here is downloaded. Small enough to ask every time the window comes back or
 * the looks are opened.
 *
 * The publication time is kept as well as the version because a scene can be
 * republished at the version it already had; comparing versions alone would
 * never bring that one in. Kept on disk, so a restart does not download every
 * scene again to find out nothing changed.
 */

const FILE = path.join('scene-packs', 'publications.json');

const ID = /^[a-z][a-z0-9-]{1,47}$/;

export interface IScenePackPublication {
  id: string;
  version: number;
  publishedAt: string;
}

export interface IScenePackPublications {
  /**
   * The installed scenes the server has a different publication of: a newer
   * version, or the same version published again since the one taken here.
   * A version older than the installed one is never asked for.
   */
  changed(
    server: readonly IScenePackPublication[],
    installed: ReadonlyMap<string, number>,
  ): string[];
  /** These were downloaded and offered to the store, whatever it made of them. */
  took(publications: readonly IScenePackPublication[]): void;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

/** Server rows (`id,version,published_at`) → publications; malformed rows are dropped. */
export const readPublications = (body: unknown): IScenePackPublication[] =>
  Array.isArray(body)
    ? body.flatMap((row) => {
        if (!isRecord(row)) {
          return [];
        }
        const { id, version, published_at: publishedAt } = row;
        return typeof id === 'string' &&
          ID.test(id) &&
          typeof version === 'number' &&
          Number.isInteger(version) &&
          version >= 1 &&
          typeof publishedAt === 'string' &&
          publishedAt.length > 0
          ? [{ id, version, publishedAt }]
          : [];
      })
    : [];

export const createScenePackPublications = ({
  userDataDir,
  logger,
}: {
  userDataDir: string;
  logger?: { warn(message: string): void };
}): IScenePackPublications => {
  const filePath = path.join(userDataDir, FILE);

  const readTaken = (): Record<string, string> => {
    try {
      const parsed: unknown = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      return isRecord(parsed)
        ? Object.fromEntries(
            Object.entries(parsed).filter(
              (entry): entry is [string, string] =>
                ID.test(entry[0]) && typeof entry[1] === 'string',
            ),
          )
        : {};
    } catch {
      return {};
    }
  };

  let taken = readTaken();

  return {
    changed: (server, installed) =>
      server
        .filter((publication) => {
          const version = installed.get(publication.id);
          if (version === undefined || publication.version < version) {
            return false;
          }
          return (
            publication.version > version ||
            taken[publication.id] !== publication.publishedAt
          );
        })
        .map((publication) => publication.id),

    took: (publications) => {
      if (publications.length === 0) {
        return;
      }
      taken = {
        ...taken,
        ...Object.fromEntries(
          publications.map((publication) => [
            publication.id,
            publication.publishedAt,
          ]),
        ),
      };
      try {
        writeFileAtomically(filePath, JSON.stringify(taken));
      } catch (error) {
        // Only costs a download of the same scene at the next check.
        logger?.warn(`Scene publications could not be kept: ${error}`);
      }
    },
  };
};
