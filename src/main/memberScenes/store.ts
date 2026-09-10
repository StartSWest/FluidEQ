import fs from 'fs';
import path from 'path';
import { PRODUCT_VERSION } from '../../common/branding';
import type { GraphStyle } from '../../common/graphStyles';
import {
  checkMemberScene,
  memberLookId,
  parseMemberLookId,
} from '../../common/memberScenes';
import type { IScenePack, TLocalizedName } from '../../common/scenePacks';
import writeFileAtomically from '../atomicWrite';
import type { TSceneFailure } from '../scenePackStore';

/**
 * The scenes a member made, as they sit on this computer.
 *
 * `<userData>/member-scenes/own/<authorId>/<packId>.json`, one file per scene,
 * written when the member presses "Add to my looks". They are not signed —
 * they are the member's own work on the member's own machine — but they are
 * not trusted either: every load runs every member rule again, so a file
 * edited by hand, or by anything else with access to the folder, is held to
 * exactly the same checks as the Studio's own build.
 *
 * A scene that fails those checks is not offered, and it is NOT deleted. The
 * official cache deletes what fails verification because a fresh copy is one
 * download away; a member's work has no other copy the app knows of.
 */

const DIRECTORY = 'member-scenes';
const OWN_DIRECTORY = 'own';
const QUARANTINE_FILE = 'quarantine.json';
const RECORD_SCHEMA = 1;

export interface IMemberSceneSummary {
  lookId: string;
  authorId: string;
  packId: string;
  version: number;
  names: TLocalizedName;
  fallbackStyle: GraphStyle;
  swatch: string[];
  spectrumRange?: readonly [number, number];
  /** Made by the account it is stored under. Imported scenes arrive in stage 2. */
  own: boolean;
  quarantined?: TSceneFailure;
}

export interface IMemberSceneStore {
  list(): IMemberSceneSummary[];
  /** The whole pack, checked afresh, or nothing if it is not fit to run. */
  load(authorId: string, packId: string): IScenePack | undefined;
  /** Keeps a scene the member made. Throws if it breaks any rule. */
  save(authorId: string, pack: IScenePack): IMemberSceneSummary;
  remove(authorId: string, packId: string): boolean;
  quarantine(authorId: string, packId: string, reason: TSceneFailure): void;
  release(authorId: string, packId: string): void;
}

export interface IMemberSceneStoreOptions {
  userDataDir: string;
  logger?: { warn(message: string): void };
  /** The build a quarantine is scoped to. Defaults to this one. */
  appVersion?: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Both ids, checked together the way a look id is. */
const validRef = (authorId: string, packId: string) =>
  parseMemberLookId(memberLookId(authorId, packId)) !== undefined;

export const createMemberSceneStore = ({
  userDataDir,
  logger,
  appVersion = PRODUCT_VERSION,
}: IMemberSceneStoreOptions): IMemberSceneStore => {
  const root = path.join(userDataDir, DIRECTORY);
  const ownRoot = path.join(root, OWN_DIRECTORY);
  const quarantinePath = path.join(root, QUARANTINE_FILE);
  const fileOf = (authorId: string, packId: string) =>
    path.join(ownRoot, authorId, `${packId}.json`);

  let quarantine: Record<string, string> = {};
  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(quarantinePath, 'utf8'));
    if (isRecord(parsed)) {
      quarantine = Object.fromEntries(
        Object.entries(parsed).filter(
          (entry): entry is [string, string] => typeof entry[1] === 'string',
        ),
      );
    }
  } catch {
    // No quarantine yet, or one that cannot be read: nothing is held back.
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

  const readChecked = (
    authorId: string,
    packId: string,
  ): IScenePack | undefined => {
    if (!validRef(authorId, packId)) {
      return undefined;
    }
    let record: unknown;
    try {
      record = JSON.parse(fs.readFileSync(fileOf(authorId, packId), 'utf8'));
    } catch {
      return undefined;
    }
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

  const summarise = (
    authorId: string,
    pack: IScenePack,
  ): IMemberSceneSummary => {
    const lookId = memberLookId(authorId, pack.id);
    const quarantined = quarantineOf(lookId);
    return {
      lookId,
      authorId,
      packId: pack.id,
      version: pack.version,
      names: pack.names,
      fallbackStyle: pack.fallbackStyle,
      swatch: pack.swatch,
      ...(pack.spectrumRange ? { spectrumRange: pack.spectrumRange } : {}),
      own: true,
      ...(quarantined ? { quarantined } : {}),
    };
  };

  const listDirectory = (directory: string): string[] => {
    try {
      return fs.readdirSync(directory);
    } catch {
      return [];
    }
  };

  const release = (authorId: string, packId: string) => {
    const lookId = memberLookId(authorId, packId);
    if (quarantine[lookId] !== undefined) {
      delete quarantine[lookId];
      saveQuarantine();
    }
  };

  return {
    list: () =>
      listDirectory(ownRoot).flatMap((authorId) =>
        listDirectory(path.join(ownRoot, authorId))
          .filter((name) => name.endsWith('.json'))
          .map((name) => name.slice(0, -'.json'.length))
          .flatMap((packId) => {
            const pack = readChecked(authorId, packId);
            return pack ? [summarise(authorId, pack)] : [];
          }),
      ),
    load: (authorId, packId) => {
      if (quarantineOf(memberLookId(authorId, packId))) {
        return undefined;
      }
      return readChecked(authorId, packId);
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
        fileOf(authorId, pack.id),
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
    remove: (authorId, packId) => {
      if (!validRef(authorId, packId)) {
        return false;
      }
      const target = fileOf(authorId, packId);
      if (!fs.existsSync(target)) {
        return false;
      }
      fs.rmSync(target);
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
  };
};
