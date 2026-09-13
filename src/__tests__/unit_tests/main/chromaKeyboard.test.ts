/** @jest-environment node */
import { readChromaKeyboard } from 'main/lighting/chromaKeyboard';
import { chromaKeyIndex } from 'main/lighting/chromaKeyCodes';
import { chromaEffectBody } from 'main/lighting/chromaEffects';

const descriptor = () => {
  const positions = Array.from({ length: 20 }, (_, index) => [
    Math.floor(index / 10),
    index % 10,
  ]);
  return {
    param: {
      category: 'keyboard',
      ledConfig: {
        LedMatrix: positions.map((MatrixPos, index) => ({
          MatrixPos,
          DevicePos: [0, 19 - index],
        })),
        LedInputMap: positions.map((MatrixPos, index) => ({
          MatrixPos,
          InputType: 'kbd',
          InputData: [index === 19 ? 57 : index + 1, 0],
        })),
      },
    },
  };
};

it('fits physical matrix positions while addressing Escape, Q and Space by key identity', () => {
  const lamps = readChromaKeyboard(descriptor());
  expect(lamps).toHaveLength(20);
  expect(lamps?.[0]).toMatchObject({ u: 0.05, v: 0.25, chromaIndex: 1 });
  expect(lamps?.[15]).toMatchObject({ u: 0.55, v: 0.75, chromaIndex: 46 });
  expect(lamps?.[19]).toMatchObject({ u: 0.95, v: 0.75, chromaIndex: 117 });
});

it.each([
  [28, 0, 3, 80], // Enter.
  [28, 2, 4, 109], // Numpad Enter.
  [29, 4, 0, 17], // Pause.
  [43, 0, 2, 58], // ANSI backslash.
  [43, 0, 3, 79], // ISO key beside Enter.
  [86, 0, 4, 90], // ISO key beside left Shift.
])(
  'maps scan %s flags %s row %s to the documented logical key',
  (scan, flags, row, expected) => {
    expect(chromaKeyIndex(scan, flags, row)).toBe(expected);
  },
);

it('falls back for unknown/private inputs, duplicate key identities and malformed geometry', () => {
  const unknown = descriptor();
  unknown.param.ledConfig.LedInputMap[0].InputType = 'dkm';
  expect(readChromaKeyboard(unknown)).toBeUndefined();
  const duplicate = descriptor();
  duplicate.param.ledConfig.LedInputMap[1].InputData = [1, 0];
  expect(readChromaKeyboard(duplicate)).toBeUndefined();
  const malformed = descriptor();
  malformed.param.ledConfig.LedMatrix[0].MatrixPos = [-1, 0];
  expect(readChromaKeyboard(malformed)).toBeUndefined();
  expect(readChromaKeyboard(null)).toBeUndefined();
  expect(chromaKeyIndex(57, 16)).toBeUndefined();
});

it('sends a full spatial canvas plus explicitly enabled key colours, including black', () => {
  const rgb = new Uint8Array(6 * 22 * 3);
  rgb.set([12, 34, 56]);
  const keys = new Uint32Array(6 * 22);
  keys[1] = 0x01000000;
  keys[117] = 0x0138220c;
  const body = JSON.parse(chromaEffectBody('keyboard', rgb, keys));
  expect(body.effect).toBe('CHROMA_CUSTOM_KEY');
  expect(body.param.color).toHaveLength(6);
  expect(body.param.color.every((row: number[]) => row.length === 22)).toBe(
    true,
  );
  expect(body.param.color[0][0]).toBe(0x0038220c);
  expect(body.param.key[0][0]).toBe(0);
  expect(body.param.key[0][1]).toBe(0x01000000);
  expect(body.param.key[5][7]).toBe(0x0138220c);
  expect(JSON.parse(chromaEffectBody('keyboard', rgb))).toEqual({
    effect: 'CHROMA_CUSTOM',
    param: body.param.color,
  });
});
