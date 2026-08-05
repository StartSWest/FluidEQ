import {
  IMirrorSink,
  startOutputMirror,
} from '../../../renderer/audio/outputMirror';

const createFakes = () => {
  /** Every side effect, in the order it happened. Ordering is the point. */
  const calls: string[] = [];
  const stream = {} as MediaStream;
  const destination = { stream } as unknown as MediaStreamAudioDestinationNode;

  const context = {
    createMediaStreamDestination: jest.fn(() => {
      calls.push('createDestination');
      return destination;
    }),
  };
  const source = {
    connect: jest.fn(() => {
      calls.push('connect');
    }),
    disconnect: jest.fn(() => {
      calls.push('disconnect');
    }),
  };
  const sink: IMirrorSink = {
    srcObject: null,
    setSinkId: jest.fn(async () => {
      calls.push('setSinkId');
    }),
    play: jest.fn(async () => {
      calls.push('play');
    }),
    pause: jest.fn(() => {
      calls.push('pause');
    }),
  };

  return { calls, context, source, sink, destination, stream };
};

const start = (fakes: ReturnType<typeof createFakes>, sinkId = 'sink-1') =>
  startOutputMirror({
    context: fakes.context,
    source: fakes.source,
    sinkId,
    createSink: () => fakes.sink,
  });

describe('mirroring the capture to a second output', () => {
  it('routes the capture into the chosen sink and plays it', async () => {
    const fakes = createFakes();

    const mirror = await start(fakes);

    expect(fakes.source.connect).toHaveBeenCalledWith(fakes.destination);
    expect(fakes.sink.srcObject).toBe(fakes.stream);
    expect(fakes.sink.setSinkId).toHaveBeenCalledWith('sink-1');
    expect(fakes.sink.play).toHaveBeenCalled();
    expect(mirror.sinkId).toBe('sink-1');
  });

  it('selects the sink before it ever plays', async () => {
    const fakes = createFakes();

    await start(fakes);

    // An element that has not been pointed at a sink plays out of the default
    // device — the very endpoint being captured. Playing first would put a
    // burst of feedback in the user's ears on every single start.
    expect(fakes.calls.indexOf('setSinkId')).toBeLessThan(
      fakes.calls.indexOf('play'),
    );
  });

  it('ends the chain at a stream destination, never at the context output', async () => {
    const fakes = createFakes();

    await start(fakes);

    // `context.destination` is the default output, which is what the loopback
    // is capturing. Connecting there closes the loop and builds every pass.
    expect(fakes.context.createMediaStreamDestination).toHaveBeenCalledTimes(1);
    expect(fakes.source.connect).toHaveBeenCalledTimes(1);
    expect(fakes.source.connect).toHaveBeenCalledWith(fakes.destination);
  });

  it('refuses an empty sink id rather than falling back to the default', async () => {
    const fakes = createFakes();

    await expect(start(fakes, '')).rejects.toThrow(
      'No output was chosen to mirror to.',
    );
    expect(fakes.context.createMediaStreamDestination).not.toHaveBeenCalled();
    expect(fakes.source.connect).not.toHaveBeenCalled();
    expect(fakes.sink.play).not.toHaveBeenCalled();
  });

  it('does not play when the sink cannot be selected', async () => {
    const fakes = createFakes();
    (fakes.sink.setSinkId as jest.Mock).mockRejectedValue(
      new Error('Requested device not found'),
    );

    await expect(start(fakes)).rejects.toThrow('Requested device not found');

    // The important half: a failed route must not degrade into playing out of
    // the default device.
    expect(fakes.sink.play).not.toHaveBeenCalled();
    expect(fakes.source.disconnect).toHaveBeenCalledWith(fakes.destination);
    expect(fakes.sink.srcObject).toBeNull();
  });

  it('leaves nothing connected when playback itself fails', async () => {
    const fakes = createFakes();
    (fakes.sink.play as jest.Mock).mockRejectedValue(new Error('play blocked'));

    await expect(start(fakes)).rejects.toThrow('play blocked');

    expect(fakes.source.disconnect).toHaveBeenCalledWith(fakes.destination);
    expect(fakes.sink.pause).toHaveBeenCalled();
    expect(fakes.sink.srcObject).toBeNull();
  });

  it('detaches from the shared capture when stopped', async () => {
    const fakes = createFakes();

    const mirror = await start(fakes);
    mirror.stop();

    // The source node is shared with the analyser, so stopping the mirror must
    // disconnect only this branch and never touch the node itself.
    expect(fakes.source.disconnect).toHaveBeenCalledWith(fakes.destination);
    expect(fakes.sink.pause).toHaveBeenCalled();
    expect(fakes.sink.srcObject).toBeNull();
  });

  it('is safe to stop twice', async () => {
    const fakes = createFakes();

    const mirror = await start(fakes);
    mirror.stop();
    mirror.stop();

    expect(fakes.source.disconnect).toHaveBeenCalledTimes(1);
  });
});
