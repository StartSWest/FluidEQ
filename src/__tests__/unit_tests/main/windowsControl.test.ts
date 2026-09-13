/** @jest-environment node */
import type { ILightingSettingsEvent } from 'main/lighting/lightingWire';
import {
  describeWindowsHold,
  type IHeldDevice,
} from 'main/lighting/windowsControl';

const FLUIDEQ = 'FluidEQ.Lighting_abc123';
const RAZER = 'RazerDynamicLighting_qemfkr3nbbywc';

const keyboard: IHeldDevice = {
  name: 'Logitech G915 X',
  id: '\\\\?\\HID#VID_046D&PID_C33E#keyboard',
  vendorId: 0x046d,
};
const pad: IHeldDevice = {
  name: 'Corsair MM700',
  id: '\\\\?\\HID#VID_1B1C&PID_1B9B#pad',
  vendorId: 0x1b1c,
};

const settings = (
  overrides: Partial<ILightingSettingsEvent> = {},
): ILightingSettingsEvent => ({
  type: 'lighting-settings',
  present: true,
  enabled: true,
  foregroundFirst: true,
  providers: [FLUIDEQ, 'WindowsLighting'],
  devices: [],
  ...overrides,
});

it('says nothing while Windows holds nothing', () => {
  expect(
    describeWindowsHold([], 'possible', settings(), FLUIDEQ),
  ).toBeUndefined();
});

it('asks for what this copy lacks before any setting', () => {
  expect(
    describeWindowsHold([keyboard], 'needs-developer-mode', settings(), FLUIDEQ)
      ?.reason,
  ).toBe('needs-developer-mode');
  expect(
    describeWindowsHold([keyboard], 'unavailable', settings(), FLUIDEQ)?.reason,
  ).toBe('unavailable');
  // Still registering, or a helper started before the identity existed.
  expect(
    describeWindowsHold([keyboard], 'checking', settings(), FLUIDEQ)?.reason,
  ).toBe('waiting');
  expect(
    describeWindowsHold([keyboard], 'possible', settings(), undefined)?.reason,
  ).toBe('waiting');
});

it('names Dynamic Lighting switched off, for every device or for one', () => {
  expect(
    describeWindowsHold(
      [keyboard],
      'possible',
      settings({ enabled: false }),
      FLUIDEQ,
    )?.reason,
  ).toBe('dynamic-lighting-off');
  expect(
    describeWindowsHold(
      [keyboard],
      'possible',
      settings({
        devices: [
          {
            id: 'hid#vid_046d&pid_c33e#keyboard',
            enabled: false,
          },
        ],
      }),
      FLUIDEQ,
    )?.reason,
  ).toBe('dynamic-lighting-off');
});

it('names the controllers above FluidEQ, from the device’s own list where it has one', () => {
  const hold = describeWindowsHold(
    [keyboard, pad],
    'possible',
    settings({
      providers: ['WindowsLighting', FLUIDEQ],
      devices: [
        {
          id: 'HID#VID_1B1C&PID_1B9B#pad',
          providers: [RAZER, 'windowslighting', FLUIDEQ],
        },
      ],
    }),
    FLUIDEQ,
  );
  expect(hold).toEqual(
    expect.objectContaining({
      reason: 'not-first',
      devices: ['Logitech G915 X', 'Corsair MM700'],
      above: ['WindowsLighting', RAZER],
      // The pad's own list differs from the global one, so Settings shows
      // "Reset for all devices" where the list would be.
      resetNeeded: true,
      vendors: ['logitech'],
    }),
  );
});

it('puts everything above FluidEQ when FluidEQ is not in the list at all', () => {
  expect(
    describeWindowsHold(
      [keyboard],
      'possible',
      settings({ providers: [RAZER] }),
      FLUIDEQ,
    ),
  ).toEqual(
    expect.objectContaining({
      reason: 'not-first',
      above: [RAZER],
      resetNeeded: false,
    }),
  );
});

it('waits while FluidEQ is first, and says whether a game in front keeps the lights', () => {
  expect(
    describeWindowsHold([keyboard], 'possible', settings(), FLUIDEQ),
  ).toEqual(
    expect.objectContaining({ reason: 'waiting', foregroundFirst: true }),
  );
  expect(
    describeWindowsHold(
      [keyboard],
      'possible',
      settings({ foregroundFirst: false }),
      FLUIDEQ,
    )?.foregroundFirst,
  ).toBe(false);
});

it('reports only the devices with the most actionable reason', () => {
  const hold = describeWindowsHold(
    [keyboard, pad],
    'possible',
    settings({
      devices: [{ id: 'hid#vid_1b1c&pid_1b9b#pad', enabled: false }],
    }),
    FLUIDEQ,
  );
  expect(hold?.reason).toBe('dynamic-lighting-off');
  expect(hold?.devices).toEqual(['Corsair MM700']);
});

it('knows a maker by name where its vendor id is someone else’s', () => {
  expect(
    describeWindowsHold(
      [{ name: 'ROG Strix Scope II', id: 'x', vendorId: 0x0001 }],
      'possible',
      settings({ enabled: false }),
      FLUIDEQ,
    )?.vendors,
  ).toEqual(['asus']);
});
