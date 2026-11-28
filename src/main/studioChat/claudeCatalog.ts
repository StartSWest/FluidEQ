/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import fs from 'fs';
import path from 'path';
import {
  compareStudioChatVersions,
  isStudioChatExactModel,
  type IStudioChatLine,
} from '../../common/studioChat';
import { isRecord, nameOf } from './claudeModelsAnswer';

/**
 * The older versions Claude Code offers this account, as its own model
 * picker lists them under "More models", read from the catalog Claude Code
 * keeps: its answer to `initialize` carries them only in some runs.
 *
 * Claude Code 2.1.332 answers that request from the list compiled into it
 * whenever its served catalog is off for the run (its debug log:
 * `[servedCatalog] off (flag)`): the four current models and nothing
 * older, and still the same when asked again after forty seconds alive.
 * It did so for the Studio's lookups at 23:21 and 23:31 on 2026-11-27, and
 * answered from the catalog again at 23:56. The catalog - the four, and
 * nine older versions in its `overflow` section that night - is kept by
 * Claude Code's desktop and terminal sessions in its config folder under
 * `cache/model-catalog`, one file per organization and surface
 * (`<organization>-<key>-cc.json`, `-ccd.json`), and the desktop's was
 * fetched again within the hour all night. The newest of the signed-in
 * organization's files is the list. A file of any other shape is nothing,
 * and so is a folder without one: the older versions are then left out, as
 * that answer leaves them, never guessed at.
 */

/** Where Claude Code keeps this account's catalog. */
export interface ICatalogPlace {
  /** Claude Code's config folder, where its sign-in is kept too. */
  config: string;
  /** `cache/model-catalog` in it. */
  folder: string;
  /** The signed-in organization's id, which starts each of its files. */
  organization: string;
}

const ORGANIZATION = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
/**
 * A catalog file's name after its organization: `0ec732dde858-cc.json`,
 * and never the `.headless-failed.json` retry marker Claude Code keeps
 * beside it.
 */
const CATALOG_FILE = /^[a-z0-9-]{1,80}\.json$/i;
/** A catalog is about 16 KB; a file past a megabyte is not one. */
const MOST_BYTES = 1_048_576;

/**
 * Where `claude auth status --json` says the catalog is: its config folder
 * (`configFallback` for an answer that names none) and the organization
 * signed in. Undefined for nobody signed in, or an answer of another shape.
 */
export const catalogPlaceOf = (
  stdout: string,
  configFallback: string,
): ICatalogPlace | undefined => {
  try {
    const raw: unknown = JSON.parse(stdout);
    if (
      !isRecord(raw) ||
      raw.loggedIn !== true ||
      typeof raw.orgId !== 'string' ||
      !ORGANIZATION.test(raw.orgId)
    ) {
      return undefined;
    }
    const config =
      typeof raw.configDirectory === 'string' &&
      path.isAbsolute(raw.configDirectory)
        ? raw.configDirectory
        : configFallback;
    return {
      config,
      folder: path.join(config, 'cache', 'model-catalog'),
      organization: raw.orgId.toLowerCase(),
    };
  } catch {
    return undefined;
  }
};

/** Whether `name` is one of `organization`'s catalog files. */
export const isCatalogFileOf = (organization: string, name: string) => {
  const prefix = `${organization}-`;
  return (
    name.toLowerCase().startsWith(prefix) &&
    CATALOG_FILE.test(name.slice(prefix.length))
  );
};

/** A version as Claude Code writes one ("2.1.280"), or undefined. */
const versionOf = (raw: unknown) =>
  typeof raw === 'string' && /^\d{1,4}(?:\.\d{1,6}){0,3}$/.test(raw)
    ? raw.split('.').map(Number)
    : undefined;

/**
 * Whether a row asks for a newer Claude Code than the one installed: a
 * minimum it gives in no shape this reads is one it may not meet.
 */
const needsNewer = (needed: unknown, installed: number[] | undefined) => {
  if (needed === undefined || needed === null || needed === '') {
    return false;
  }
  const version = versionOf(needed);
  return (
    !version ||
    (installed !== undefined &&
      compareStudioChatVersions(version, installed) > 0)
  );
};

/** A catalog file's rows and when they were fetched, or nothing. */
const catalogOf = (file: string) => {
  try {
    if (fs.statSync(file).size > MOST_BYTES) {
      return undefined;
    }
    const raw: unknown = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (
      !isRecord(raw) ||
      typeof raw.fetchedAt !== 'number' ||
      !Number.isFinite(raw.fetchedAt) ||
      !isRecord(raw.catalog) ||
      !isRecord(raw.catalog.config) ||
      !Array.isArray(raw.catalog.config.models)
    ) {
      return undefined;
    }
    return {
      fetchedAt: raw.fetchedAt,
      rows: raw.catalog.config.models.filter(isRecord),
    };
  } catch {
    return undefined;
  }
};

type TCatalog = ReturnType<typeof catalogOf>;

/**
 * The older versions in the newest catalog of `place`'s organization, in
 * the catalog's order: its `overflow` rows, each an exact model Claude Code
 * takes, under the catalog's own name for it, and none that needs a newer
 * Claude Code than the one installed (`installed`, "2.1.332"). Nothing for
 * no catalog.
 */
export const readOlderVersions = (
  place: ICatalogPlace,
  installed?: string,
): IStudioChatLine[] => {
  let names: string[];
  try {
    names = fs.readdirSync(place.folder);
  } catch {
    return [];
  }
  const newest = names
    .filter((name) => isCatalogFileOf(place.organization, name))
    .map((name) => catalogOf(path.join(place.folder, name)))
    .reduce<TCatalog>(
      (best, next) =>
        next && (!best || next.fetchedAt > best.fetchedAt) ? next : best,
      undefined,
    );
  const running = versionOf(installed);
  return (newest?.rows ?? []).flatMap((row) => {
    const shown = nameOf(row.name);
    return row.section === 'overflow' &&
      typeof row.id === 'string' &&
      isStudioChatExactModel(row.id) &&
      shown &&
      !needsNewer(row.min_claude_code_version, running)
      ? [{ id: row.id, name: shown }]
      : [];
  });
};
