import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import StudioPictureDownloads, {
  copyRegion,
} from '../../../renderer/studio/StudioPictureDownloads';
import { decodePicture } from '../../../renderer/studio/scenePicture';

jest.mock('../../../renderer/studio/scenePicture', () => ({
  decodePicture: jest.fn(),
}));
jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
const region = {
  id: 'boat',
  x: 10,
  y: 20,
  width: 120,
  height: 80,
  rotated: false,
};
const bytes = new Uint8Array([1, 2, 3]);
const close = jest.fn();
const drawImage = jest.fn();
const rotate = jest.fn();
const translate = jest.fn();
const copy = jest.fn();
beforeEach(() => {
  jest.clearAllMocks();
  URL.createObjectURL = jest.fn(() => 'blob:atlas');
  URL.revokeObjectURL = jest.fn();
  Object.defineProperty(window, 'electron', {
    configurable: true,
    value: { ipcRenderer: { copyStudioPicture: copy } },
  });
  copy.mockResolvedValue('saved');
});
it('saves the full original image without re-encoding it', async () => {
  render(
    <StudioPictureDownloads
      atlas={{
        kind: 'atlas',
        width: 200,
        height: 100,
        pictures: [],
        image: bytes,
      }}
    />,
  );
  await userEvent.click(
    screen.getByRole('button', { name: 'studio.picture.download' }),
  );
  expect(copy).toHaveBeenCalledWith(bytes, 'scene-artwork');
  expect(await screen.findByRole('status')).toHaveTextContent(
    'studio.picture.downloaded',
  );
  expect(decodePicture).not.toHaveBeenCalled();
});
it.each([false, true])(
  'crops only the requested pixels and undoes packing rotation: %s',
  async (rotated) => {
    const bitmap = { close } as unknown as ImageBitmap;
    jest.mocked(decodePicture).mockResolvedValue(bitmap);
    const context = jest
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockReturnValue({
        drawImage,
        translate,
        rotate,
      } as unknown as CanvasRenderingContext2D);
    const encoded = new Uint8Array([137, 80, 78, 71]);
    const encode = jest
      .spyOn(HTMLCanvasElement.prototype, 'toBlob')
      .mockImplementation(function encodePng(
        this: HTMLCanvasElement,
        callback,
        type,
      ) {
        expect(this.width).toBe(rotated ? 80 : 120);
        expect(this.height).toBe(rotated ? 120 : 80);
        expect(type).toBe('image/png');
        callback({ arrayBuffer: async () => encoded.buffer } as Blob);
      });
    expect(await copyRegion(bytes, { ...region, rotated })).toEqual(encoded);
    expect(drawImage).toHaveBeenCalledWith(
      bitmap,
      10,
      20,
      120,
      80,
      0,
      0,
      120,
      80,
    );
    expect(rotate.mock.calls).toEqual(rotated ? [[-Math.PI / 2]] : []);
    expect(translate.mock.calls).toEqual(rotated ? [[0, 120]] : []);
    expect(close).toHaveBeenCalledTimes(1);
    context.mockRestore();
    encode.mockRestore();
  },
);
