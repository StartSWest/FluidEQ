import { createHash } from 'crypto';
import fs from 'fs';
import path from 'path';
import { PRODUCT_VERSION } from '../../common/branding';
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
import writeFileAtomically from '../atomicWrite';
import { verifyMemberSceneEnvelope } from '../scenePackVerify';
import type { TSceneFailure } from '../scenePackStore';

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
 *
 * A scene the maker has blocked is neither listed nor loaded, whichever kind
 * it is. Nothing is deleted for failing a check: a member's own work has no
 * other copy the app knows of, and an imported one may be unblocked.
 */

const DIRECTORY = 'member-scenes';
const OWN_DIRECTORY = 'own';
const IMPORTED_DIRECTORY = 'imported';
const QUARANTINE_FILE = 'quarantine.json';
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
  /** Made by the account it is stored under, rather than sent by someone. */
  own: boolean;
  /** For an imported scene: the name on its author's profile, if they had one. */
  authorName?: string | null;
  quarantined?: TSceneFailure;
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
  quarantine(authorId: string, packId: string, reason: TSceneFailure): void;
  release(authorId: string, packId: string): void;
  /** The maker's block list, as fingerprints; replaces the one held. */
  setBlocked(fingerprints: readonly string[]): void;
  isBlocked(authorId: string, packId: string): boolean;
}

export interface IMemberSceneStoreOptions {
  userDataDir: string;
  logger?: { warn(message: string): void };
  /** The build a quarantine is scoped to. Defaults to this one. */
  appVersion?: string;
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

const readJson = (file: string): unknown => {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return undefined;
  }
};

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
  appVersion = PRODUCT_VERSION,
}: IMemberSceneStoreOptions): IMemberSceneStore => {
  const root = path.join(userDataDir, DIRECTORY);
  const ownRoot = path.join(root, OWN_DIRECTORY);
  const importedRoot = path.join(root, IMPORTED_DIRECTORY);
  const quarantinePath = path.join(root, QUARANTINE_FILE);
  const ownFile = (authorId: string, packId: string) =>
    path.join(ownRoot, authorId, `${packId}.json`);
  const importedFile = (authorId: string, packId: string) =>
    path.join(importedRoot, authorId, `${packId}.json`);

  let blocked = new Set<string>();
  let quarantine: Record<string, string> = {};
  const storedQuarantine = readJson(quarantinePath);
  if (isRecord(storedQuarantine)) {
    quarantine = Object.fromEntries(
      Object.entries(storedQuarantine).filter(
        (entry): entry is [string, string] => typeof entry[1] === 'string',
      ),
    );
  }

  /** Honoured only under the build that wrote it, as for official scenes. */
  const quarantineOf = (lookId: string): TSceneFailure | undefined => {
    const entry = quarantine[lookId];
    if (!entry) {
      return undefined;
    }
    const at = entry.lastIndexOf('@');
    if (at < 0 || entry.slice(at + 1) !== appVersion) {
      return undefined;
    }
    const reason = entry.slice(0, at);
    return reason === 'compile' || reason === 'context-lost'
      ? reason
      : undefined;
  };

  const saveQuarantine = () =>
    writeFileAtomically(quarantinePath, JSON.stringify(quarantine));

  const isBlocked = (authorId: string, packId: string) =>
    blocked.has(memberSceneFingerprint(authorId, packId));

  const readOwn = (
    authorId: string,
    packId: string,
  ): IScenePack | undefined => {
    const record = readJson(ownFile(authorId, packId));
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
  };

  const readImported = (
    authorId: string,
    packId: string,
  ): { pack: IScenePack; authorName: string | null } | undefined => {
    const envelope = readJson(importedFile(authorId, packId));
    if (!isScenePackEnvelope(envelope)) {
      return undefined;
    }
    const payload = verifyMemberSceneEnvelope(envelope);
    const parsed = payload ? parseMemberScenePayload(payload) : null;
    if (!parsed || parsed.author.id !== authorId || parsed.pack.id !== packId) {
      logger?.warn(
        `Imported scene ${packId} no longer verifies and is not offered.`,
      );
      return undefined;
    }
    return { pack: parsed.pack, authorName: parsed.author.name };
  };

  const summarise = (
    authorId: string,
    pack: IScenePack,
    imported?: { authorName: string | null },
  ): IMemberSceneSummary => {
    const lookId = memberLookId(authorId, pack.id);
    const quarantined = quarantineOf(lookId);
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
      own: !imported,
      ...(imported ? { authorName: imported.authorName } : {}),
      ...(quarantined ? { quarantined } : {}),
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

  const release = (authorId: string, packId: string) => {
    const lookId = memberLookId(authorId, packId);
    if (quarantine[lookId] !== undefined) {
      delete quarantine[lookId];
      saveQuarantine();
    }
  };

  return {
    list: () => {
      const own = held(ownRoot).flatMap(({ authorId, packId }) => {
        const pack = isBlocked(authorId, packId)
          ? undefined
          : readOwn(authorId, packId);
        return pack ? [summarise(authorId, pack)] : [];
      });
      const imported = held(importedRoot).flatMap(({ authorId, packId }) => {
        const found = isBlocked(authorId, packId)
          ? undefined
          : readImported(authorId, packId);
        return found
          ? [summarise(authorId, found.pack, { authorName: found.authorName })]
          : [];
      });
      return [...own, ...imported];
    },
    load: (authorId, packId) => {
      if (
        !validRef(authorId, packId) ||
        isBlocked(authorId, packId) ||
        quarantineOf(memberLookId(authorId, packId))
      ) {
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
      writeFileAtomically(
        ownFile(authorId, pack.id),
        JSON.stringify({
          schema: RECORD_SCHEMA,
          authorId,
          savedAt: new Date().toISOString(),
          pack: checked.pack,
        }),
      );
      // A new save is a new chance: it may be the fix for what failed.
      release(authorId, pack.id);
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
      writeFileAtomically(
        importedFile(author.id, pack.id),
        JSON.stringify(envelope),
      );
      release(author.id, pack.id);
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
      if (existing.length === 0) {
        return false;
      }
      release(authorId, packId);
      return true;
    },
    quarantine: (authorId, packId, reason) => {
      if (!validRef(authorId, packId)) {
        return;
      }
      quarantine[memberLookId(authorId, packId)] = `${reason}@${appVersion}`;
      saveQuarantine();
    },
    release,
    setBlocked: (fingerprints) => {
      blocked = new Set(
        fingerprints.filter((print) => /^[0-9a-f]{64}$/.test(print)),
      );
    },
    isBlocked,
  };
};
