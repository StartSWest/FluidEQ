/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { ipcMain, type IpcMainInvokeEvent } from 'electron';
import { randomUUID } from 'crypto';
import { heldVersionOf, isPlusCategory } from '../../common/plusGallery';
import type { IScenePack } from '../../common/scenePacks';
import {
  formatPackBytes,
  scenePackSize,
  tooLargeToPublish,
} from '../../common/scenePackSize';
import {
  readVersionNote,
  readVersionNotes,
  versionToPublish,
  type TVersionNotes,
} from '../../common/sceneVersionNote';
import {
  discardScenePreview,
  previewMatchesSource,
  previewPackSha256,
  readPreviewUpload,
  uploadScenePreview,
} from '../plus/scenePreviewApi';
import { readProject } from '../memberScenes/project';
import { setPublishedVersion } from '../memberScenes/projectVersion';
import { writeAgreedTerms } from '../memberScenes/termsAgreement';
import {
  isCardPicture,
  listPublished,
  listVersionFloors,
  MAX_PICTURE_BYTES,
  type IAuthorised,
} from '../plus/galleryApi';
import type { IGalleryAccess } from '../plus/galleryAccess';
import { publishScene } from '../plus/galleryPublishApi';
import {
  createPublishTimeline,
  type TPublishTimeline,
} from '../plus/publishTimeline';
import type { TMineOutcome, TPublishOutcome } from './plusPublishing';

/**
 * The Studio's Publish: the open project read from disk, raised above the
 * version the gallery holds, its clip and cover sent, and the publication
 * made — with where the time went written to the log as one line
 * (`publishTimeline.ts`), and this computer's own copy of one of FluidEQ's
 * scenes fetched as soon as it is out rather than at the next check.
 */

export interface IStudioPublishDeps {
  access: IGalleryAccess;
  userDataDir: string;
  /** The Studio's open project's folder, from its own registration. */
  activeFolder: () => string | undefined;
  /** Whether that project is a FluidEQ scene, opened only to look inside. */
  activeIsInspection: () => boolean;
  /** Whether that project may be published by who is asking (`projectAccess.ts`). */
  mayPublishActive: () => boolean;
  /** A publication recorded an agreement to this version of the Plus terms. */
  onTermsAgreed?: (version: number) => void;
  /** A publication landed: who published, and the pack exactly as it went out. */
  onPublished?: (author: string, pack: IScenePack) => void;
  /** A version went out from this folder (`publishedRecords.ts`). */
  recordPublished?: (folder: string, sceneId: string, version: number) => void;
  /**
   * Fetches this computer's copies of the scenes it holds from the gallery
   * now; true once `sceneId` is held at `version`. One of FluidEQ's own
   * scenes reached its maker's own looks only at the next check — 82 s after
   * Alpine v69 went out, measured — while a member's is kept at once.
   */
  refreshOwnCopy?: (sceneId: string, version: number) => Promise<boolean>;
  logger?: { info(message: string): void; warn(message: string): void };
}

/**
 * This account's published scenes and its version floors, read together: a
 * publication's number is decided from both, and the dialog shows the number
 * the press will send, so the two can never be asked apart.
 */
export const mineOf = async (auth: IAuthorised): Promise<TMineOutcome> => {
  const [listed, floors] = await Promise.all([
    listPublished(auth),
    listVersionFloors(auth),
  ]);
  if (!listed.ok) {
    return listed;
  }
  if (!floors.ok) {
    return floors;
  }
  return { ok: true, scenes: listed.scenes, floors: floors.floors };
};

/**
 * The window's note, cleaned as the server cleans it: the line in every
 * language (2.5's dialog), or the English line alone, as a window that sends
 * one line means it. Null for no note, undefined for one the server would
 * refuse.
 */
export const readPublishedNotes = (
  raw: unknown,
): TVersionNotes | null | undefined => {
  if (typeof raw === 'object' && raw !== null) {
    return readVersionNotes(raw);
  }
  const line = readVersionNote(raw);
  return typeof line === 'string' ? { en: line } : line;
};

/** The page's picture as bytes, whether it arrived as a view or a buffer. */
const pictureBytes = (value: unknown): Uint8Array | undefined => {
  let bytes: Uint8Array | undefined;
  if (value instanceof Uint8Array) {
    bytes = value;
  } else if (value instanceof ArrayBuffer) {
    bytes = new Uint8Array(value);
  }
  return bytes && bytes.length <= MAX_PICTURE_BYTES && isCardPicture(bytes)
    ? bytes
    : undefined;
};

type TPublishOperation = {
  id?: string;
  senderId?: number;
  cancelled: boolean;
  committing: boolean;
  discard?: () => Promise<void>;
};

/** How a publication ended, for its log line. */
const outcomeOf = (outcome: TPublishOutcome) => {
  if (!outcome.ok) {
    return `failed: ${outcome.reason}`;
  }
  return outcome.review === 'pending' ? 'sent for review' : 'published';
};

export const STUDIO_PUBLISH_CHANNELS = [
  'studio-publish',
  'studio-publish-cancel',
] as const;

export const registerStudioPublish = ({
  access,
  userDataDir,
  activeFolder,
  activeIsInspection,
  mayPublishActive,
  onTermsAgreed,
  onPublished,
  recordPublished,
  refreshOwnCopy,
  logger,
}: IStudioPublishDeps) => {
  let currentOperation: TPublishOperation | undefined;
  ipcMain.handle('studio-publish-cancel', (event, id: unknown): boolean => {
    const operation = currentOperation;
    if (
      !operation ||
      typeof id !== 'string' ||
      operation.id !== id ||
      event.sender.id !== operation.senderId ||
      operation.committing
    ) {
      return false;
    }
    operation.cancelled = true;
    operation.discard?.();
    currentOperation = undefined;
    return true;
  });

  /**
   * This computer's copy, fetched now, its time written on a line of its
   * own: the publication is answered without waiting for it.
   */
  const fetchOwnCopy = (sceneId: string, version: number) => {
    if (!refreshOwnCopy) {
      return;
    }
    const timeline = createPublishTimeline();
    timeline.name(sceneId, version);
    refreshOwnCopy(sceneId, version)
      .then((held) => {
        timeline.phase('own copy');
        logger?.info(
          timeline.line(held ? 'this computer holds it' : 'not held yet'),
        );
        return undefined;
      })
      .catch((error: unknown) => {
        logger?.warn(
          `This computer's copy of ${sceneId} v${version} could not be fetched: ${String(error)}`,
        );
      });
  };

  const publish = async (
    event: IpcMainInvokeEvent,
    timeline: TPublishTimeline,
    termsVersion: unknown,
    category: unknown,
    rawPicture: unknown,
    category2: unknown,
    rawNote: unknown,
    rawPreview: unknown,
  ): Promise<TPublishOutcome> => {
    if (currentOperation) {
      return { ok: false, reason: 'refused' };
    }
    const operation: TPublishOperation = {
      id:
        rawPreview &&
        typeof rawPreview === 'object' &&
        'operationId' in rawPreview &&
        typeof rawPreview.operationId === 'string'
          ? rawPreview.operationId
          : undefined,
      senderId: event?.sender?.id,
      cancelled: false,
      committing: false,
    };
    currentOperation = operation;
    const progress = (phase: 'uploading' | 'publishing') => {
      if (operation.id && !event?.sender?.isDestroyed()) {
        event.sender.send('studio-publish-progress', {
          id: operation.id,
          phase,
        });
      }
    };
    let staged: { auth: IAuthorised; uploadId: string } | undefined;
    let attached = false;
    try {
      // The Studio is any signed-in account's, so a project it may not use
      // is either nobody signed in or no project open.
      if (!mayPublishActive()) {
        return {
          ok: false,
          reason: access.accountId() ? 'no-build' : 'signed-out',
        };
      }
      // Cleaned here as the server cleans it; one it would refuse is refused
      // before a picture or a pack is sent.
      const notes = readPublishedNotes(rawNote);
      if (notes === undefined) {
        return { ok: false, reason: 'refused' };
      }
      // Capture the author before any await: switching accounts during the
      // project read must not publish this member's work under the next one.
      const me = access.accountId();
      const folder = activeFolder();
      if (
        !folder ||
        typeof termsVersion !== 'number' ||
        !Number.isInteger(termsVersion) ||
        !isPlusCategory(category) ||
        // Optional, and never the first again — as the server checks too.
        (category2 !== undefined &&
          (!isPlusCategory(category2) || category2 === category))
      ) {
        return { ok: false, reason: 'no-build' };
      }
      if (activeIsInspection()) {
        return { ok: false, reason: 'inspect-only' };
      }
      const picture = pictureBytes(rawPicture);
      if (!picture) {
        return { ok: false, reason: 'no-picture' };
      }
      const preview =
        rawPreview === undefined ? undefined : readPreviewUpload(rawPreview);
      if (rawPreview !== undefined && !preview) {
        return { ok: false, reason: 'preview-invalid' };
      }
      // Read the folder again rather than trusting the last watched build:
      // the press may land between a save and the watcher's rebuild.
      const build = await readProject(folder);
      if (!build.ok) {
        return { ok: false, reason: 'no-build' };
      }
      timeline.name(build.pack.id, build.pack.version);
      // Past what a member may publish (`scenePackSize.ts`): refused here,
      // before anything is sent, as the dialog already says.
      if (tooLargeToPublish(build.pack)) {
        return { ok: false, reason: 'too-large' };
      }
      timeline.phase('read');
      const sceneId = build.pack.id;
      // The account the server will record the agreement for is the one this
      // token belongs to, so the two are taken together.
      const token = await access.auth();
      if (!token || !me || access.accountId() !== me) {
        return { ok: false, reason: 'signed-out' };
      }
      // Every request keeps the server's own timings for the log line.
      const auth = timeline.timed(token);
      // The Studio is any signed-in account's, so a project it may not use
      // is either nobody signed in or no project open.
      if (!mayPublishActive()) {
        return {
          ok: false,
          reason: access.accountId() ? 'no-build' : 'signed-out',
        };
      }
      if (activeFolder() !== folder) {
        return { ok: false, reason: 'no-build' };
      }
      // A scene's content may only change under a higher version, so every
      // publication goes out one above the one the gallery holds — written into
      // the project first, then read back, so the pack that gets signed and
      // the file on disk carry the same number. Sending a raised version
      // without writing it would leave the maker's next build one behind and
      // publishing it again would be refused by the server, which is the rule
      // arriving as a wall. Above the floors too: a scene unpublished and
      // published again goes out above what members may still hold.
      const listed = await mineOf(auth);
      if (!listed.ok) {
        return { ok: false, reason: listed.reason };
      }
      const held = heldVersionOf(listed.scenes, sceneId, listed.floors);
      timeline.phase('versions');
      if (operation.cancelled) {
        return { ok: false, reason: 'cancelled' };
      }
      if (preview) {
        const version = versionToPublish(held);
        if (!previewMatchesSource(preview, build.pack, version)) {
          return { ok: false, reason: 'preview-stale' };
        }
        staged = { auth, uploadId: randomUUID() };
        const { uploadId } = staged;
        operation.discard = () => discardScenePreview(auth, uploadId);
        progress('uploading');
        const uploaded = await uploadScenePreview(
          auth,
          preview,
          staged.uploadId,
        );
        timeline.phase(`clip ${formatPackBytes(preview.bytes.length, 'en')}`);
        if (!uploaded.ok) {
          return uploaded;
        }
        if (operation.cancelled) {
          return { ok: false, reason: 'cancelled' };
        }
        // Upload can outlast a settings save/project switch. Only this exact
        // source may consume its receipt; an edit requires a fresh recording.
        const current = await readProject(folder);
        if (
          activeFolder() !== folder ||
          !current.ok ||
          !previewMatchesSource(preview, current.pack, version)
        ) {
          return { ok: false, reason: 'preview-stale' };
        }
        timeline.phase('recheck');
      }
      if (operation.cancelled) {
        return { ok: false, reason: 'cancelled' };
      }
      operation.committing = true;
      progress('publishing');
      if ((await setPublishedVersion(folder, held)) === 'failed') {
        return { ok: false, reason: 'no-build' };
      }
      const raised = await readProject(folder);
      if (!raised.ok || raised.pack.id !== sceneId) {
        return { ok: false, reason: 'no-build' };
      }
      if (preview && previewPackSha256(raised.pack) !== preview.packSha256) {
        return { ok: false, reason: 'preview-stale' };
      }
      timeline.name(
        raised.pack.id,
        raised.pack.version,
        formatPackBytes(scenePackSize(raised.pack).total, 'en'),
      );
      timeline.phase('raise');
      // Deliberately NOT re-asking who is signed in here, though three awaits
      // have passed. The token was taken for `me` and everything since uses
      // it: the gallery read is that account's gallery and the publication
      // goes out on that token, whoever signed in meanwhile. A publication
      // that completes belongs to the author who started it, which is the
      // rule the terms agreement below is written under.
      if (activeFolder() !== folder) {
        return { ok: false, reason: 'no-build' };
      }
      const published = await publishScene(auth, {
        termsVersion,
        category,
        ...(category2 !== undefined ? { category2 } : {}),
        pack: raised.pack,
        picture: Buffer.from(picture).toString('base64'),
        ...(notes ? { note: notes.en, versionNotes: notes } : {}),
        ...(staged ? { previewUploadId: staged.uploadId } : {}),
      });
      timeline.phase('publish');
      attached = published.ok;
      if (published.ok && published.kept !== 'same') {
        // Never silent: a copy nobody compared, or one that differs, is in
        // the log by name (a bug report carries it).
        logger?.warn(
          published.kept === 'differs'
            ? `The gallery kept ${raised.pack.id} v${raised.pack.version} differently from how it was published.`
            : `The gallery did not say what it kept of ${raised.pack.id} v${raised.pack.version}: it is a service from before the check.`,
        );
      }
      if (published.ok) {
        // The server recorded the agreement with the publication, for this
        // account; so is this.
        writeAgreedTerms(userDataDir, me, termsVersion);
        // What the folder holds is what went out; before the Studio is
        // told of the publication below, so the list says so at once.
        recordPublished?.(folder, raised.pack.id, raised.pack.version);
        // The completion belongs to the original author; a new account must
        // not adopt its agreement through the current-account callback.
        if (access.accountId() === me) {
          onTermsAgreed?.(termsVersion);
          onPublished?.(me, raised.pack);
        }
        timeline.phase('keep');
        // Out for everyone now, its maker included: a version waiting for
        // review is nobody's to fetch yet.
        if (published.review !== 'pending') {
          fetchOwnCopy(raised.pack.id, raised.pack.version);
        }
      }
      if (!published.ok) {
        return published;
      }
      return published.review === 'pending'
        ? { ok: true, review: 'pending' }
        : { ok: true };
    } finally {
      if (staged && !attached) {
        await discardScenePreview(staged.auth, staged.uploadId);
      }
      if (currentOperation === operation) {
        currentOperation = undefined;
      }
    }
  };

  ipcMain.handle(
    'studio-publish',
    async (
      event,
      termsVersion: unknown,
      category: unknown,
      rawPicture: unknown,
      category2?: unknown,
      rawNote?: unknown,
      rawPreview?: unknown,
    ): Promise<TPublishOutcome> => {
      const timeline = createPublishTimeline();
      try {
        const outcome = await publish(
          event,
          timeline,
          termsVersion,
          category,
          rawPicture,
          category2,
          rawNote,
          rawPreview,
        );
        logger?.info(timeline.line(outcomeOf(outcome)));
        return outcome;
      } catch (error) {
        logger?.warn(timeline.line(`threw ${String(error)}`));
        throw error;
      }
    },
  );
};
