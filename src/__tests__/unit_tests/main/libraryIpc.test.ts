const handlers = new Map<string, (...args: unknown[]) => unknown>();
// Typed to take (...unknown[]) rather than the brief's zero-arg form: TS
// infers a jest.fn's call signature from its implementation's own parameter
// list, and a zero-arg implementation makes the mock's signature a strict
// empty tuple -- which the factory below cannot spread `args` into (TS2556)
// under this project's TypeScript version. Runtime behaviour is identical.
const showOpenDialog = jest.fn((..._args: unknown[]) =>
  Promise.resolve({ canceled: false, filePaths: ['C:\\Music'] }),
);
jest.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, fn: (...args: unknown[]) => unknown) =>
      handlers.set(channel, fn),
    on: (channel: string, fn: (...args: unknown[]) => unknown) =>
      handlers.set(channel, fn),
  },
  dialog: { showOpenDialog: (...args: unknown[]) => showOpenDialog(...args) },
  shell: { showItemInFolder: jest.fn() },
}));

// eslint-disable-next-line import/first -- the mock must be installed first
import { registerLibraryIpc } from '../../../main/ipc/library';

describe('the library channels', () => {
  it('registers every channel the renderer will call', () => {
    registerLibraryIpc({ userDataDir: 'C:\\Data', getMainWindow: () => null });
    [
      'library-index-get',
      'library-root-add',
      'library-root-add-paths',
      'library-root-remove',
      'library-scan-start',
      'library-scan-cancel',
      'library-reveal',
    ].forEach((channel) => expect(handlers.has(channel)).toBe(true));
  });

  it('refuses a dropped path that is not a directory', async () => {
    // The one channel that takes a path inwards. It may add a root and
    // nothing else, so a file — or a path that does not exist — is refused
    // rather than added and scanned.
    registerLibraryIpc({ userDataDir: 'C:\\Data', getMainWindow: () => null });
    const handler = handlers.get('library-root-add-paths');
    const index = await handler?.({}, ['C:\\Windows\\notepad.exe']);
    expect(index).toMatchObject({ roots: [] });
  });
});
