import { createHash } from 'crypto';
import fs from 'fs';
import path from 'path';
import type { GraphStyle } from '../../common/graphStyles';
import { parseMemberScenePayload } from '../../common/memberSceneFile';
import {
  checkMemberScene,
  memberLookId,
  parseMemberLookId,
  readMemberScene,
} from '../../common/memberScenes';
import {
  isScenePackEnvelope,
  type IScenePack,
  type IScenePackEnvelope,
  type TLocalizedName,
} from '../../common/scenePacks';
import storedScenePack, { storedFormOf } from '../../common/sceneStoredPack';
import type { ISceneWave } from '../../common/sceneWave';
import { verifyMemberSceneEnvelope } from '../scenePackVerify';
import writeFileAtomically from '../atomicWrite';
import { logSceneFailure } from '../sceneFailures';
import { readSceneCache, writeSceneCache } from '../sceneCacheFile';
import {
  forgetKeptVersions,
  keepSavedVersion,
  keptVersionFile,
  keptVersionsOf,
  replaceKeepingVersion,
  type IVersionPins,
} from '../keptVersions';
import { createSceneSummaryCache } from '../sceneSummaryCache';

/**
 * Members' scenes, as they sit on this computer.
 *
 * Two kinds, side by side:
 *
 * - OWN: `<userData>/member-scenes/own/<authorId>/<packId>.json`, written when
 *   the member presses "Add to my looks". Not signed — their own work on their
 *   own machine — but not trusted either: every load runs every member rule
 *   again, so a file edited by anything else is held to the Studio's checks.
 * - IMPORTED: `<userData>/member-scenes/imported/<authorId>/<packId>.json`,
 *   the signed envelope another member exported. Verified against the MEMBER
 *   key on every load, then held to every rule again, exactly as the Plus
 *   looks' cache is — the folder is a convenience, not a trust boundary.
 * Both playback copies are OS-encrypted at rest. Legacy files migrate on read;
 * the source projects in Studio are separate and remain editable by their maker.
 *
 * A scene the maker has blocked is neither listed nor loaded, whichever kind
 * it is. Nothing is deleted for failing a check: a member's own work has no
 * other copy the app knows of, and an imported one may be unblocked.
 */

const DIRECTORY = 'member-scenes';
const OWN_DIRECTORY = 'own';
const IMPORTED_DIRECTORY = 'imported';
const RECORD_SCHEMA = 1;

export interface IMemberSceneSummary {
  lookId: string;
  authorId: string;
  packId: string;
  version: number;
  revision?: string;
  names: TLocalizedName;
  fallbackStyle: GraphStyle;
  swatch: string[];
  spectrumRange?: readonly [number, number];
  /** The wave its author built it around, when the pack names one. */
  wave?: ISceneWave;
  /**
   * From the store: built on this computer by the account it is stored
   * under, rather than installed or sent. Through `visibleScenes`: made by
   * the account asking, wherever the copy came from.
   */
  own: boolean;
  /** For an imported scene: the name on its author's profile, if they had one. */
  authorName?: string | null;
}

export interface IMemberSceneStore {
  list(): IMemberSceneSummary[];
  /**
   * The whole pack, checked afresh, or nothing if it is not fit to run: the
   * version the look plays, which is an earlier one while it is pinned.
   */
  load(authorId: string, packId: string): IScenePack | undefined;
  /** The newest version held, whatever plays: what an update is measured against. */
  newest(authorId: string, packId: string): IScenePack | undefined;
  /** Keeps a scene the member made. Throws if it breaks any rule. */
  save(authorId: string, pack: IScenePack): IMemberSceneSummary;
  /**
   * Keeps a scene another member exported. Throws unless the envelope
   * verifies against the member key and its pack passes every rule.
   */
  saveImported(envelope: IScenePackEnvelope): IMemberSceneSummary;
  remove(authorId: string, packId: string): boolean;
  /**
   * The earlier versions this computer kept of a scene another member made,
   * newest first (`keptVersions.ts`). The member's own are their Studio
   * projects, and keep none here.
   */
  keptVersions(authorId: string, packId: string): number[];
  /**
   * Keeps an earlier version of another member's scene, saved from the
   * server, beside the newest held and never in its place. True once that
   * version is on this computer (the newest held already is); false for
   * anything that does not verify against the member key as exactly
   * `version` of that author's `packId`, a scene not held, or a blocked one.
   */
  keepSaved(
    envelope: IScenePackEnvelope,
    authorId: string,
    packId: string,
    version: number,
  ): boolean;
  /** The maker's block list, as fingerprints; replaces the one held. */
  setBlocked(fingerprints: readonly string[]): void;
  isBlocked(authorId: string, packId: string): boolean;
}

export interface IMemberSceneStoreOptions {
  userDataDir: string;
  /** Which earlier version a look plays (`keptVersions.ts`); none, the newest. */
  pins?: IVersionPins;
  logger?: { warn(message: string): void };
}

/**
 * What the block list names a scene by: every version of it, and neither the
 * author nor the scene on its own. The server computes the same thing.
 */
export const memberSceneFingerprint = (authorId: string, packId: string) =>
  createHash('sha256')
    .update(`${authorId.toLowerCase()}:${packId}`, 'utf8')
    .digest('hex');

/** What tells two copies of one version apart: the pack as the looks hold it. */
const revisionOf = (pack: IScenePack) =>
  createHash('sha256').update(JSON.stringify(pack)).digest('hex');

/**
 * The revision a pack would have once kept in the looks, without keeping it:
 * checked as `save` checks it, written and read back as the looks read it,
 * so a pack equal to the kept one gives the kept one's revision exactly.
 * Nothing for a pack the looks would refuse.
 */
export const keptRevisionOf = (pack: IScenePack): string | undefined => {
  const checked = checkMemberScene(storedScenePack(pack));
  if (!checked.ok) {
    return undefined;
  }
  const kept = readMemberScene(
    JSON.parse(JSON.stringify(storedScenePack(checked.pack))),
  );
  return kept ? revisionOf(kept) : undefined;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Both ids, checked together the way a look id is. */
const validRef = (authorId: string, packId: string) =>
  parseMemberLookId(memberLookId(authorId, packId)) !== undefined;

const listDirectory = (directory: string): string[] => {
  try {
    return fs.readdirSync(directory);
  } catch {
    return [];
  }
};

export const createMemberSceneStore = ({
  userDataDir,
  pins,
  logger,
}: IMemberSceneStoreOptions): IMemberSceneStore => {
  const root = path.join(userDataDir, DIRECTORY);
  const ownRoot = path.join(root, OWN_DIRECTORY);
  const importedRoot = path.join(root, IMPORTED_DIRECTORY);
  const ownFile = (authorId: string, packId: string) =>
    path.join(ownRoot, authorId, `${packId}.json`);
  const importedFile = (authorId: string, packId: string) =>
    path.join(importedRoot, authorId, `${packId}.json`);

  let blocked = new Set<string>();

  /** Each file's summary while it is unchanged (`sceneSummaryCache.ts`). The
   * block list is applied as the list is made, never kept in here. */
  const summaries = createSceneSummaryCache<IMemberSceneSummary>();

  const isBlocked = (authorId: string, packId: string) =>
    blocked.has(memberSceneFingerprint(authorId, packId));

  const readOwn = (
    authorId: string,
    packId: string,
  ): IScenePack | undefined => {
    return readSceneCache(
      ownFile(authorId, packId),
      `own/${authorId}/${packId}`,
      (record) => {
        if (!isRecord(record) || record.authorId !== authorId) {
          return undefined;
        }
        // Read the way a listener's copy is read, not the way the Studio
        // reads the author's: this file was written by whatever FluidEQ the
        // member was running then, which may be newer than this one.
        // A copy written in the built layout before 2026-11-11 is healed
        // here, so it plays again without being added again.
        const stored = storedFormOf(record.pack);
        const pack = readMemberScene(stored);
        if (!pack || pack.id !== packId) {
          logSceneFailure(
            {
              lookId: memberLookId(authorId, packId),
              surface: 'looks',
              reason: 'read-refused',
              detail: 'no longer passes the member rules; not offered',
            },
            logger,
          );
          return undefined;
        }
        if (stored !== record.pack) {
          logSceneFailure(
            {
              lookId: memberLookId(authorId, packId),
              version: String(pack.version),
              surface: 'looks',
              reason: 'healed-disk',
              detail: 'read from the built layout',
            },
            logger,
          );
        }
        return pack;
      },
    );
  };

  const readImported = (
    authorId: string,
    packId: string,
    version?: number,
  ): { pack: IScenePack; authorName: string | null } | undefined => {
    const source =
      version === undefined
        ? importedFile(authorId, packId)
        : keptVersionFile(importedFile(authorId, packId), version);
    return readSceneCache(
      source,
      `imported/${authorId}/${packId}`,
      (envelope) => {
        if (!isScenePackEnvelope(envelope)) {
          return undefined;
        }
        const payload = verifyMemberSceneEnvelope(envelope);
        const parsed = payload ? parseMemberScenePayload(payload) : null;
        if (
          !parsed ||
          parsed.author.id !== authorId ||
          parsed.pack.id !== packId ||
          (version !== undefined && parsed.pack.version !== version)
        ) {
          logSceneFailure(
            {
              lookId: memberLookId(authorId, packId),
              ...(version !== undefined ? { version: String(version) } : {}),
              surface: 'looks',
              reason: 'signature-refused',
              detail: 'no longer verifies; not offered',
            },
            logger,
          );
          return undefined;
        }
        return { pack: parsed.pack, authorName: parsed.author.name };
      },
    );
  };

  /**
   * Writes a scene's file and holds the write to what was meant (Ivan,
   * 2026-11-11: "we cannot have missing data"): the copy is read back
   * through the very reader the looks use, and unless the scene that comes
   * back is the scene being saved, field for field, the file is put back as
   * it was and the save fails, loudly. A poorer copy is never left in the
   * place of a good one: that is how a palette scene went on playing as a
   * standard look with nothing saying why.
   */
  const writeWhole = (
    file: string,
    meant: IScenePack,
    write: () => void,
    readBack: () => IScenePack | undefined,
  ) => {
    let before: Buffer | undefined;
    try {
      before = fs.readFileSync(file);
    } catch {
      before = undefined;
    }
    write();
    const back = readBack();
    if (back && JSON.stringify(back) === JSON.stringify(meant)) {
      return;
    }
    if (before) {
      writeFileAtomically(file, before);
    } else {
      fs.rmSync(file, { force: true });
    }
    summaries.forget(file);
    logger?.warn(
      `Scene ${meant.id} v${meant.version} did not read back as it was saved; the copy before it was kept.`,
    );
    throw new Error('The scene did not read back as it was saved.');
  };

  /** The version a look is pinned to, while this computer still has it. */
  const pinnedOf = (authorId: string, packId: string): number | undefined => {
    const version = pins?.pinned(memberLookId(authorId, packId));
    return version !== undefined &&
      keptVersionsOf(importedFile(authorId, packId)).includes(version)
      ? version
      : undefined;
  };

  const summarise = (
    authorId: string,
    pack: IScenePack,
    imported?: { authorName: string | null },
  ): IMemberSceneSummary => {
    const lookId = memberLookId(authorId, pack.id);
    return {
      lookId,
      authorId,
      packId: pack.id,
      version: pack.version,
      revision: revisionOf(pack),
      names: pack.names,
      fallbackStyle: pack.fallbackStyle,
      swatch: pack.swatch,
      ...(pack.spectrumRange ? { spectrumRange: pack.spectrumRange } : {}),
      ...(pack.wave ? { wave: pack.wave } : {}),
      own: !imported,
      ...(imported ? { authorName: imported.authorName } : {}),
    };
  };

  /** Every `<authorId>/<packId>.json` under a root, ids checked. */
  const held = (base: string) =>
    listDirectory(base).flatMap((authorId) =>
      listDirectory(path.join(base, authorId))
        .filter((name) => name.endsWith('.json'))
        .map((name) => ({ authorId, packId: name.slice(0, -'.json'.length) }))
        .filter(({ packId }) => validRef(authorId, packId)),
    );

  return {
    list: () => {
      // Read before the block list is asked, blocked or not: reading is what
      // moves a legacy copy to the encrypted format, blocked copies included.
      const own = held(ownRoot).flatMap(({ authorId, packId }) => {
        const summary = summaries.get(ownFile(authorId, packId), () => {
          const pack = readOwn(authorId, packId);
          return pack && summarise(authorId, pack);
        });
        return summary && !isBlocked(authorId, packId) ? [summary] : [];
      });
      const imported = held(importedRoot).flatMap(({ authorId, packId }) => {
        const pinned = pinnedOf(authorId, packId);
        const source =
          pinned === undefined
            ? importedFile(authorId, packId)
            : keptVersionFile(importedFile(authorId, packId), pinned);
        const summary = summaries.get(source, () => {
          const found = readImported(authorId, packId, pinned);
          return (
            found &&
            summarise(authorId, found.pack, { authorName: found.authorName })
          );
        });
        return summary && !isBlocked(authorId, packId) ? [summary] : [];
      });
      return [...own, ...imported];
    },
    load: (authorId, packId) => {
      if (!validRef(authorId, packId) || isBlocked(authorId, packId)) {
        return undefined;
      }
      return (
        readOwn(authorId, packId) ??
        readImported(authorId, packId, pinnedOf(authorId, packId))?.pack
      );
    },
    newest: (authorId, packId) =>
      validRef(authorId, packId) && !isBlocked(authorId, packId)
        ? (readOwn(authorId, packId) ?? readImported(authorId, packId)?.pack)
        : undefined,
    save: (authorId, pack) => {
      if (!validRef(authorId, pack.id)) {
        throw new Error('Not a member scene id.');
      }
      // Checked, written and read in the stored layout, the one every reader
      // parses. A built pack keeps its palettes, colours and choice options
      // apart from `params`; checked or written that way they were dropped,
      // and Ivan's palette scenes failed on the graph with "'uPalette_colours'
      // : undeclared identifier" while the Studio, reading the folder, played
      // them (2026-11-11).
      const checked = checkMemberScene(storedScenePack(pack));
      if (!checked.ok) {
        throw new Error(
          `Member scene refused: ${checked.problems
            .map((problem) => problem.code)
            .join(', ')}`,
        );
      }
      summaries.forget(ownFile(authorId, pack.id));
      writeWhole(
        ownFile(authorId, pack.id),
        checked.pack,
        () =>
          writeSceneCache(
            ownFile(authorId, pack.id),
            `own/${authorId}/${pack.id}`,
            {
              schema: RECORD_SCHEMA,
              authorId,
              savedAt: new Date().toISOString(),
              pack: storedScenePack(checked.pack),
            },
          ),
        () => readOwn(authorId, pack.id),
      );
      return summarise(authorId, checked.pack);
    },
    saveImported: (envelope) => {
      const payload = verifyMemberSceneEnvelope(envelope);
      const parsed = payload ? parseMemberScenePayload(payload) : null;
      if (!parsed) {
        throw new Error('Not a member scene signed by FluidEQ.');
      }
      const { author, pack } = parsed;
      if (!validRef(author.id, pack.id)) {
        throw new Error('Not a member scene id.');
      }
      summaries.forget(importedFile(author.id, pack.id));
      // The version being replaced stays playable on this computer.
      const current = readImported(author.id, pack.id)?.pack;
      replaceKeepingVersion(
        importedFile(author.id, pack.id),
        current && current.version < pack.version ? current.version : undefined,
        () =>
          writeWhole(
            importedFile(author.id, pack.id),
            pack,
            () =>
              writeSceneCache(
                importedFile(author.id, pack.id),
                `imported/${author.id}/${pack.id}`,
                envelope,
              ),
            () => readImported(author.id, pack.id)?.pack,
          ),
      );
      return summarise(author.id, pack, { authorName: author.name });
    },
    remove: (authorId, packId) => {
      if (!validRef(authorId, packId)) {
        return false;
      }
      const targets = [
        ownFile(authorId, packId),
        importedFile(authorId, packId),
      ];
      targets.forEach((target) => summaries.forget(target));
      const existing = targets.filter((target) => fs.existsSync(target));
      existing.forEach((target) => fs.rmSync(target));
      forgetKeptVersions(importedFile(authorId, packId));
      return existing.length > 0;
    },
    keptVersions: (authorId, packId) =>
      validRef(authorId, packId)
        ? keptVersionsOf(importedFile(authorId, packId))
        : [],
    keepSaved: (envelope, authorId, packId, version) => {
      if (
        !validRef(authorId, packId) ||
        isBlocked(authorId, packId) ||
        !isScenePackEnvelope(envelope)
      ) {
        return false;
      }
      const payload = verifyMemberSceneEnvelope(envelope);
      const parsed = payload ? parseMemberScenePayload(payload) : null;
      if (
        !parsed ||
        parsed.author.id !== authorId ||
        parsed.pack.id !== packId ||
        parsed.pack.version !== version
      ) {
        logger?.warn(`Saved scene ${packId} v${version} did not verify.`);
        return false;
      }
      // Kept beside the copy this computer imported. The member's own scene
      // is their Studio project, which keeps its own history, and plays no
      // version from here.
      // Above the newest held too: a copy the update has not reached yet
      // keeps the saved one beside it, and the update then keeps this one.
      const newest = readImported(authorId, packId)?.pack;
      if (!newest) {
        return false;
      }
      if (version === newest.version) {
        return true;
      }
      const file = importedFile(authorId, packId);
      summaries.forget(keptVersionFile(file, version));
      keepSavedVersion(file, version, (target) =>
        writeSceneCache(target, `imported/${authorId}/${packId}`, envelope),
      );
      return true;
    },
    setBlocked: (fingerprints) => {
      blocked = new Set(
        fingerprints.filter((print) => /^[0-9a-f]{64}$/.test(print)),
      );
    },
    isBlocked,
  };
};
