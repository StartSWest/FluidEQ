/** @jest-environment node */
import { CHROMA_CHANNEL_LAMPS } from 'common/lighting/lampLayouts';
import { DEFAULT_LIGHTING_SETTINGS } from 'common/lighting/lightingModel';
import {
  deviceLightingGroup,
  deviceLightingKind,
} from 'common/lighting/lightingProfiles';
import {
  buildDeviceList,
  singleChromaKeyboard,
  type IWindowsDevice,
} from 'main/lighting/lightingDevices';
import type { IRazerEvent } from 'main/lighting/lightingWire';

const razer = (
  container: string,
  name: string,
  ...productIds: number[]
): [string, IRazerEvent] => [
  container,
  { type: 'razer', container, name, productId: productIds[0], productIds },
];

const desk = new Map([
  razer('bw', 'Razer BlackWidow V4 Pro', 0x028d),
  razer('dock', 'Razer Mouse Dock Pro', 0x00a4),
  razer('strider', 'Razer Strider Chroma', 0x0c05),
  razer('base', 'Razer Base Station V2 Chroma', 0x48f0, 0x0f20),
  razer('usbc', 'Razer USB C Dock', 0x0f4e),
  razer('hub', 'USB2.0 Hub', 0x0f2f),
]);
const noWindows = new Map<number, IWindowsDevice>();

it('lists what Razer Chroma lights, drawn and named as the product it is', () => {
  const rows = buildDeviceList(
    noWindows,
    desk,
    DEFAULT_LIGHTING_SETTINGS,
    'running',
  );
  expect(rows.map((row) => [row.name, row.form, row.chromaChannel])).toEqual([
    ['Razer Base Station V2 Chroma', 'headset-stand', 'mousepad'],
    ['Razer BlackWidow V4 Pro', 'keyboard-full', 'keyboard'],
    ['Razer Mouse Dock Pro', 'mouse-dock', 'mousepad'],
    ['Razer Strider Chroma', 'desk-mat', 'mousepad'],
  ]);
});

it('draws a mousepad-channel device’s LEDs on the zones they show', () => {
  const dock = buildDeviceList(
    noWindows,
    desk,
    DEFAULT_LIGHTING_SETTINGS,
    'running',
  ).find((row) => row.name === 'Razer Mouse Dock Pro');
  expect(dock?.lamps).toEqual(
    [10, 7, 4, 2, 0, 17, 14, 12].map(
      (zone) => CHROMA_CHANNEL_LAMPS.mousepad[zone],
    ),
  );
  // Tuned, and moving, with the mousepad it shares a channel with.
  expect(dock && deviceLightingGroup(dock)).toBe('chroma:mousepad');
  expect(dock && deviceLightingKind(dock)).toBe('mousepad');
});

it('takes Razer’s name where Windows has only the USB string', () => {
  const rows = buildDeviceList(
    noWindows,
    new Map([razer('ds', 'DSV2Pro TKL', 0x0298)]),
    DEFAULT_LIGHTING_SETTINGS,
    'running',
  );
  expect(rows[0].name).toMatch(/^Razer DeathStalker V2 Pro/);
  expect(rows[0].form).toBe('keyboard-tkl');
});

it('leaves out the Chroma channel where Razer Chroma is not lighting the device', () => {
  const rows = buildDeviceList(
    noWindows,
    desk,
    DEFAULT_LIGHTING_SETTINGS,
    'not-running',
  );
  expect(rows.every((row) => row.chromaChannel === undefined)).toBe(true);
});

it('fits the key grid only to keyboards on the keyboard channel', () => {
  const fitted = [{ u: 0.5, v: 0.5, reach: 0.1 }];
  const keyboards = new Map([['bw', fitted]]);
  // An Ornata V3 takes Chroma Link's colours and never shows the key grid.
  const withOrnata = new Map([
    ...desk,
    razer('ornata', 'Razer Ornata V3', 0x02a1),
  ]);
  expect(singleChromaKeyboard(withOrnata, keyboards)).toBe(fitted);
  const twoGrids = new Map([
    ...desk,
    razer('huntsman', 'Razer Huntsman V2', 0x026c),
  ]);
  expect(singleChromaKeyboard(twoGrids, keyboards)).toBeUndefined();
});
