import fs from 'fs';
import { createHash } from 'crypto';
import path from 'path';
import {
  isScenePackEnvelope,
  parseScenePackPayload,
  type IScenePack,
  type IScenePackEnvelope,
} from '../common/scenePacks';
import { SCENE_CONTRACT_VERSION } from '../common/sceneUniformContract';
import { PRODUCT_VERSION } from '../common/branding';
import { verifyScenePackEnvelope } from './scenePackVerify';
import { readSceneCache, writeSceneCache } from './sceneCacheFile';

/**
 * Premium looks on disk, and how they get there.
 *
 * VERIFIED ON EVERY READ, NOT ONLY ON DOWNLOAD. Verifying once when a pack
 * arrives and trusting the cache thereafter means anybody who edits the cached
 * file gets arbitrary GLSL into the GPU path with our name on it. One Ed25519
 * check is tens of microseconds; per pack per launch it is free, and it makes
 * the cache a convenience rather than a trust boundary.
 *
 * The signed envelope is encrypted with the OS key store before reaching disk.
 * Legacy copies are verified and migrated atomically on read. This protects
 * files at rest, not source used by the WebGL renderer in memory. An OS reinstall
 * can require downloading again; unavailable keys never delete an offline copy.
 *
 * OFFLINE KEEPS WORKING. A network failure leaves every cached pack in place
 * and playable; nothing here deletes on a failed fetch. What a lapsed
 * subscription does about the picker is the renderer's business — this module
 * answers "which packs do we hold" and "are they genuine", nothing more.
 */

const DIRECTORY = 'scene-packs';
const PACKS_DIRECTORY = 'packs';
const REJECTED_FILE = 'rejected.json';
const QUARANTINE_FILE = 'quarantine.json';
const REMOVED_FILE = 'removed.json';

export type TSceneFailure = 'compile' | 'context-lost';

export interface IScenePackSummary {
  id: string;
  version: number;
  revision?: string;
  names: IScenePack['names'];
  fallbackStyle: IScenePack['fallbackStyle'];
  swatch: string[];
  spectrumRange?: IScenePack['spectrumRange'];
  /** Set when the renderer has reported this pack cannot run on this machine. */
  quarantined?: TSceneFailure;
}

/** One row of the server's listing — the envelope, plus what the cache compares. */
export interface IScenePackListing {
  id: string;
  version: number;
  envelope: IScenePackEnvelope;
}

export interface IScenePackStore {
  /** Everything held and verified, minus the shader source. */
  list(): IScenePackSummary[];
  /** The whole pack, verified afresh, or nothing if it is not fit to run. */
  load(id: string): IScenePack | undefined;
  /** Take in listings from the server; returns how many changed. */
  adopt(listings: readonly IScenePackListing[], explicit?: boolean): number;
  /** Remove locally and keep background refreshes from adding it again. */
  remove(id: string): boolean;
  /** The renderer found this one cannot run here. Stop offering it. */
  quarantine(id: string, reason: TSceneFailure): void;
  /** Forget a quarantine — a new version of the pack may have fixed it. */
  release(id: string): void;
}

export interface IScenePackStoreOptions {
  userDataDir: string;
  logger?: { info(message: string): void; warn(message: string): void };
  /** The build a quarantine is scoped to. Defaults to this one. */
  appVersion?: string;
}

const ID = /^[a-z][a-z0-9-]{1,47}$/;

const isStringRecord = (value: unknown): value is Record<string, string> =>
  typeof value === 'object' &&
  value !== null &&
  Object.values(value).every((entry) => typeof entry === 'string');

/** Atomic write, as `remoteAudioCredentials` and the encrypted stores do it. */
const writeAtomically = (filePath: string, contents: string) => {
  const temporaryPath = `${filePath}.tmp`;
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  try {
    fs.writeFileSync(temporaryPath, contents, 'utf8');
    fs.renameSync(temporaryPath, filePath);
  } catch (error) {
    try {
      fs.rmSync(temporaryPath, { force: true });
    } catch {
      // Preserve the original error if cleanup also fails.
    }
    throw error;
  }
};

const readJsonRecord = (filePath: string): Record<string, string> => {
  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return isStringRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
};

export const createScenePackStore = ({
  userDataDir,
  logger,
  appVersion = PRODUCT_VERSION,
}: IScenePackStoreOptions): IScenePackStore => {
  const root = path.join(userDataDir, DIRECTORY);
  const packsDir = path.join(root, PACKS_DIRECTORY);
  const rejectedPath = path.join(root, REJECTED_FILE);
  const quarantinePath = path.join(root, QUARANTINE_FILE);
  const removedPath = path.join(root, REMOVED_FILE);
  let removed = readJsonRecord(removedPath);

  /** Pack id → rejected bytes; a corrected republication can use the same version. */
  let rejected = readJsonRecord(rejectedPath);
  /** Pack id → why the renderer could not run it. */
  let quarantine = readJsonRecord(quarantinePath);

  // Older builds delete anything they cannot parse at *.pack.json. Keep new
  // ciphertext outside that namespace, including when upgrading the first
  // encrypted-cache build which still wrote to the old name.
  const packPath = (id: string) => path.join(packsDir, `${id}.pack.enc`);
  const legacyPath = (id: string) => path.join(packsDir, `${id}.pack.json`);

  /**
   * Read, decrypt and verify one cached envelope. Invalid signed content is
   * removed as before; an unavailable OS key never deletes the offline copy.
   * Newer contracts are encrypted too, but withheld by list/load below.
   */
  const readVerified = (id: string): IScenePack | undefined => {
    const file = fs.existsSync(packPath(id)) ? packPath(id) : legacyPath(id);
    const verified = readSceneCache(
      file,
      `official/${id}`,
      (raw) => {
        if (!isScenePackEnvelope(raw)) {
          fs.rmSync(file, { force: true });
          return undefined;
        }
        const payload = verifyScenePackEnvelope(raw);
        if (!payload) {
          logger?.warn(`Scene pack ${id} failed verification and was removed.`);
          fs.rmSync(file, { force: true });
          return undefined;
        }
        const pack = parseScenePackPayload(payload);
        if (!pack || pack.id !== id) {
          fs.rmSync(file, { force: true });
          return undefined;
        }
        // A pack written for a newer uniform contract would compile against
        // uniforms this build does not declare. Hold it rather than offer it; the
        // next app update will speak its contract.
        return pack;
      },
      packPath(id),
    );
    if (verified && file === packPath(id) && fs.existsSync(legacyPath(id))) {
      // Retry cleanup after an interrupted migration. Never use an older copy
      // to bypass a locked or damaged protected file.
      try {
        fs.rmSync(legacyPath(id));
      } catch {
        logger?.warn(`Scene pack ${id}: legacy cache cleanup will be retried.`);
      }
    }
    return verified;
  };

  const heldIds = (): string[] => {
    try {
      return Array.from(
        new Set(
          fs
            .readdirSync(packsDir)
            .filter((name) => /\.pack\.(json|enc)$/.test(name))
            .map((name) => name.replace(/\.pack\.(json|enc)$/, ''))
            .filter((id) => ID.test(id)),
        ),
      );
    } catch {
      return [];
    }
  };

  /**
   * A quarantine is written as `reason@appVersion` and honoured only under
   * the version that wrote it. A shader that failed on one build's driver
   * bundle may compile on the next, and an entry that outlived the reason for
   * it would hide a working look forever.
   */
  const quarantineOf = (id: string): TSceneFailure | undefined => {
    const entry = quarantine[id];
    if (typeof entry !== 'string') {
      return undefined;
    }
    const at = entry.lastIndexOf('@');
    const reason = at >= 0 ? entry.slice(0, at) : entry;
    const version = at >= 0 ? entry.slice(at + 1) : '';
    if (version !== appVersion) {
      return undefined;
    }
    return reason === 'compile' || reason === 'context-lost'
      ? reason
      : undefined;
  };

  const saveQuarantine = () =>
    writeAtomically(quarantinePath, JSON.stringify(quarantine));
  const saveRejected = () =>
    writeAtomically(rejectedPath, JSON.stringify(rejected));

  return {
    list: () =>
      heldIds()
        .filter((id) => !removed[id])
        .map((id) => readVerified(id))
        .filter((pack): pack is IScenePack => pack !== undefined)
        .filter((pack) => pack.contract <= SCENE_CONTRACT_VERSION)
        .map((pack) => ({
          id: pack.id,
          version: pack.version,
          revision: createHash('sha256')
            .update(JSON.stringify(pack))
            .digest('hex'),
          names: pack.names,
          fallbackStyle: pack.fallbackStyle,
          swatch: pack.swatch,
          ...(pack.spectrumRange ? { spectrumRange: pack.spectrumRange } : {}),
          quarantined: quarantineOf(pack.id),
        })),

    load: (id) => {
      if (!ID.test(id) || removed[id] || quarantineOf(id)) {
        return undefined;
      }
      const pack = readVerified(id);
      return pack && pack.contract <= SCENE_CONTRACT_VERSION ? pack : undefined;
    },

    adopt: (listings, explicit = false) => {
      let changed = 0;
      listings.forEach((listing) => {
        if (!ID.test(listing.id) || !isScenePackEnvelope(listing.envelope)) {
          return;
        }
        if (removed[listing.id] && !explicit) {
          return;
        }
        const fingerprint = createHash('sha256')
          .update(JSON.stringify(listing))
          .digest('hex');
        if (rejected[listing.id] === fingerprint) {
          return;
        }
        const current = readVerified(listing.id);
        if (current && current.version > listing.version) {
          return;
        }
        const payload = verifyScenePackEnvelope(listing.envelope);
        const pack = payload ? parseScenePackPayload(payload) : null;
        if (
          !pack ||
          pack.id !== listing.id ||
          pack.version !== listing.version
        ) {
          logger?.warn(
            `Scene pack ${listing.id} v${listing.version} did not verify; not stored.`,
          );
          rejected = { ...rejected, [listing.id]: fingerprint };
          saveRejected();
          return;
        }
        if (
          !removed[pack.id] &&
          JSON.stringify(current) === JSON.stringify(pack)
        ) {
          return;
        }
        writeSceneCache(
          packPath(pack.id),
          `official/${pack.id}`,
          listing.envelope,
        );
        if (removed[pack.id]) {
          const { [pack.id]: _removed, ...rest } = removed;
          writeAtomically(removedPath, JSON.stringify(rest));
          removed = rest;
        }
        // A new version may well have fixed whatever made the old one fail
        // here, so it gets one more chance.
        if (quarantine[pack.id]) {
          const { [pack.id]: _released, ...rest } = quarantine;
          quarantine = rest;
          saveQuarantine();
        }
        changed += 1;
        logger?.info(`Scene pack ${pack.id} v${pack.version} stored.`);
      });
      return changed;
    },

    remove: (id) => {
      if (!ID.test(id)) {
        return false;
      }
      const next = { ...removed, [id]: 'removed' };
      writeAtomically(removedPath, JSON.stringify(next));
      removed = next;
      fs.rmSync(packPath(id), { force: true });
      fs.rmSync(legacyPath(id), { force: true });
      return true;
    },

    quarantine: (id, reason) => {
      const entry = `${reason}@${appVersion}`;
      if (!ID.test(id) || quarantine[id] === entry) {
        return;
      }
      quarantine = { ...quarantine, [id]: entry };
      saveQuarantine();
      logger?.warn(`Scene pack ${id} quarantined: ${reason}.`);
    },

    release: (id) => {
      if (!quarantine[id]) {
        return;
      }
      const { [id]: _released, ...rest } = quarantine;
      quarantine = rest;
      saveQuarantine();
    },
  };
};
