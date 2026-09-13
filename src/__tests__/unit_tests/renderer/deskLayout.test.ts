import { KIND_OF_FORM, type TDeviceForm } from 'common/lighting/deviceForms';
import { KIND_PREVIEW_LAMPS } from 'common/lighting/lampLayouts';
import type { ILightingDevice } from 'common/lighting/lightingModel';
import {
  DESK_HEIGHT,
  DESK_WIDTH,
  MIN_MONITOR_HEIGHT,
  monitorForDesk,
  underMonitor,
  type IPlacedDevice,
} from 'renderer/plus/lighting/deskGeometry';
import layoutDesk from 'renderer/plus/lighting/deskLayout';

const device = (form: TDeviceForm, name: string = form): ILightingDevice => ({
  key: `razer:${name}`,
  name,
  kind: KIND_OF_FORM[form],
  form,
  route: 'synapse',
  lamps: KIND_PREVIEW_LAMPS[KIND_OF_FORM[form]],
  channel: 'synapse',
  muted: false,
});

const DESKS: Record<string, ILightingDevice[]> = {
  // Ivan's second machine.
  base: [
    device('headset-stand'),
    device('keyboard-full'),
    device('mouse-dock'),
    device('desk-mat'),
  ],
  studio: [
    device('laptop'),
    device('laptop-stand'),
    device('monitor-stand'),
    device('soundbar'),
    device('microphone'),
    device('keypad'),
    device('light-strip'),
    device('charging-pad'),
    device('mouse'),
  ],
  gear: [
    device('keyboard-compact'),
    device('speakers'),
    device('monitor'),
    device('mouse-bungee'),
    device('mouse'),
    device('mousepad'),
    device('tower'),
    device('chair'),
    device('dock'),
    device('headset'),
  ],
  crowded: [
    device('headset-stand'),
    device('headset', 'hung'),
    device('headset', 'loose'),
    device('keypad'),
    device('keyboard-full'),
    device('keyboard-tkl'),
    device('mousepad'),
    device('mouse', 'left'),
    device('mouse', 'right'),
    device('mouse-dock'),
    device('speakers'),
    device('lamp'),
    device('microphone'),
    device('tower'),
  ],
};

const overlaps = (a: IPlacedDevice, b: IPlacedDevice) =>
  a.x < b.x + b.width - 0.5 &&
  b.x < a.x + a.width - 0.5 &&
  a.y < b.y + b.height - 0.5 &&
  b.y < a.y + a.height - 0.5;

/** Things drawn under or over others on purpose. */
const SURFACES: ReadonlySet<TDeviceForm> = new Set([
  'desk-mat',
  'mousepad',
  'light-strip',
]);

describe.each(Object.entries(DESKS))('the %s desk', (_name, devices) => {
  const placed = layoutDesk(devices);

  it('places every device once, inside the desk', () => {
    expect(placed).toHaveLength(
      devices.length +
        devices.filter((entry) => entry.form === 'speakers').length,
    );
    placed.forEach((entry) => {
      expect(entry.x).toBeGreaterThanOrEqual(0);
      expect(entry.y).toBeGreaterThanOrEqual(0);
      expect(entry.x + entry.width).toBeLessThanOrEqual(DESK_WIDTH);
      expect(entry.y + entry.height).toBeLessThanOrEqual(DESK_HEIGHT);
    });
  });

  it('puts what stands under the monitor where the painter draws the monitor', () => {
    // The painter works the monitor out again from the placed devices alone;
    // a stand placed for another monitor would float beside the one drawn.
    const monitor = monitorForDesk(placed);
    const bottom = monitor.y + monitor.height;
    const under = underMonitor(
      placed.some((entry) => entry.form === 'monitor-stand'),
      placed.some((entry) => entry.form === 'soundbar'),
    );
    expect(monitor.height).toBeGreaterThanOrEqual(MIN_MONITOR_HEIGHT);
    placed
      .filter((entry) => entry.form === 'monitor-stand')
      .forEach((stand) => {
        expect(stand.x + stand.width / 2).toBeCloseTo(
          monitor.x + monitor.width / 2,
        );
        expect(stand.y).toBeCloseTo(bottom + under.standTop);
      });
    placed
      .filter((entry) => entry.form === 'soundbar')
      .forEach((bar) => {
        expect(bar.y).toBeCloseTo(bottom + under.soundbarTop);
      });
  });

  it('keeps the screen clear of the front row', () => {
    const monitor = monitorForDesk(placed);
    const screen: IPlacedDevice = {
      ...placed[0],
      ...monitor,
    };
    const front = placed.filter(
      (entry) =>
        !SURFACES.has(entry.form) &&
        !['speakers', 'microphone', 'lamp', 'headset', 'monitor'].includes(
          entry.form,
        ),
    );
    front
      .filter(
        (entry) => entry.form !== 'monitor-stand' && entry.form !== 'soundbar',
      )
      .forEach((entry) => {
        expect([entry.form, overlaps(screen, entry)]).toEqual([
          entry.form,
          false,
        ]);
      });
  });

  it('draws nothing on top of anything it does not rest on', () => {
    const resting = (a: IPlacedDevice, b: IPlacedDevice) =>
      SURFACES.has(a.form) ||
      SURFACES.has(b.form) ||
      // A headset hangs on its stand, a laptop sits on its stand.
      (a.onStand && b.form === 'headset-stand') ||
      (b.onStand && a.form === 'headset-stand') ||
      [a.form, b.form].sort().join() === 'laptop,laptop-stand' ||
      // The riser's legs stand behind the soundbar.
      [a.form, b.form].sort().join() === 'monitor-stand,soundbar';
    const drawnOver = placed.flatMap((a, index) =>
      placed
        .slice(index + 1)
        .filter((b) => !resting(a, b) && overlaps(a, b))
        .map((b) => [a.form, b.form]),
    );
    expect(drawnOver).toEqual([]);
  });
});

it('hangs a headset on its stand and lays any other beside the monitor', () => {
  const placed = layoutDesk(DESKS.crowded);
  const onStand = (name: string) =>
    placed.find((entry) => entry.device.name === name)?.onStand;
  expect(onStand('hung')).toBe(true);
  expect(onStand('loose')).toBe(false);
});

it('raises a laptop on its stand, the stand’s lit edge showing below it', () => {
  const placed = layoutDesk(DESKS.studio);
  const laptop = placed.find((entry) => entry.form === 'laptop');
  const stand = placed.find((entry) => entry.form === 'laptop-stand');
  const bottom = (entry?: IPlacedDevice) =>
    entry ? entry.y + entry.height : Number.NaN;
  const centre = (entry?: IPlacedDevice) =>
    entry ? entry.x + entry.width / 2 : Number.NaN;
  expect(bottom(stand)).toBeGreaterThan(bottom(laptop));
  expect(centre(stand)).toBeCloseTo(centre(laptop));
});
