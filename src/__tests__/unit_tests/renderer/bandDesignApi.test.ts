import ChannelEnum from 'common/channels';
import { ErrorCode } from 'common/errors';
import {
  applyBandDesign,
  deleteBandDesign,
  getBandDesigns,
  saveBandDesign,
} from 'renderer/utils/bandDesignApi';

const listeners = new Map<string, (result: unknown) => void>();
const sent: { channel: string; args: unknown }[] = [];
const bridge = {
  once: (channel: string, listener: (result: unknown) => void) => {
    listeners.set(channel, listener);
    return () => listeners.delete(channel);
  },
  sendMessage: (channel: string, args: unknown) => {
    expect(listeners.has(channel)).toBe(true);
    sent.push({ channel, args });
  },
};
const reply = (channel: string, result: unknown) => {
  const listener = listeners.get(channel);
  if (!listener) {
    throw new Error('Missing reply listener');
  }
  listeners.delete(channel);
  listener(result);
};
const previous = Object.getOwnPropertyDescriptor(window, 'electron');

beforeEach(() => {
  listeners.clear();
  sent.length = 0;
  Object.defineProperty(window, 'electron', {
    configurable: true,
    value: { ipcRenderer: bridge },
  });
});
afterEach(() => {
  if (previous) {
    Object.defineProperty(window, 'electron', previous);
  } else {
    Reflect.deleteProperty(window, 'electron');
  }
});

it('serializes same-channel reads so a reply cannot resolve the wrong request', async () => {
  const first = getBandDesigns();
  const second = getBandDesigns();
  await Promise.resolve();
  expect(sent).toHaveLength(1);
  const design = {
    id: 'first',
    name: 'First',
    bands: [{ frequency: 150, quality: 1.5 }],
  };
  reply(ChannelEnum.GET_BAND_DESIGNS, { result: [design] });
  await expect(first).resolves.toEqual([design]);
  expect(sent).toHaveLength(2);
  reply(ChannelEnum.GET_BAND_DESIGNS, { result: [] });
  await expect(second).resolves.toEqual([]);
});

it('keeps queued commands working after a rejected save', async () => {
  const save = saveBandDesign('Renamed', 'id');
  const outcome = save.then(
    (result) => ({ result }),
    (error: unknown) => ({ error }),
  );
  const apply = applyBandDesign('id');
  const remove = deleteBandDesign('id');
  await Promise.resolve();
  expect(sent[0]).toEqual({
    channel: ChannelEnum.SAVE_BAND_DESIGN,
    args: ['Renamed', 'id'],
  });
  reply(ChannelEnum.SAVE_BAND_DESIGN, { errorCode: ErrorCode.FAILURE });
  expect(await outcome).toEqual({ error: expect.any(Error) });
  const design = {
    id: 'id',
    name: 'Original',
    bands: [{ frequency: 100, quality: 2 }],
  };
  reply(ChannelEnum.APPLY_BAND_DESIGN, { result: design });
  await expect(apply).resolves.toEqual(design);
  reply(ChannelEnum.DELETE_BAND_DESIGN, { result: true });
  await expect(remove).resolves.toBe(true);
  expect(sent.map((entry) => entry.channel)).toEqual([
    ChannelEnum.SAVE_BAND_DESIGN,
    ChannelEnum.APPLY_BAND_DESIGN,
    ChannelEnum.DELETE_BAND_DESIGN,
  ]);
  expect(listeners.size).toBe(0);
});
