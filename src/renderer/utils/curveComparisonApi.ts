import ChannelEnum from '../../common/channels';
import {
  ICurveComparisonStatus,
  TCurveComparison,
  TPhaseScope,
} from '../../common/curveComparison';
import { buildResponseHandler, sendRequest } from './ipcRequest';

let revision = 0;
let reading:
  { revision: number; promise: Promise<ICurveComparisonStatus> } | undefined;

const request = (
  channel: ChannelEnum,
  args: (TCurveComparison | TPhaseScope)[] = [],
): Promise<ICurveComparisonStatus> =>
  sendRequest<ICurveComparisonStatus>(
    channel,
    args,
    buildResponseHandler<ICurveComparisonStatus>((result, resolve) =>
      resolve(result),
    ),
    { timeout: null },
  );

export const getCurveComparison = (): Promise<ICurveComparisonStatus> => {
  if (reading?.revision === revision) {
    return reading.promise;
  }
  const read = () => request(ChannelEnum.GET_CURVE_COMPARISON);
  const pending = reading ? reading.promise.then(read, read) : read();
  const promise = pending.finally(() => {
    if (reading?.promise === promise) {
      reading = undefined;
    }
  });
  reading = { revision, promise };
  return promise;
};

export const setCurveComparison = (
  variant: TCurveComparison,
  scope: TPhaseScope = 'curves',
): Promise<ICurveComparisonStatus> => {
  revision += 1;
  return request(ChannelEnum.SET_CURVE_COMPARISON, [variant, scope]);
};
