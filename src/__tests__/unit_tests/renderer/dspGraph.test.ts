/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { IAudioNodeLike, buildDspGraph } from '../../../renderer/dsp/graph';

interface IFakeNode extends IAudioNodeLike {
  connect: jest.Mock;
  disconnect: jest.Mock;
}

const fakeNode = (): IFakeNode => ({
  connect: jest.fn(),
  disconnect: jest.fn(),
});

describe('dsp graph', () => {
  it('wires the source through the passthrough node to the destination', () => {
    const source = fakeNode();
    const worklet = fakeNode();
    const destination = fakeNode();

    buildDspGraph(source, worklet, destination);

    expect(source.connect).toHaveBeenCalledWith(worklet);
    expect(worklet.connect).toHaveBeenCalledWith(destination);
  });

  it('never feeds the retired worklet control port', () => {
    const source = fakeNode();
    const worklet = {
      ...fakeNode(),
      port: { postMessage: jest.fn() },
    };

    buildDspGraph(source, worklet, fakeNode());

    expect(worklet.port.postMessage).not.toHaveBeenCalled();
  });

  it('disconnects every node it owns', () => {
    const source = fakeNode();
    const worklet = fakeNode();
    const graph = buildDspGraph(source, worklet, fakeNode());

    graph.dispose();

    expect(source.disconnect).toHaveBeenCalledTimes(1);
    expect(worklet.disconnect).toHaveBeenCalledTimes(1);
  });
});
