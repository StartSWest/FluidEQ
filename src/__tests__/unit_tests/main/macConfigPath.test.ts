/** @jest-environment node */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { getConfigPath, isEngineInstalled } from '../../../main/registry';

let userDataDir: string;
const registryList = jest.fn();
jest.mock('electron', () => ({
  app: {
    getPath: (name: string) =>
      name === 'exe'
        ? '/Applications/FluidEQ.app/Contents/MacOS/FluidEQ'
        : userDataDir,
  },
}));
jest.mock('regedit', () => ({
  promisified: { list: (...args: unknown[]) => registryList(...args) },
  setExternalVBSLocation: jest.fn(),
}));

const hostPlatform = Object.getOwnPropertyDescriptor(process, 'platform');
beforeAll(() =>
  Object.defineProperty(process, 'platform', { value: 'darwin' }),
);
afterAll(() => {
  if (hostPlatform) {
    Object.defineProperty(process, 'platform', hostPlatform);
  }
});
beforeEach(() => {
  userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-mac-config-'));
  registryList.mockClear();
});
afterEach(() => fs.rmSync(userDataDir, { recursive: true, force: true }));

it('writes the built-in engine configuration under this Mac user’s app data', async () => {
  const directory = await getConfigPath('fluid');
  expect(directory).toBe(path.join(userDataDir, 'engine', 'config'));
  expect(fs.existsSync(path.join(directory, 'config.txt'))).toBe(true);
  expect(registryList).not.toHaveBeenCalled();
});

it('retains the Mac’s configuration and requires no Windows engine DLL', async () => {
  const directory = await getConfigPath('fluid');
  const file = path.join(directory, 'config.txt');
  fs.writeFileSync(file, 'Include: fluideq.txt\n');
  await getConfigPath('fluid');
  expect(fs.readFileSync(file, 'utf8')).toBe('Include: fluideq.txt\n');
  await expect(isEngineInstalled('fluid')).resolves.toBe(true);
});
