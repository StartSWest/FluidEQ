/** @jest-environment node */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The demo without Plus in the main process: the scene it hands the page is
 * the Studio's starter as a valid pack, and its frames light the devices for
 * as long as they come — with the switch off, without Plus — and never with
 * Plus, where the switch decides.
 */

import type { IChromaClient } from 'main/lighting/chromaClient';
import { lightingDemoScene } from 'main/lighting/lightingDemoScene';
import type { ILightingHost } from 'main/lighting/lightingHost';
import { createLightingService } from 'main/lighting/lightingService';
import type { ILampArrayEvent, THelperEvent } from 'main/lighting/lightingWire';
import { STARTER_SOURCE } from 'main/memberScenes/starterScene';
import { checkMemberSceneSource } from 'common/memberSceneRules';
import {
  DEFAULT_LIGHTING_SETTINGS,
  type TSynapseState,
} from 'common/lighting/lightingModel';

jest.mock('main/lighting/lightingPath', () => ({
  ...jest.requireActual('main/lighting/lightingPath'),
  LIGHTING_EXECUTABLE: 'FluidEQ-Lighting.exe',
}));
jest.mock('main/lighting/lightingSettingsStore', () => ({
  // The switch is off: an account without Plus never turned it on.
  loadLightingSettings: () => ({
    ...DEFAULT_LIGHTING_SETTINGS,
    enabled: false,
  }),
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

function setup(entitled: boolean) {
  let receive: (event: THelperEvent) => void = () => {
    throw new Error('Host not started');
  };
  const host: ILightingHost = { pid: 42, send: jest.fn(), close: jest.fn() };
  const hosts: ILightingHost[] = [];
  const synapse: TSynapseState = 'running';
  const chroma: IChromaClient = {
    frame: jest.fn(),
    send: jest.fn(),
    release: jest.fn(),
    probe: jest.fn(),
    state: () => synapse,
  };
  const ensureIdentity = jest.fn(async () => 'no-package' as const);
  const service = createLightingService({
    userDataDir: 'unused',
    appVersion: '1.0.0',
    supported: true,
    entitled: () => entitled,
    push: jest.fn(),
    findFolder: () => 'helper',
    ensureIdentity,
    createChroma: () => chroma,
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
  receive({ type: 'enumerated', source: 'razer' });
  receive({ type: 'enumerated', source: 'lamparray' });
  return { service, host, chroma, ensureIdentity };
}

it('hands the page the Studio starter as a pack that passes every rule', () => {
  const pack = lightingDemoScene();
  expect(pack).not.toBeNull();
  expect(pack?.source).toBe(STARTER_SOURCE);
  expect(checkMemberSceneSource(STARTER_SOURCE)).toEqual([]);
  // Named in every language the app speaks, not after a project.
  expect(Object.keys(pack?.names ?? {}).sort()).toEqual(
    ['de', 'en', 'es', 'fr', 'hi', 'it', 'ja', 'pt', 'ru', 'zh'].sort(),
  );
  expect(pack?.params.map((param) => param.id)).toEqual([
    'glow',
    'petals',
    'breeze',
    'moon',
    'blossom',
  ]);
  // Built once: the same pack every time the page asks.
  expect(lightingDemoScene()).toBe(pack);
});

it('lights the devices with the demo without Plus, switch off, until the page lets go', () => {
  const { service, chroma, ensureIdentity } = setup(false);
  expect(service.state().settings.enabled).toBe(false);
  // The member's own frames do nothing without Plus: this is the control.
  service.frame(frame);
  expect(chroma.frame).not.toHaveBeenCalled();
  expect(service.state().live).toBe(false);

  service.demoFrame(frame);
  service.demoFrame(frame);
  expect(chroma.frame).toHaveBeenCalledTimes(2);
  expect(service.state().live).toBe(true);
  // Windows lends its lamps to an app it can identify, demo or not.
  expect(ensureIdentity).toHaveBeenCalled();

  service.release();
  expect(chroma.release).toHaveBeenCalledTimes(1);
  expect(service.state().live).toBe(false);
  service.dispose();
});

it('ignores the demo with Plus, where the switch decides', () => {
  const { service, chroma } = setup(true);
  service.demoFrame(frame);
  service.demoFrame(frame);
  expect(chroma.frame).not.toHaveBeenCalled();
  expect(service.state().live).toBe(false);
  service.dispose();
});

it('drops a demo frame it cannot read', () => {
  const { service, chroma } = setup(false);
  service.demoFrame({ ...frame, rgb: new Uint8Array(3) });
  service.demoFrame(undefined);
  expect(chroma.frame).not.toHaveBeenCalled();
  expect(service.state().live).toBe(false);
  service.dispose();
});
