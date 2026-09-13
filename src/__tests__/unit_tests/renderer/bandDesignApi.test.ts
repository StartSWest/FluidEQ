import ChannelEnum from 'common/channels';
import { ErrorCode } from 'common/errors';
import {
  applyBandDesign,
  deleteBandDesign,
  getBandDesigns,
  saveBandDesign,
} from 'renderer/utils/bandDesignApi';
import installFakeIpcRenderer, {
  type ISentMessage,
} from '../../utils/fakeIpcRenderer';

let bridge: ReturnType<typeof installFakeIpcRenderer>;
let sent: ISentMessage[];

/** Main answering the one request on a channel still waiting for it. */
const reply = (channel: string, result: unknown) => {
  const waiting = bridge.sentOn(channel);
  if (waiting.length === 0 || bridge.listenerCount(channel) === 0) {
    throw new Error('Missing reply listener');
  }
  bridge.answer(waiting[waiting.length - 1], result);
};
const previous = Object.getOwnPropertyDescriptor(window, 'electron');

beforeEach(() => {
  bridge = installFakeIpcRenderer();
  sent = bridge.sent;
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
  expect(sent[0]).toMatchObject({
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
  [
    ChannelEnum.SAVE_BAND_DESIGN,
    ChannelEnum.APPLY_BAND_DESIGN,
    ChannelEnum.DELETE_BAND_DESIGN,
  ].forEach((channel) => expect(bridge.listenerCount(channel)).toBe(0));
});
