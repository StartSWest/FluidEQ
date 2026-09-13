/** @jest-environment node */
import type { IChromaClient } from 'main/lighting/chromaClient';
import type { TIdentityOutcome } from 'main/lighting/lightingIdentity';
import { createLightingService } from 'main/lighting/lightingService';
import { DEFAULT_LIGHTING_SETTINGS } from 'common/lighting/lightingModel';

jest.mock('main/lighting/lightingPath', () => ({
  ...jest.requireActual('main/lighting/lightingPath'),
  LIGHTING_EXECUTABLE: 'FluidEQ-Lighting.exe',
}));
jest.mock('main/lighting/lightingSettingsStore', () => ({
  loadLightingSettings: () => ({ ...DEFAULT_LIGHTING_SETTINGS, enabled: true }),
  saveLightingSettings: jest.fn(),
}));

const settle = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

it('asks Windows again when the member comes back with the page open, until the identity registers', async () => {
  const outcomes: TIdentityOutcome[] = [
    'developer-mode-off',
    'developer-mode-off',
    'registered',
  ];
  const ensureIdentity = jest.fn(async () => outcomes.shift() ?? 'registered');
  const chroma: IChromaClient = {
    frame: jest.fn(),
    send: jest.fn(),
    release: jest.fn(),
    probe: jest.fn(),
    state: () => 'running',
  };
  const service = createLightingService({
    userDataDir: 'unused',
    appVersion: '1.0.0',
    supported: true,
    entitled: () => true,
    push: jest.fn(),
    findFolder: () => 'helper',
    ensureIdentity,
    createChroma: () => chroma,
    startHost: () => ({ pid: 7, send: jest.fn(), close: jest.fn() }),
  });
  await settle();
  expect(ensureIdentity).toHaveBeenCalledTimes(1);
  expect(service.state().windowsBackground).toBe('needs-developer-mode');

  // Focus with the page closed: nothing on screen would show the answer.
  service.windowFocused();
  await settle();
  expect(ensureIdentity).toHaveBeenCalledTimes(1);

  service.watch(true);
  await settle();
  expect(ensureIdentity).toHaveBeenCalledTimes(2);

  // Back from Windows' developer settings with Developer Mode on.
  service.windowFocused();
  await settle();
  expect(ensureIdentity).toHaveBeenCalledTimes(3);
  expect(service.state().windowsBackground).toBe('possible');

  service.windowFocused();
  await settle();
  expect(ensureIdentity).toHaveBeenCalledTimes(3);
  service.dispose();
});
