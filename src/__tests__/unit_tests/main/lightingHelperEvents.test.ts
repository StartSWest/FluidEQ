/** @jest-environment node */
import { parseHelperEvent } from 'main/lighting/lightingWire';

// The lines the helper writes, as `native/lighting-host` formats them.

it('reads every product id a Razer device carries, and still reads a helper that sends one', () => {
  expect(
    parseHelperEvent(
      '{"type":"razer","container":"{20b9}","name":"Razer Base Station V2 Chroma","productId":3872,"productIds":[3872,18672]}',
    ),
  ).toEqual({
    type: 'razer',
    container: '{20b9}',
    name: 'Razer Base Station V2 Chroma',
    productId: 3872,
    productIds: [3872, 18672],
  });
  expect(
    parseHelperEvent(
      '{"type":"razer","container":"{3bd1}","name":"DSV2Pro TKL","productId":664}',
    ),
  ).toEqual({
    type: 'razer',
    container: '{3bd1}',
    name: 'DSV2Pro TKL',
    productId: 664,
  });
});

it('drops a product id list that is not one, keeping the device', () => {
  const tooMany = JSON.stringify({
    type: 'razer',
    container: '{c}',
    name: 'Razer X',
    productId: 1,
    productIds: Array.from({ length: 17 }, (_, index) => index),
  });
  expect(parseHelperEvent(tooMany)).not.toHaveProperty('productIds');
  expect(
    parseHelperEvent(
      '{"type":"razer","container":"{c}","name":"Razer X","productId":1,"productIds":[1,"2"]}',
    ),
  ).not.toHaveProperty('productIds');
});

it('reads the member’s Dynamic Lighting settings, leaving unwritten values out', () => {
  expect(
    parseHelperEvent(
      JSON.stringify({
        type: 'lighting-settings',
        present: true,
        enabled: true,
        providers: ['WindowsLighting', 'RazerDynamicLighting_qemfkr3nbbywc'],
        devices: [
          {
            id: 'HID#VID_1532&PID_0567&MI_05&Col05#7&1',
            enabled: false,
            providers: ['WindowsLighting'],
          },
          { id: 'HID#VID_046D#2', foregroundFirst: 'yes' },
          { enabled: true },
        ],
      }),
    ),
  ).toEqual({
    type: 'lighting-settings',
    present: true,
    enabled: true,
    providers: ['WindowsLighting', 'RazerDynamicLighting_qemfkr3nbbywc'],
    devices: [
      {
        id: 'HID#VID_1532&PID_0567&MI_05&Col05#7&1',
        enabled: false,
        providers: ['WindowsLighting'],
      },
      { id: 'HID#VID_046D#2' },
    ],
  });
  expect(
    parseHelperEvent(
      '{"type":"lighting-settings","present":false,"devices":[]}',
    ),
  ).toEqual({ type: 'lighting-settings', present: false, devices: [] });
  expect(
    parseHelperEvent('{"type":"lighting-settings","devices":[]}'),
  ).toBeUndefined();
});

it('reads the package family name the helper runs under', () => {
  expect(
    parseHelperEvent(
      '{"type":"ready","protocol":1,"identity":true,"familyName":"FluidEQ.Lighting_abc"}',
    ),
  ).toEqual({
    type: 'ready',
    protocol: 1,
    identity: true,
    familyName: 'FluidEQ.Lighting_abc',
  });
  expect(
    parseHelperEvent('{"type":"ready","protocol":1,"identity":false}'),
  ).toEqual({ type: 'ready', protocol: 1, identity: false });
});
