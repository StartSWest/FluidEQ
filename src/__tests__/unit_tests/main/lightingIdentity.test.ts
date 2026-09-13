/** @jest-environment node */
import path from 'path';
import { pathToFileURL } from 'url';
import {
  ensureLightingIdentity,
  identitySourceOf,
  type TRunHelper,
} from 'main/lighting/lightingIdentity';
import {
  LIGHTING_IDENTITY_MANIFEST,
  LIGHTING_IDENTITY_PACKAGE,
} from 'main/lighting/lightingPath';

jest.mock('main/lighting/lightingPath', () => ({
  ...jest.requireActual('main/lighting/lightingPath'),
  LIGHTING_EXECUTABLE: 'FluidEQ-Lighting.exe',
}));

const FOLDER = path.resolve('helper-folder');

const statusLine = (fields: Record<string, unknown>) =>
  `${JSON.stringify({ type: 'identity', ...fields })}\n`;

const runner = (status: Record<string, unknown>) => {
  const calls: string[][] = [];
  const run: TRunHelper = async (_executable, args) => {
    calls.push(args);
    return args[1] === 'status'
      ? { code: 0, stdout: statusLine(status) }
      : { code: 0, stdout: '' };
  };
  return { run, calls };
};

const only = (file: string) => (candidate: string) =>
  candidate === path.join(FOLDER, file);

it('prefers the signed package a release ships over the bare manifest', () => {
  expect(identitySourceOf(FOLDER, () => true)?.kind).toBe('signed');
  expect(identitySourceOf(FOLDER, only(LIGHTING_IDENTITY_MANIFEST))?.kind).toBe(
    'development',
  );
  expect(identitySourceOf(FOLDER, () => false)).toBeUndefined();
});

it('asks for Developer Mode before registering a development copy', async () => {
  const { run, calls } = runner({ registered: false, developerMode: false });
  await expect(
    ensureLightingIdentity(
      FOLDER,
      '1.6.5',
      run,
      only(LIGHTING_IDENTITY_MANIFEST),
    ),
  ).resolves.toBe('developer-mode-off');
  expect(calls.map((args) => args[1])).toEqual(['status']);
});

it('registers a development copy through Developer Mode, by file URL', async () => {
  const { run, calls } = runner({ registered: false, developerMode: true });
  await expect(
    ensureLightingIdentity(
      FOLDER,
      '1.6.5',
      run,
      only(LIGHTING_IDENTITY_MANIFEST),
    ),
  ).resolves.toBe('registered');
  expect(calls[1]).toEqual([
    'identity',
    'register-dev',
    pathToFileURL(path.join(FOLDER, LIGHTING_IDENTITY_MANIFEST)).href,
    pathToFileURL(FOLDER).href,
  ]);
});

it('registers a signed package without Developer Mode', async () => {
  const { run, calls } = runner({ registered: false, developerMode: false });
  await expect(
    ensureLightingIdentity(
      FOLDER,
      '1.6.5',
      run,
      only(LIGHTING_IDENTITY_PACKAGE),
    ),
  ).resolves.toBe('registered');
  expect(calls[1].slice(0, 3)).toEqual([
    'identity',
    'register',
    pathToFileURL(path.join(FOLDER, LIGHTING_IDENTITY_PACKAGE)).href,
  ]);
});

it('leaves a registration that already describes this install alone', async () => {
  const { run, calls } = runner({
    registered: true,
    version: '1.6.5.0',
    location: FOLDER,
    developerMode: false,
  });
  await expect(
    ensureLightingIdentity(
      FOLDER,
      '1.6.5',
      run,
      only(LIGHTING_IDENTITY_MANIFEST),
    ),
  ).resolves.toBe('registered');
  expect(calls).toHaveLength(1);
});
