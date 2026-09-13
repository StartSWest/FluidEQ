import {
  publishLightingPreview,
  subscribeLightingPreview,
} from 'renderer/lighting/lightingPreview';

it('keeps the newest high-resolution bitmap alive through delivery and closes superseded images', () => {
  const first = { close: jest.fn() } as unknown as ImageBitmap;
  const second = { close: jest.fn() } as unknown as ImageBitmap;
  const seen: (ImageBitmap | undefined)[] = [];
  const stop = subscribeLightingPreview((_frame, image) => seen.push(image));
  publishLightingPreview(undefined, first);
  expect(first.close).not.toHaveBeenCalled();
  publishLightingPreview(undefined, second);
  expect(first.close).toHaveBeenCalledTimes(1);
  expect(second.close).not.toHaveBeenCalled();
  const late = jest.fn();
  const stopLate = subscribeLightingPreview(late);
  expect(late).toHaveBeenCalledWith(undefined, second);
  publishLightingPreview(undefined);
  expect(second.close).toHaveBeenCalledTimes(1);
  expect(seen).toEqual([undefined, first, second, undefined]);
  stop();
  stopLate();
});
