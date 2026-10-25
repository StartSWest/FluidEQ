/** @jest-environment node */
/* FluidEQ — GPL-3.0-or-later */
import type { ILinuxOutputs } from '../../../main/linux/linuxOutputs';

let mockWatch: (_event: string, file: string) => void;
let mockPending: Promise<unknown> = Promise.resolve();
const mockClose = jest.fn();
const mockRead = jest.fn<Promise<ILinuxOutputs>, []>();
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  mkdirSync: jest.fn(),
  existsSync: () => true,
  watch: (_root: string, listener: typeof mockWatch) => {
    mockWatch = listener;
    return { on: jest.fn(), close: mockClose };
  },
}));
jest.mock('../../../main/linux/linuxEngineFiles', () => ({
  linuxEngineRoot: () => '/private-test-engine',
}));
jest.mock('../../../main/linux/linuxOutputs', () => ({
  ...jest.requireActual('../../../main/linux/linuxOutputs'),
  readLinuxOutputs: () => mockRead(),
}));
jest.mock('../../../common/coalescedRequest', () => {
  const { default: coalesce } = jest.requireActual(
    '../../../common/coalescedRequest',
  );
  return {
    __esModule: true,
    default: (action: () => Promise<void>) => {
      const follow = coalesce(action);
      return () => {
        mockPending = follow();
        return mockPending;
      };
    },
  };
});

// eslint-disable-next-line import/first -- install the filesystem and engine boundary first
import startLinuxOutputWatch from '../../../main/linux/linuxOutputWatch';

it('keeps volume-only notifications from reopening audio, but notices an engine restart with the same devices', async () => {
  let snapshot: ILinuxOutputs = { pid: 10, backend: 'pipewire', outputs: [] };
  mockRead.mockImplementation(async () => snapshot);
  const onOutputs = jest.fn(async () => undefined);
  const watch = startLinuxOutputWatch({ onOutputs });
  await mockPending;
  expect(onOutputs).toHaveBeenCalledTimes(1);
  mockWatch('rename', 'outputs.json');
  await mockPending;
  expect(onOutputs).toHaveBeenCalledTimes(1);
  snapshot = { ...snapshot, pid: 11 };
  mockWatch('rename', 'outputs.json');
  await mockPending;
  expect(onOutputs).toHaveBeenCalledTimes(2);
  watch.stop();
  expect(mockClose).toHaveBeenCalled();
});

it('does not publish a pending device reading after it has stopped', async () => {
  let answer: (value: ILinuxOutputs) => void = () => undefined;
  mockRead.mockReturnValue(
    new Promise((resolve) => {
      answer = resolve;
    }),
  );
  const onOutputs = jest.fn(async () => undefined);
  const watch = startLinuxOutputWatch({ onOutputs });
  watch.stop();
  answer({ pid: 11, outputs: [] });
  await mockPending;
  expect(onOutputs).not.toHaveBeenCalled();
});
