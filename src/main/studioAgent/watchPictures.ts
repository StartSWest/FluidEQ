import { nativeImage } from 'electron';
import { pictureFromBytes } from '../safePicture';
import type { IWatchPictures } from './watchTool';

/**
 * The pictures `watch_scene` works on, read and written by Electron's own
 * image code in the main process: the frames FluidEQ's window drew, in, and
 * the strip of them, out. Pixels keep the order the decoder gives them from
 * the one to the other, which is all the strip needs.
 */
const watchPictures: IWatchPictures = {
  decode: (bytes) => {
    const image = pictureFromBytes(bytes);
    const { width, height } = image.getSize();
    if (image.isEmpty() || width < 2 || height < 2) {
      return undefined;
    }
    return { data: new Uint8Array(image.toBitmap()), width, height };
  },
  encodePng: (picture) =>
    nativeImage
      .createFromBitmap(Buffer.from(picture.data), {
        width: picture.width,
        height: picture.height,
      })
      .toPNG(),
};

export default watchPictures;
