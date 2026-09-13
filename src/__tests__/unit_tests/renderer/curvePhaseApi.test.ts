import ChannelEnum from 'common/channels';
import { ICurveComparisonStatus } from 'common/curveComparison';
import {
  getCurveComparison,
  setCurveComparison,
} from 'renderer/utils/curveComparisonApi';
import installFakeIpcRenderer from '../../utils/fakeIpcRenderer';

const base: ICurveComparisonStatus = {
  variant: 'B',
  eqVariant: 'B',
  supported: true,
  eqSupported: true,
  active: true,
  hasSampledCurves: false,
};

let bridge: ReturnType<typeof installFakeIpcRenderer>;

/** Main answering the request on `channel` sent `index`-th. */
const reply = (
  channel: ChannelEnum,
  index: number,
  result: ICurveComparisonStatus,
) => {
  bridge.answer(bridge.sentOn(channel)[index], { result });
};

beforeEach(() => {
  bridge = installFakeIpcRenderer();
});

it('coalesces duplicate status reads into one request', async () => {
  const first = getCurveComparison();
  const second = getCurveComparison();
  expect(first).toBe(second);
  expect(bridge.sentOn(ChannelEnum.GET_CURVE_COMPARISON)).toHaveLength(1);

  reply(ChannelEnum.GET_CURVE_COMPARISON, 0, base);

  expect(await first).toEqual(base);
});

it('does not reuse a pre-write read as the confirmation of a newer phase', async () => {
  const earlier = getCurveComparison();
  const writing = setCurveComparison('A', 'eq');
  expect(bridge.sentOn(ChannelEnum.SET_CURVE_COMPARISON)).toEqual([
    expect.objectContaining({ args: ['A', 'eq'] }),
  ]);
  const updated = { ...base, eqVariant: 'A' as const };
  reply(ChannelEnum.SET_CURVE_COMPARISON, 0, updated);
  await writing;
  const refreshed = getCurveComparison();
  expect(refreshed).not.toBe(earlier);
  reply(ChannelEnum.GET_CURVE_COMPARISON, 0, base);
  expect(await earlier).toEqual(base);
  await Promise.resolve();
  // The newer read goes out only after the older one settled, and is answered
  // with the phase the write confirmed.
  expect(bridge.sentOn(ChannelEnum.GET_CURVE_COMPARISON)).toHaveLength(2);
  reply(ChannelEnum.GET_CURVE_COMPARISON, 1, updated);
  expect(await refreshed).toEqual(updated);
});
