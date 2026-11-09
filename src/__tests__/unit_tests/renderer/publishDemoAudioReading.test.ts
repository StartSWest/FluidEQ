/**
 * The demo song is measured as the capture measures music
 * (`publishDemoAudio.ts`): through the capture's own reader and meters, so a
 * scene hears its kick, tempo and rhythm (the reader's `sound`), its bass on
 * the long window and on one scale that follows the music down - not a frame
 * scaled to its own loudest bin, which pinned this loop's bass at the top and
 * never let it swell with the kick.
 */
import createPublishDemoAudio from 'renderer/studio/publishDemoAudio';
import { connectMeterAnalysers } from 'renderer/graph/liveCaptureGraph';
import { connectLiveFrameReader } from 'renderer/graph/liveFrameReader';

const mockFrame = {
  points: [{ x: 60, y: 4 }],
  graphPoints: [],
  waveform: [0.4],
  audioMs: 1000,
  channelPeaks: [0.4, 0.4],
  sound: { take: () => [], music: () => ({}) },
};
jest.mock('renderer/graph/liveFrameReader', () => ({
  connectLiveFrameReader: jest.fn(() => ({ read: () => mockFrame })),
}));
jest.mock('renderer/graph/liveCaptureGraph', () => ({
  connectMeterAnalysers: jest.fn(() => ({
    splitter: undefined,
    meterAnalysers: ['left meter', 'right meter'],
  })),
}));

interface IFakeNode {
  kind: string;
  gain: { value: number };
  connected: IFakeNode[];
  connect: jest.Mock;
  disconnect: jest.Mock;
  start: jest.Mock;
  stop: jest.Mock;
}
const node = (kind: string): IFakeNode => {
  const made: IFakeNode = {
    kind,
    gain: { value: 1 },
    connected: [],
    connect: jest.fn((to: IFakeNode) => {
      made.connected.push(to);
      return to;
    }),
    disconnect: jest.fn(),
    start: jest.fn(),
    stop: jest.fn(),
  };
  return made;
};
const made: { gains: IFakeNode[]; sources: IFakeNode[] } = {
  gains: [],
  sources: [],
};
const destination = node('destination');
const makeGain = () => {
  const gain = node('gain');
  made.gains.push(gain);
  return gain;
};
const makeSource = () => {
  const source = node('source');
  made.sources.push(source);
  return source;
};
const decoded = () => Promise.resolve({ duration: 17 });
const settled = () => Promise.resolve();
class FakeContext {
  sampleRate = 48000;

  state = 'suspended';

  currentTime = 0;

  destination = destination;

  createGain = makeGain;

  createBufferSource = makeSource;

  decodeAudioData = decoded;

  close = settled;

  resume() {
    this.state = 'running';
    this.currentTime = 1;
    return Promise.resolve();
  }

  suspend() {
    this.state = 'suspended';
    return Promise.resolve();
  }
}

beforeAll(() => {
  Object.defineProperty(window, 'AudioContext', {
    configurable: true,
    value: FakeContext,
  });
  Object.defineProperty(window, 'electron', {
    configurable: true,
    get: () => ({
      ipcRenderer: {
        readStudioDemoMusic: () => Promise.resolve(new Uint8Array([1, 2, 3])),
      },
    }),
  });
});

beforeEach(() => {
  made.gains.length = 0;
  made.sources.length = 0;
  destination.connected.length = 0;
  jest.mocked(connectLiveFrameReader).mockClear();
  jest.mocked(connectMeterAnalysers).mockClear();
});

it("measures the loop through the capture's own reader, sound included", async () => {
  const demo = createPublishDemoAudio(false, { audible: false });
  await demo.ready;
  const [input] = made.gains;
  // The loop goes into the node every measurement hangs off.
  expect(made.sources[0].connected).toEqual([input]);
  const [context, source, options] = jest.mocked(connectLiveFrameReader).mock
    .calls[0];
  expect(context).toBeInstanceOf(FakeContext);
  expect(source).toBe(input);
  // Both meters, a stereo pair, on the same node.
  expect(connectMeterAnalysers).toHaveBeenCalledWith(context, input, true);
  expect(options.channelAnalysers).toEqual(['left meter', 'right meter']);
  // No pump beside it: the reader lets its own scale fall.
  expect(options.releaseReference?.()).toBe(true);
  expect(options.axis.length).toBeGreaterThan(0);
  expect(options.cells).toHaveLength(options.axis.length);
  // What a scene reads is the reader's frame, kicks and tempo with it.
  expect(demo.readFrame()).toBe(mockFrame);
  expect(demo.readFrame()?.sound).toBe(mockFrame.sound);
});

it('reads as silence until the loop is playing', () => {
  const demo = createPublishDemoAudio(false, { audible: false });
  expect(demo.readFrame()).toEqual({
    points: [],
    waveform: [],
    sound: undefined,
  });
  // Something to say there is music, for the runner to wake on.
  expect(demo.points.length).toBeGreaterThan(0);
});

it('is pulled through a gain of nought when it must not be heard', async () => {
  const demo = createPublishDemoAudio(false, { audible: false });
  await demo.ready;
  const [input, mute] = made.gains;
  expect(input.connected).toEqual([mute]);
  expect(mute.gain.value).toBe(0);
  expect(mute.connected).toEqual([destination]);
});

it('is heard as it is measured when it is the Demo button', async () => {
  const demo = createPublishDemoAudio(false);
  await demo.ready;
  const [input] = made.gains;
  expect(input.connected).toEqual([destination]);
  expect(demo.readFrame()).toBe(mockFrame);
});
