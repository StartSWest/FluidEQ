import type { ICaptureGraph } from '../../../renderer/graph/useLiveOutputSpectrum';
import {
  IMirrorEngine,
  IMirrorOutputOptions,
  IMirrorTapOptions,
  MIRROR_BLOCK_FRAMES,
  MIRROR_PLAYBACK_PROFILES,
  startOutputMirror,
} from '../../../renderer/audio/outputMirror';

/**
 * A stand-in for the three Web Audio pieces, recording every side effect in
 * the order it happened. Ordering is the point: the rules under test are
 * about what must already be true before the next thing is allowed.
 */
const createFakes = () => {
  const calls: string[] = [];
  const capture = {} as ICaptureGraph;
  const port1 = { name: 'port1' } as unknown as MessagePort;
  const port2 = { name: 'port2' } as unknown as MessagePort;

  const tap = {
    attach: jest.fn((port: MessagePort) => {
      calls.push(`tap.attach:${(port as unknown as { name: string }).name}`);
    }),
    close: jest.fn(() => {
      calls.push('tap.close');
    }),
  };
  const output = {
    volume: Number.NaN,
    attach: jest.fn((port: MessagePort) => {
      calls.push(`output.attach:${(port as unknown as { name: string }).name}`);
    }),
    setVolume: jest.fn((value: number) => {
      output.volume = value;
      calls.push(`output.volume:${value}`);
    }),
    close: jest.fn(async () => {
      calls.push('output.close');
    }),
  };

  const tapOptions: IMirrorTapOptions[] = [];
  const outputOptions: IMirrorOutputOptions[] = [];
  const engine: IMirrorEngine = {
    createTap: jest.fn(async (options: IMirrorTapOptions) => {
      tapOptions.push(options);
      calls.push('createTap');
      return tap;
    }),
    createOutput: jest.fn(async (options: IMirrorOutputOptions) => {
      outputOptions.push(options);
      output.volume = options.volume;
      calls.push('createOutput');
      return output;
    }),
    createChannel: jest.fn(() => {
      calls.push('createChannel');
      return { port1, port2 };
    }),
  };

  return { calls, capture, engine, output, outputOptions, tap, tapOptions };
};

const start = (
  fakes: ReturnType<typeof createFakes>,
  sinkId = 'sink-1',
  mode: 'video' | 'music' = 'music',
) =>
  startOutputMirror({
    capture: fakes.capture,
    sinkId,
    mode,
    engine: fakes.engine,
  });

describe('mirroring the capture to a second output', () => {
  it('opens the output on the chosen sink, taps the capture, and joins them', async () => {
    const fakes = createFakes();

    const mirror = await start(fakes);

    expect(fakes.outputOptions[0].sinkId).toBe('sink-1');
    expect(fakes.tapOptions[0].capture).toBe(fakes.capture);
    expect(fakes.tapOptions[0].blockFrames).toBe(MIRROR_BLOCK_FRAMES);
    // Both ends are filed under the same name, or the playback side would
    // receive blocks for a source it was never configured for.
    expect(fakes.tapOptions[0].peerId).toBe(fakes.outputOptions[0].peerId);
    expect(mirror.sinkId).toBe('sink-1');
    expect(mirror.mode).toBe('music');
  });

  it('opens the output before touching the capture graph', async () => {
    const fakes = createFakes();

    await start(fakes);

    // A sink id that no longer names anything must fail before a worklet has
    // been added to the shared capture context for nothing.
    expect(fakes.calls.indexOf('createOutput')).toBeLessThan(
      fakes.calls.indexOf('createTap'),
    );
  });

  it('has the output listening before the tap is told where to send', async () => {
    const fakes = createFakes();

    await start(fakes);

    expect(fakes.calls.indexOf('output.attach:port2')).toBeLessThan(
      fakes.calls.indexOf('tap.attach:port1'),
    );
  });

  it('buffers each mode by its own profile', async () => {
    const video = createFakes();
    await start(video, 'sink-1', 'video');
    expect(video.outputOptions[0].profile).toBe(MIRROR_PLAYBACK_PROFILES.video);

    const music = createFakes();
    await start(music, 'sink-1', 'music');
    expect(music.outputOptions[0].profile).toBe(MIRROR_PLAYBACK_PROFILES.music);
  });

  it('keeps lip-sync tighter than a listening room, and both tighter than the LAN', () => {
    const { video, music } = MIRROR_PLAYBACK_PROFILES;
    expect(video.startBufferSeconds).toBeLessThan(music.startBufferSeconds);
    expect(video.maximumBufferSeconds).toBeLessThan(music.maximumBufferSeconds);
    // Video can throw away a stale prefix to get back in sync; music must
    // keep every sample, so it has no catch-up at all.
    expect(video.catchupThresholdSeconds).toBeGreaterThan(0);
    expect(music.catchupThresholdSeconds).toBeUndefined();
    // A tenth of a second is where the LAN listener's video mode starts. A
    // local mirror has no link to protect against and must sit well under it.
    expect(video.startBufferSeconds).toBeLessThan(0.1);
    expect(music.startBufferSeconds).toBeLessThanOrEqual(0.1);
  });

  it('refuses an empty sink id rather than falling back to the default', async () => {
    const fakes = createFakes();

    await expect(start(fakes, '')).rejects.toThrow(
      'No output was chosen to mirror to.',
    );
    expect(fakes.engine.createOutput).not.toHaveBeenCalled();
    expect(fakes.engine.createTap).not.toHaveBeenCalled();
  });

  it('touches nothing when the output cannot be opened', async () => {
    const fakes = createFakes();
    (fakes.engine.createOutput as jest.Mock).mockRejectedValue(
      new Error('Requested device not found'),
    );

    await expect(start(fakes)).rejects.toThrow('Requested device not found');

    // The important half: a failed route must not degrade into a tap left in
    // the shared capture graph, feeding nobody.
    expect(fakes.engine.createTap).not.toHaveBeenCalled();
  });

  it('closes the output when the tap cannot be made', async () => {
    const fakes = createFakes();
    (fakes.engine.createTap as jest.Mock).mockRejectedValue(
      new Error('worklet failed'),
    );

    await expect(start(fakes)).rejects.toThrow('worklet failed');

    expect(fakes.output.close).toHaveBeenCalledTimes(1);
  });

  it('closes both halves when stopped', async () => {
    const fakes = createFakes();

    const mirror = await start(fakes);
    mirror.stop();

    expect(fakes.tap.close).toHaveBeenCalledTimes(1);
    expect(fakes.output.close).toHaveBeenCalledTimes(1);
  });

  it('applies the starting level before the first sample plays', async () => {
    const fakes = createFakes();

    await startOutputMirror({
      capture: fakes.capture,
      sinkId: 'sink-1',
      mode: 'music',
      volume: 0.4,
      engine: fakes.engine,
    });

    // A mirror turned down should not announce itself at full level for the
    // moment before the first update lands: the level is part of opening.
    expect(fakes.outputOptions[0].volume).toBeCloseTo(0.4, 5);
    expect(fakes.output.setVolume).not.toHaveBeenCalled();
  });

  it('changes level without touching the running graph', async () => {
    const fakes = createFakes();

    const mirror = await start(fakes);
    mirror.setVolume(0.25);

    expect(fakes.output.volume).toBeCloseTo(0.25, 5);
    // Nothing was rebuilt: a level is not a reason to put a gap in the audio.
    expect(fakes.engine.createOutput).toHaveBeenCalledTimes(1);
    expect(fakes.engine.createTap).toHaveBeenCalledTimes(1);
    expect(fakes.tap.close).not.toHaveBeenCalled();
  });

  it('holds the level inside what the output can actually do', async () => {
    const fakes = createFakes();

    const mirror = await start(fakes);
    mirror.setVolume(4);
    expect(fakes.output.volume).toBe(1);
    mirror.setVolume(-2);
    expect(fakes.output.volume).toBe(0);
    mirror.setVolume(Number.NaN);
    expect(fakes.output.volume).toBe(1);
  });

  it('is safe to stop twice', async () => {
    const fakes = createFakes();

    const mirror = await start(fakes);
    mirror.stop();
    mirror.stop();

    // Disconnecting a node that is already disconnected throws in Web Audio,
    // so the second stop must not reach the graph at all.
    expect(fakes.tap.close).toHaveBeenCalledTimes(1);
    expect(fakes.output.close).toHaveBeenCalledTimes(1);
  });
});
