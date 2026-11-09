/**
 * A picture onto the clipboard (`pictureClipboard.ts`): as a PNG, the only
 * image Chromium's clipboard takes, at the picture's own full size, and a
 * piece the packer turned put back the right way up.
 */
import {
  copyPicture,
  drawUpright,
} from '../../../renderer/studio/pictureClipboard';

const drawImage = jest.fn();
const translate = jest.fn();
const rotate = jest.fn();
const context = { drawImage, translate, rotate };
const canvases: { width: number; height: number; type?: string }[] = [];

// Constructors as the page has them, each answering a plain object.
const FakeCanvas = jest.fn((width: number, height: number) => {
  const canvas: { width: number; height: number; type?: string } = {
    width,
    height,
  };
  canvases.push(canvas);
  return {
    ...canvas,
    getContext: () => context,
    convertToBlob: ({ type }: { type: string }) => {
      canvas.type = type;
      return Promise.resolve(new Blob(['png'], { type }));
    },
  };
});
const FakeImage = jest.fn(() => ({
  src: '',
  naturalWidth: 720,
  naturalHeight: 405,
  decode: () => Promise.resolve(),
}));
const write = jest.fn<Promise<void>, [unknown[]]>();
const FakeItem = jest.fn((items: Record<string, Blob>) => ({ items }));

beforeEach(() => {
  drawImage.mockClear();
  translate.mockClear();
  rotate.mockClear();
  write.mockReset();
  canvases.length = 0;
  write.mockResolvedValue(undefined);
  Object.assign(globalThis, {
    OffscreenCanvas: FakeCanvas,
    Image: FakeImage,
    ClipboardItem: FakeItem,
  });
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { write },
  });
});

it('puts a whole picture on the clipboard as a PNG at its own size', async () => {
  // A JPEG from the chat: drawn and encoded again, since the clipboard
  // takes image/png alone.
  await copyPicture({ src: 'data:image/jpeg;base64,AAAA' });
  expect(canvases).toEqual([{ width: 720, height: 405, type: 'image/png' }]);
  expect(drawImage).toHaveBeenCalledWith(
    expect.objectContaining({ naturalWidth: 720 }),
    0,
    0,
    720,
    405,
    0,
    0,
    720,
    405,
  );
  const [[items]] = write.mock.calls;
  expect(
    (items[0] as { items: Record<string, Blob> }).items['image/png'].type,
  ).toBe('image/png');
});

it('cuts a piece out of the scene’s image the right way up', async () => {
  const region = {
    id: 'fish',
    x: 4,
    y: 8,
    width: 64,
    height: 32,
    rotated: true,
  };
  await copyPicture({ src: 'blob:atlas', region });
  // Turned back: as tall as it was packed wide.
  expect(canvases[0]).toMatchObject({ width: 32, height: 64 });
  expect(translate).toHaveBeenCalledWith(0, 64);
  expect(rotate).toHaveBeenCalledWith(-Math.PI / 2);
  expect(drawImage).toHaveBeenCalledWith(
    expect.objectContaining({ naturalWidth: 720 }),
    4,
    8,
    64,
    32,
    0,
    0,
    64,
    32,
  );
});

it('leaves a piece that was packed upright alone', () => {
  drawUpright(
    context as unknown as CanvasRenderingContext2D,
    {} as CanvasImageSource,
    { id: 'rock', x: 0, y: 0, width: 10, height: 20, rotated: false },
  );
  expect(translate).not.toHaveBeenCalled();
  expect(rotate).not.toHaveBeenCalled();
});

it('fails when the clipboard refuses, so the button can say so', async () => {
  write.mockRejectedValueOnce(new Error('NotAllowedError'));
  await expect(copyPicture({ src: 'blob:atlas' })).rejects.toThrow(
    'NotAllowedError',
  );
});
