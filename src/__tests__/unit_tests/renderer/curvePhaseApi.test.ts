import ChannelEnum from 'common/channels';
import { ICurveComparisonStatus } from 'common/curveComparison';
import {
  getCurveComparison,
  setCurveComparison,
} from 'renderer/utils/curveComparisonApi';

const base: ICurveComparisonStatus = {
  variant: 'B',
  eqVariant: 'B',
  supported: true,
  eqSupported: true,
  active: true,
  hasSampledCurves: false,
};
const listeners = new Map<string, Array<(value: unknown) => void>>();
const once = jest.fn((channel: string, handler: (value: unknown) => void) => {
  listeners.set(channel, [...(listeners.get(channel) ?? []), handler]);
  return () => {};
});
const sendMessage = jest.fn();
const reply = (channel: ChannelEnum, result: ICurveComparisonStatus) => {
  const pending = listeners.get(channel) ?? [];
  listeners.delete(channel);
  pending.forEach((handler) => handler({ result }));
};

beforeEach(() => {
  jest.clearAllMocks();
  listeners.clear();
  Object.assign(window, { electron: { ipcRenderer: { once, sendMessage } } });
});

it('registers before sending and coalesces duplicate status reads', async () => {
  sendMessage.mockImplementationOnce(() =>
    reply(ChannelEnum.GET_CURVE_COMPARISON, base),
  );
  const first = getCurveComparison();
  const second = getCurveComparison();
  expect(first).toBe(second);
  expect(await first).toEqual(base);
  expect(sendMessage).toHaveBeenCalledTimes(1);
});

it('does not reuse a pre-write read as the confirmation of a newer phase', async () => {
  const earlier = getCurveComparison();
  const writing = setCurveComparison('A', 'eq');
  expect(sendMessage).toHaveBeenLastCalledWith(
    ChannelEnum.SET_CURVE_COMPARISON,
    ['A', 'eq'],
  );
  const updated = { ...base, eqVariant: 'A' as const };
  reply(ChannelEnum.SET_CURVE_COMPARISON, updated);
  await writing;
  const refreshed = getCurveComparison();
  expect(refreshed).not.toBe(earlier);
  reply(ChannelEnum.GET_CURVE_COMPARISON, base);
  expect(await earlier).toEqual(base);
  await Promise.resolve();
  reply(ChannelEnum.GET_CURVE_COMPARISON, updated);
  expect(await refreshed).toEqual(updated);
});
