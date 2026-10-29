/* FluidEQ — GPL-3.0-or-later */
import { startAudioScheduling } from '../../../main/shareAudio/scheduling';

const mockRegister = jest.fn();
const mockRevert = jest.fn();
const mockLoad = jest.fn((_file: string) => ({
  func: (name: string) => (name.includes('AvSet') ? mockRegister : mockRevert),
}));
let mockMainThread = true;
jest.mock('koffi', () => ({ load: (file: string) => mockLoad(file) }));
jest.mock('worker_threads', () => ({
  get isMainThread() {
    return mockMainThread;
  },
}));
const platform = Object.getOwnPropertyDescriptor(process, 'platform');
const type = Object.getOwnPropertyDescriptor(process, 'type');

beforeEach(() => {
  jest.clearAllMocks();
  mockMainThread = true;
  Object.defineProperty(process, 'platform', {
    configurable: true,
    value: 'win32',
  });
  Reflect.deleteProperty(process, 'type');
  mockRegister.mockReturnValue({ task: 'fixture' });
});
afterEach(() => {
  if (platform) {
    Object.defineProperty(process, 'platform', platform);
  }
  if (type) {
    Object.defineProperty(process, 'type', type);
  } else {
    Reflect.deleteProperty(process, 'type');
  }
});

it('registers only the dedicated Audio task and reverts that thread once', () => {
  const task = startAudioScheduling();
  expect(task.active).toBe(true);
  expect(mockRegister).toHaveBeenCalledWith('Audio', [0]);
  expect(mockLoad).toHaveBeenCalledWith(expect.stringContaining('System32'));
  task.close();
  task.close();
  expect(mockRevert).toHaveBeenCalledTimes(1);
});
it('never loads a native addon on an Electron UI thread or a Node worker', () => {
  Object.defineProperty(process, 'type', {
    configurable: true,
    value: 'browser',
  });
  expect(startAudioScheduling().active).toBe(false);
  Reflect.deleteProperty(process, 'type');
  mockMainThread = false;
  expect(startAudioScheduling().active).toBe(false);
  expect(mockLoad).not.toHaveBeenCalled();
});
it('reports unavailable scheduling while retaining the normal audio path', () => {
  mockRegister.mockReturnValue(null);
  expect(startAudioScheduling()).toMatchObject({
    active: false,
    reason: 'task',
  });
  expect(mockRevert).not.toHaveBeenCalled();
});
