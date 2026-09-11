import { dialog, ipcMain, type BrowserWindow } from 'electron';
import fs from 'fs';
import { readManifest } from '../memberScenes/project';
import {
  readArtworkRegions,
  type IArtworkRegion,
} from '../memberScenes/artworkRegions';
import { registerStudioPictureCopy } from './studioPictureCopy';
import {
  keepPicturePhoto,
  readPictureAtlas,
  readPictureImage,
  readPictureKeeps,
  readPicturePhoto,
  writePictureImage,
  type IPictureKeep,
  type IPictureSlot,
  type TArtworkWrite,
} from '../memberScenes/projectPictures';

/**
 * The Studio's Pictures card, as the renderer sees it: what pictures the
 * open project's scene asks for, a photo for one of them from the system
 * dialog, and the scene's image saved with it laid in.
 *
 * NO PATH EVER COMES FROM THE PAGE, as everywhere in the Studio (see
 * `memberScenes.ts`): the photo's file is chosen in the dialog here and only
 * its bytes cross; the image is written to the file the open project's
 * `pack.json` names, checked to be exactly the WebP it asks for.
 */

export type { IPictureSlot, TArtworkWrite };

/** A picture as the card shows it: the scene's place, the member's keep. */
export type IStudioPicture = IPictureSlot & IPictureKeep;

export type TStudioPictures =
  | { kind: 'none' }
  | { kind: 'impossible' }
  | {
      kind: 'atlas';
      width: number;
      height: number;
      pictures: IStudioPicture[];
      regions?: IArtworkRegion[];
      /** The image in the folder, when it is one the scene can use. */
      image?: Uint8Array;
    };

/** The photo a member framed into one picture, to keep beside the scene. */
export interface IPictureKeepRequest {
  id: string;
  /** The photo as a WebP, at most 4096 px on its longer side. */
  photo: Uint8Array;
  framing: unknown;
}

/**
 * A photo the member chose, whole: the page lays it into its region, since
 * only the page can write a WebP.
 */
export type TPictureChoice =
  | { ok: true; bytes: Uint8Array }
  | { ok: false; reason: 'cancelled' | 'too-large' | 'failed' };

/**
 * A chosen photo is read whole before it is laid in. One straight off a
 * phone is a few megabytes; past this it is not a picture anyone meant.
 */
const MAX_CHOSEN_PICTURE_BYTES = 40 * 1024 * 1024;

const PICTURE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp'];

const CHANNELS = [
  'studio-pictures',
  'studio-picture-photo',
  'studio-choose-picture',
  'studio-save-picture',
] as const;

/** Bytes from the page, whether they arrived as a view or a buffer. */
const bytesOf = (value: unknown): Uint8Array | undefined => {
  if (value instanceof Uint8Array) {
    return value;
  }
  return value instanceof ArrayBuffer ? new Uint8Array(value) : undefined;
};

export interface IStudioPicturesDeps {
  getMainWindow: () => BrowserWindow | null;
  /** Asked fresh on every call, as everything in the Studio is. */
  entitled: () => boolean;
  activeFolder: () => string | undefined;
  dialogImpl: Pick<typeof dialog, 'showOpenDialog'>;
  logger?: { warn(message: string): void };
}

/** Registers the three handlers; the returned function takes them away. */
export const registerStudioPicturesIpc = ({
  getMainWindow,
  entitled,
  activeFolder,
  dialogImpl,
  logger,
}: IStudioPicturesDeps): (() => void) => {
  const stopCopies = registerStudioPictureCopy({
    getMainWindow,
    entitled,
    activeFolder,
  });
  // Read fresh on every ask: the member's AI rewrites pack.json whenever it
  // likes, and a card showing last minute's pictures would fill the wrong
  // regions.
  ipcMain.handle('studio-pictures', async (): Promise<TStudioPictures> => {
    const folder = activeFolder();
    if (!entitled() || !folder) {
      return { kind: 'none' };
    }
    const read = await readPictureAtlas(folder);
    if (read.kind !== 'atlas') {
      return read;
    }
    const { atlas } = read;
    const manifest = await readManifest(folder).catch(
      () => ({}) as Record<string, unknown>,
    );
    const regions = readArtworkRegions(
      manifest.artworkRegions,
      atlas.width,
      atlas.height,
    );
    const [image, keeps] = await Promise.all([
      readPictureImage(folder, atlas),
      readPictureKeeps(folder, atlas),
    ]);
    return {
      kind: 'atlas',
      width: atlas.width,
      height: atlas.height,
      ...(regions.length ? { regions } : {}),
      pictures: atlas.pictures.map((slot) => ({
        ...slot,
        ...(keeps[slot.id] ?? { framed: slot.framing, hasPhoto: false }),
      })),
      ...(image ? { image } : {}),
    };
  });

  // The kept photo behind one picture, to frame it again.
  ipcMain.handle(
    'studio-picture-photo',
    async (_event, id: unknown): Promise<Uint8Array | undefined> => {
      const folder = activeFolder();
      if (!entitled() || !folder || typeof id !== 'string') {
        return undefined;
      }
      const read = await readPictureAtlas(folder);
      return read.kind === 'atlas'
        ? readPicturePhoto(folder, read.atlas, id)
        : undefined;
    },
  );

  // The label is the dialog's name for picture files, in the member's
  // language; it is shown and never used as anything else.
  ipcMain.handle(
    'studio-choose-picture',
    async (_event, label: unknown): Promise<TPictureChoice> => {
      if (!entitled() || !activeFolder()) {
        return { ok: false, reason: 'failed' };
      }
      const window = getMainWindow();
      const options = {
        properties: ['openFile' as const],
        filters: [
          {
            name:
              typeof label === 'string' && label.trim()
                ? label.trim().slice(0, 80)
                : 'Pictures',
            extensions: PICTURE_EXTENSIONS,
          },
        ],
      };
      const picked = window
        ? await dialogImpl.showOpenDialog(window, options)
        : await dialogImpl.showOpenDialog(options);
      const [filePath] = picked.filePaths;
      if (picked.canceled || !filePath) {
        return { ok: false, reason: 'cancelled' };
      }
      try {
        const stats = await fs.promises.stat(filePath);
        if (!stats.isFile()) {
          return { ok: false, reason: 'failed' };
        }
        if (stats.size > MAX_CHOSEN_PICTURE_BYTES) {
          return { ok: false, reason: 'too-large' };
        }
        const bytes = await fs.promises.readFile(filePath);
        return { ok: true, bytes: new Uint8Array(bytes) };
      } catch (error) {
        logger?.warn(`A Studio picture could not be read: ${String(error)}`);
        return { ok: false, reason: 'failed' };
      }
    },
  );

  // The watcher on the folder rebuilds the stage from the saved image like
  // any other save. The photo behind it is kept after the image is written,
  // and failing to keep it costs only framing it again later: the scene
  // already has its picture.
  ipcMain.handle(
    'studio-save-picture',
    async (_event, picture: unknown, keep: unknown): Promise<TArtworkWrite> => {
      const folder = activeFolder();
      const bytes = bytesOf(picture);
      if (!entitled() || !folder || !bytes) {
        return 'failed';
      }
      const written = await writePictureImage(folder, bytes);
      const request = keep as Partial<IPictureKeepRequest> | undefined;
      const photo = bytesOf(request?.photo);
      if (written === 'written' && typeof request?.id === 'string' && photo) {
        const read = await readPictureAtlas(folder);
        if (
          read.kind === 'atlas' &&
          !(await keepPicturePhoto(
            folder,
            read.atlas,
            request.id,
            photo,
            request.framing,
          ))
        ) {
          logger?.warn(`A Studio picture's photo was not kept: ${request.id}`);
        }
      }
      return written;
    },
  );

  return () => {
    stopCopies();
    CHANNELS.forEach((channel) => ipcMain.removeHandler(channel));
  };
};
