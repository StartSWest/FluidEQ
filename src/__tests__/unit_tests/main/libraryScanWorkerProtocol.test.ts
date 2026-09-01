/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  IScanWorkerRequest,
  onHostMessage,
  postToHost,
} from '../../../main/library/scanWorkerProtocol';

interface IFakeParentPort {
  postMessage: jest.Mock<void, [unknown]>;
  on: jest.Mock<
    void,
    ['message', (event: { data: IScanWorkerRequest }) => void]
  >;
}

const utilityProcess = process as unknown as {
  parentPort?: IFakeParentPort;
};

describe('the packaged library worker channel', () => {
  afterEach(() => {
    delete utilityProcess.parentPort;
  });

  it('uses Electron utilityProcess process.parentPort in both directions', () => {
    let receive: ((event: { data: IScanWorkerRequest }) => void) | undefined;
    const port: IFakeParentPort = {
      postMessage: jest.fn(),
      on: jest.fn((_event, listener) => {
        receive = listener;
      }),
    };
    utilityProcess.parentPort = port;
    const listener = jest.fn<void, [IScanWorkerRequest]>();

    onHostMessage(listener);
    const request: IScanWorkerRequest = {
      type: 'scan',
      rootId: 'music-root',
      rootPath: 'C:\\Music',
      userDataDir: 'C:\\FluidEQ',
      known: [],
    };
    // Electron's ParentPort emits a MessageEvent. The value sent by the host
    // is its `data`, never the event object itself.
    receive?.({ data: request });
    postToHost({ type: 'failed', message: 'proof' });

    expect(port.on).toHaveBeenCalledWith('message', expect.any(Function));
    expect(listener).toHaveBeenCalledWith(request);
    expect(port.postMessage).toHaveBeenCalledWith({
      type: 'failed',
      message: 'proof',
    });
  });
});
