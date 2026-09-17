import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { ipcMain } from 'electron';
import { PREVIEW_FILE } from '../../common/memberScenes';

/**
 * A picture of the scene, written into the project's own folder.
 *
 * The assistant a member builds a scene with never sees the scene. It writes
 * `scene.frag`, FluidEQ plays it, and the member is the only pair of eyes in
 * the loop — which is how a scene goes three rounds with its subject a grey
 * smudge in the corner of a frame nobody described. It cannot be given a way
 * into the app to look for itself: the scene is drawn by the running FluidEQ,
 * on the member's GPU, and in a packaged build there is no door into that and
 * should not be.
 *
 * So the picture goes the other way. FluidEQ already draws a still of a scene
 * for the gallery's cover; after each save that builds, it writes one here,
 * beside `pack.json` and `scene.frag`, in the folder the assistant is already
 * editing. The assistant opens a file. Nothing reaches into anything.
 *
 * `preview.png`, not a WebP: it is read by whichever assistant the member
 * uses, and PNG is the one all of them open. It never leaves the machine, so
 * the size a WebP would save buys nothing.
 *
 * THIS CHANNEL WRITES A FILE ON THE MEMBER'S DISK, so it is written for a
 * window that has been taken over — which in this app is not a hypothesis:
 * every scene is somebody else's program running in the same process. What a
 * caller may do with it:
 *
 * - NOT choose where. No path crosses the wire; the page names a project and
 *   this asks the one list that knows folders. The same rule as everything
 *   else here (see the header of `ipc/memberScenes.ts`).
 * - NOT choose what it is called. One fixed name, so `pack.json`, the shader
 *   and the artwork cannot be written over through it.
 * - NOT write something that is not a picture. The PNG signature is checked
 *   here rather than trusted from the renderer: without it this is "drop
 *   eight megabytes of anything into a folder the member syncs and shares",
 *   which is a foothold on somebody else's machine, not a preview.
 * - NOT follow a link out of the folder. The bytes go to a fresh temporary
 *   name that must not already exist (`wx`), and the rename replaces the
 *   directory entry itself — a `preview.png` that somebody made a symlink is
 *   replaced, never written through.
 * - NOT keep the disk busy. One write at a time per folder; a second while
 *   one is running is dropped rather than queued, because the newest picture
 *   is the only one worth having and a loop of calls must cost one write.
 */

/** Room for a 1280x720 PNG of a bright scene, and nothing like a payload. */
export const MAX_PREVIEW_BYTES = 8 * 1024 * 1024;

/** The eight bytes every PNG starts with, and nothing else does. */
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

const isPng = (bytes: Uint8Array) =>
  bytes.byteLength > PNG_SIGNATURE.length &&
  PNG_SIGNATURE.every((byte, at) => bytes[at] === byte);

export const registerStudioPreviewIpc = ({
  folderFor,
  logger,
}: {
  /**
   * The folder of the project the page names, or nothing when there is no
   * such project or the member may not write to it — a FluidEQ scene opened
   * to look inside is read with the same page and must gain no file.
   */
  folderFor: (id: string) => string | undefined;
  logger?: { warn(message: string): void };
}) => {
  const writing = new Set<string>();

  ipcMain.handle(
    'studio-write-preview',
    (_event, id: unknown, bytes: unknown): boolean => {
      const folder = typeof id === 'string' ? folderFor(id) : undefined;
      if (
        !folder ||
        !(bytes instanceof Uint8Array) ||
        bytes.byteLength > MAX_PREVIEW_BYTES ||
        !isPng(bytes) ||
        writing.has(folder)
      ) {
        return false;
      }
      writing.add(folder);
      const temporary = path.join(
        folder,
        `.${PREVIEW_FILE}-${randomUUID()}.tmp`,
      );
      try {
        fs.writeFileSync(temporary, bytes, { flag: 'wx' });
        fs.renameSync(temporary, path.join(folder, PREVIEW_FILE));
        return true;
      } catch (error) {
        logger?.warn(`Could not write the scene preview: ${String(error)}`);
        return false;
      } finally {
        fs.rmSync(temporary, { force: true });
        writing.delete(folder);
      }
    },
  );
  return () => ipcMain.removeHandler('studio-write-preview');
};
