import ChannelEnum from '../../common/channels';
import type { IBandDesign } from '../../common/bandDesigns';
import { buildResponseHandler, promisifyResult } from './ipcRequest';

let pending: Promise<unknown> = Promise.resolve();

const request = <Result extends IBandDesign | IBandDesign[] | boolean>(
  channel: ChannelEnum,
  args: (string | undefined)[] = [],
): Promise<Result> => {
  const send = () => {
    const response = promisifyResult<Result>(
      buildResponseHandler<Result>((result, resolve) => resolve(result)),
      channel,
      null,
    );
    window.electron.ipcRenderer.sendMessage(channel, args);
    return response;
  };
  const response = pending.then(send, send);
  pending = response.then(
    () => undefined,
    () => undefined,
  );
  return response;
};

export const getBandDesigns = () =>
  request<IBandDesign[]>(ChannelEnum.GET_BAND_DESIGNS);
export const saveBandDesign = (name: string, id?: string) =>
  request<IBandDesign>(ChannelEnum.SAVE_BAND_DESIGN, [name, id]);
export const applyBandDesign = (id: string) =>
  request<IBandDesign>(ChannelEnum.APPLY_BAND_DESIGN, [id]);

export const deleteBandDesign = (id: string) =>
  request<boolean>(ChannelEnum.DELETE_BAND_DESIGN, [id]);
