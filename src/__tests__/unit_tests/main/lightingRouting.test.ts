/** @jest-environment node */
import type { IChromaClient } from 'main/lighting/chromaClient';
import { createLightingService } from 'main/lighting/lightingService';
import type { ILightingHost } from 'main/lighting/lightingHost';
import type { ILampArrayEvent, THelperEvent } from 'main/lighting/lightingWire';
import {
  DEFAULT_LIGHTING_SETTINGS,
  type ILamp,
  type TSynapseState,
} from 'common/lighting/lightingModel';

jest.mock('main/lighting/lightingPath', () => ({
  ...jest.requireActual('main/lighting/lightingPath'),
  LIGHTING_EXECUTABLE: 'FluidEQ-Lighting.exe',
}));
jest.mock('main/lighting/lightingSettingsStore', () => ({
  loadLightingSettings: () => ({ ...DEFAULT_LIGHTING_SETTINGS, enabled: true }),
  saveLightingSettings: jest.fn(),
}));

const headset: ILampArrayEvent = {
  type: 'lamparray',
  index: 1,
  id: 'headset',
  name: 'Razer Kraken V4 Pro',
  container: 'razer-headset',
  kind: 11,
  vendorId: 0x1532,
  productId: 0x0567,
  lampCount: 2,
  width: 1,
  height: 1,
  positions: [0, 0, 0, 1, 1, 0],
  minUpdateMs: 0,
};
const frame = {
  width: 48,
  height: 27,
  rgb: new Uint8Array(48 * 27 * 3).fill(180),
  level: 0.8,
  beat: 0.6,
  bass: 0.7,
  mid: 0.5,
  treble: 0.4,
  deltaMs: 33,
};

function setup(
  synapse: TSynapseState,
  loadKeyboard: () => Promise<ILamp[] | undefined> = async () => undefined,
) {
  let synapseState = synapse;
  let receive: (event: THelperEvent) => void = () => {
    throw new Error('Host not started');
  };
  const host: ILightingHost = { pid: 42, send: jest.fn(), close: jest.fn() };
  const hosts: ILightingHost[] = [];
  const chroma: IChromaClient = {
    frame: jest.fn(),
    send: jest.fn(),
    release: jest.fn(),
    probe: jest.fn(),
    state: () => synapseState,
  };
  const service = createLightingService({
    userDataDir: 'unused',
    appVersion: '1.0.0',
    supported: true,
    entitled: () => true,
    push: jest.fn(),
    findFolder: () => 'helper',
    ensureIdentity: async () => 'no-package',
    createChroma: () => chroma,
    loadKeyboard,
    startHost: (_path, onEvent) => {
      receive = onEvent;
      const next =
        hosts.length === 0
          ? host
          : { pid: 42 + hosts.length, send: jest.fn(), close: jest.fn() };
      hosts.push(next);
      return next;
    },
  });
  service.watch(true);
  receive(headset);
  receive({
    type: 'razer',
    container: headset.container,
    name: headset.name,
    productId: headset.productId,
  });
  receive({ type: 'available', index: headset.index, available: false });
  receive({ type: 'enumerated', source: 'razer' });
  receive({ type: 'enumerated', source: 'lamparray' });
  return {
    service,
    host,
    hosts,
    chroma,
    receive: (event: THelperEvent) => receive(event),
    setSynapse: (next: TSynapseState) => {
      synapseState = next;
    },
  };
}

it('sends fitted keys and their fallback canvas together, reverting to the common grid for two keyboards', async () => {
  const lamps = [{ u: 0.5, v: 0.5, reach: 0.01, chromaIndex: 117 }];
  const { service, receive, chroma } = setup('running', async () => lamps);
  service.setSettings({ brightness: 1 });
  receive({
    type: 'razer',
    container: 'keyboard-one',
    name: 'Razer DeathStalker V2 Pro Tenkeyless',
    productId: 0x02b1,
  });
  await Promise.resolve();
  service.frame(frame);
  const send = jest.mocked(chroma.send);
  const call = send.mock.calls.find(([channel]) => channel === 'keyboard');
  expect(call?.[1]).toHaveLength(6 * 22 * 3);
  expect(call?.[2]?.[117]).toBe(0x01b4b4b4);
  expect(call?.[2]?.[0]).toBe(0);
  expect(
    service.state().devices.find((device) => device.kind === 'keyboard')?.lamps,
  ).toEqual(lamps);
  send.mockClear();
  receive({
    type: 'razer',
    container: 'keyboard-two',
    name: 'Razer BlackWidow V4',
    productId: 0x0287,
  });
  await Promise.resolve();
  service.frame(frame);
  expect(
    send.mock.calls.find(([channel]) => channel === 'keyboard'),
  ).toHaveLength(2);
  expect(
    service
      .state()
      .devices.filter((device) => device.kind === 'keyboard')
      .every((device) => device.lamps.length === 132),
  ).toBe(true);
  service.dispose();
});

it('ignores a keyboard descriptor that resolves after its device was removed', async () => {
  let finish: (lamps: ILamp[]) => void = () => {
    throw Error('Descriptor not requested');
  };
  const { service, receive } = setup(
    'running',
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  receive({
    type: 'razer',
    container: 'keyboard-one',
    name: 'Razer DeathStalker V2 Pro Tenkeyless',
    productId: 0x02b1,
  });
  receive({ type: 'razer-removed', container: 'keyboard-one' });
  finish([{ u: 0.5, v: 0.5, reach: 0.01, chromaIndex: 117 }]);
  await Promise.resolve();
  expect(
    service.state().devices.some((device) => device.kind === 'keyboard'),
  ).toBe(false);
  service.dispose();
});

it.each<TSynapseState>(['running', 'unknown'])(
  'sends a shared Razer device through Chroma only when %s',
  (synapse) => {
    const { service, host, chroma, receive } = setup(synapse);
    receive({
      ...headset,
      index: 2,
      id: 'other',
      container: 'other',
      name: 'Other keyboard',
      vendorId: 1,
    });
    service.frame(frame);
    expect(chroma.send).toHaveBeenCalledWith('headset', expect.any(Uint8Array));
    expect(host.send).not.toHaveBeenCalledWith(1, expect.anything());
    expect(host.send).toHaveBeenCalledWith(2, expect.any(Uint8Array));
    expect(service.state().heldByWindows).toEqual([]);
    expect(
      service.state().devices.find((device) => device.name === headset.name)
        ?.route,
    ).toBe('synapse');
    service.dispose();
  },
);

it('relinquishes Windows ownership once when Chroma recovers, even when Windows enumerates first', () => {
  const { service, host, hosts, receive, setSynapse } = setup('not-running');
  service.frame(frame);
  expect(host.send).toHaveBeenCalled();
  setSynapse('running');
  service.frame(frame);
  expect(host.close).toHaveBeenCalledTimes(1);
  expect(hosts).toHaveLength(2);
  receive(headset);
  receive({ type: 'enumerated', source: 'lamparray' });
  service.frame(frame);
  expect(hosts[1].send).not.toHaveBeenCalled();
  receive({
    type: 'razer',
    container: headset.container,
    name: headset.name,
    productId: headset.productId,
  });
  receive({ type: 'enumerated', source: 'razer' });
  service.frame(frame);
  expect(hosts).toHaveLength(2);
  expect(hosts[1].send).not.toHaveBeenCalled();
  receive({
    ...headset,
    index: 2,
    id: 'other',
    container: 'other',
    name: 'Other keyboard',
    vendorId: 1,
  });
  service.frame(frame);
  expect(hosts[1].send).toHaveBeenCalledWith(2, expect.any(Uint8Array));
  service.dispose();
});

it('keeps ownership during ambient frames and gives it back on explicit release', () => {
  const { service, host, chroma } = setup('running');
  service.frame({ ...frame, ambient: true, activity: 0 });
  expect(service.state()).toMatchObject({ live: true, ambient: true });
  expect(host.close).not.toHaveBeenCalled();
  expect(chroma.release).not.toHaveBeenCalled();
  service.release();
  expect(service.state()).toMatchObject({ live: false, ambient: false });
  expect(host.close).toHaveBeenCalledTimes(1);
  expect(chroma.release).toHaveBeenCalledTimes(1);
  service.dispose();
});

it.each<TSynapseState>(['not-running', 'apps-off'])(
  'keeps Windows fallback and its ownership warning when Chroma is %s',
  (synapse) => {
    const { service, host } = setup(synapse);
    service.frame(frame);
    expect(host.send).toHaveBeenCalledWith(1, expect.any(Uint8Array));
    expect(service.state().heldByWindows).toEqual([headset.name]);
    service.setSettings({ muted: [`razer:${headset.container}`] });
    jest.mocked(host.send).mockClear();
    service.frame(frame);
    expect(host.send).not.toHaveBeenCalled();
    expect(service.state().heldByWindows).toEqual([]);
    service.dispose();
  },
);
