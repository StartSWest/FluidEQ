import { createHash } from 'crypto';
import fs from 'fs';
import path from 'path';
import type { GraphStyle } from '../../common/graphStyles';
import { parseMemberScenePayload } from '../../common/memberSceneFile';
import {
  checkMemberScene,
  memberLookId,
  parseMemberLookId,
} from '../../common/memberScenes';
import {
  isScenePackEnvelope,
  type IScenePack,
  type IScenePackEnvelope,
  type TLocalizedName,
} from '../../common/scenePacks';
import type { ISceneWave } from '../../common/sceneWave';
import { verifyMemberSceneEnvelope } from '../scenePackVerify';
import { readSceneCache, writeSceneCache } from '../sceneCacheFile';

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
  /** Made by the account it is stored under, rather than sent by someone. */
  own: boolean;
  /** For an imported scene: the name on its author's profile, if they had one. */
  authorName?: string | null;
}

export interface IMemberSceneStore {
  list(): IMemberSceneSummary[];
  /** The whole pack, checked afresh, or nothing if it is not fit to run. */
  load(authorId: string, packId: string): IScenePack | undefined;
  /** Keeps a scene the member made. Throws if it breaks any rule. */
  save(authorId: string, pack: IScenePack): IMemberSceneSummary;
  /**
   * Keeps a scene another member exported. Throws unless the envelope
   * verifies against the member key and its pack passes every rule.
   */
  saveImported(envelope: IScenePackEnvelope): IMemberSceneSummary;
  remove(authorId: string, packId: string): boolean;
  /** The maker's block list, as fingerprints; replaces the one held. */
  setBlocked(fingerprints: readonly string[]): void;
  isBlocked(authorId: string, packId: string): boolean;
}

export interface IMemberSceneStoreOptions {
  userDataDir: string;
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
        const checked = checkMemberScene(record.pack);
        if (!checked.ok || checked.pack.id !== packId) {
          logger?.warn(
            `Member scene ${packId} no longer passes the member rules and is not offered.`,
          );
          return undefined;
        }
        return checked.pack;
      },
    );
  };

  const readImported = (
    authorId: string,
    packId: string,
  ): { pack: IScenePack; authorName: string | null } | undefined => {
    return readSceneCache(
      importedFile(authorId, packId),
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
          parsed.pack.id !== packId
        ) {
          logger?.warn(
            `Imported scene ${packId} no longer verifies and is not offered.`,
          );
          return undefined;
        }
        return { pack: parsed.pack, authorName: parsed.author.name };
      },
    );
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
      revision: createHash('sha256').update(JSON.stringify(pack)).digest('hex'),
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
      const own = held(ownRoot).flatMap(({ authorId, packId }) => {
        const pack = readOwn(authorId, packId);
        return pack && !isBlocked(authorId, packId)
          ? [summarise(authorId, pack)]
          : [];
      });
      const imported = held(importedRoot).flatMap(({ authorId, packId }) => {
        const found = readImported(authorId, packId);
        return found && !isBlocked(authorId, packId)
          ? [summarise(authorId, found.pack, { authorName: found.authorName })]
          : [];
      });
      return [...own, ...imported];
    },
    load: (authorId, packId) => {
      if (!validRef(authorId, packId) || isBlocked(authorId, packId)) {
        return undefined;
      }
      return readOwn(authorId, packId) ?? readImported(authorId, packId)?.pack;
    },
    save: (authorId, pack) => {
      if (!validRef(authorId, pack.id)) {
        throw new Error('Not a member scene id.');
      }
      const checked = checkMemberScene(pack);
      if (!checked.ok) {
        throw new Error(
          `Member scene refused: ${checked.problems
            .map((problem) => problem.code)
            .join(', ')}`,
        );
      }
      writeSceneCache(
        ownFile(authorId, pack.id),
        `own/${authorId}/${pack.id}`,
        {
          schema: RECORD_SCHEMA,
          authorId,
          savedAt: new Date().toISOString(),
          pack: checked.pack,
        },
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
      writeSceneCache(
        importedFile(author.id, pack.id),
        `imported/${author.id}/${pack.id}`,
        envelope,
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
      const existing = targets.filter((target) => fs.existsSync(target));
      existing.forEach((target) => fs.rmSync(target));
      return existing.length > 0;
    },
    setBlocked: (fingerprints) => {
      blocked = new Set(
        fingerprints.filter((print) => /^[0-9a-f]{64}$/.test(print)),
      );
    },
    isBlocked,
  };
};
