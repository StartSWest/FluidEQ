import { MIN_GAIN } from 'common/constants';
import type { ISceneAudio } from '../audio/SceneAudioContext';
import { connectMeterAnalysers } from '../graph/liveCaptureGraph';
import { connectLiveFrameReader } from '../graph/liveFrameReader';
import { FFT_SIZE, createFrequencyAxis } from '../graph/liveSpectrumFrames';
import { createAxisCells } from '../utils/autoBalanceCapture';

/** The Publish dialog's Demo: a short instrumental loop that ships with the
 * app (`studioDemoMusic.ts` in main says what it is and how its join was
 * made), played on repeat when the Demo button is pressed. It replaces a loop
 * synthesised here from sine waves (Ivan, 2026-11-07: "that ugly sound").
 * The preview recorder still receives canvas pixels only, never this audio.
 *
 * `audible: false` measures the same loop without a sound: the Gallery's
 * preview and the Studio's stage move to it while nothing is playing (Ivan,
 * 2026-11-09: "a fake audio but that don't sound, just move"). What the loop
 * goes into still feeds the destination, through a gain of nought, so the
 * graph is pulled exactly as an audible one is.
 *
 * MEASURED AS THE CAPTURE MEASURES MUSIC (Ivan, 2026-11-09: "improve the
 * sound to be more natural toward the bass"). The loop used to be read by a
 * 2048-point analyser of its own: every frame scaled to its own loudest bin,
 * which on this loop is the bass, so the bass sat pinned at the top and never
 * swelled with the kick; every point one rounded bin 23 Hz wide, a staircase
 * under 150 Hz; and no sound at all, so a scene's kick, tempo and rhythm were
 * never heard on it. It now goes through the capture's own reader
 * (`connectLiveFrameReader`) and meters (`connectMeterAnalysers`): one scale
 * that follows the music down by a decibel a second, the long window under
 * the bass, and the sound the runner hears kicks in - a scene moves to the
 * demo as it would to the same song playing. */
export default function createPublishDemoAudio(
  paused = false,
  { audible = true }: { audible?: boolean } = {},
) {
  const context = new AudioContext();
  // Where the loop goes in, and everything that measures it hangs off.
  const input = context.createGain();
  if (audible) {
    input.connect(context.destination);
  } else {
    const mute = context.createGain();
    mute.gain.value = 0;
    input.connect(mute).connect(context.destination);
  }
  const axis = createFrequencyAxis(context.sampleRate);
  const reader = connectLiveFrameReader(context, input, {
    channelAnalysers: connectMeterAnalysers(context, input, true)
      .meterAnalysers,
    axis,
    cells: createAxisCells(axis, context.sampleRate, FFT_SIZE),
    trackReference: { current: undefined },
    // No pump runs beside this reader to let the scale fall: it does.
    releaseReference: () => true,
  });
  let source: AudioBufferSourceNode | undefined;
  let stopped = false;
  // Paused or not as last asked, also while the file is still on its way.
  let wantPaused = paused;
  const settle = () => (wantPaused ? context.suspend() : context.resume());
  const ready = (async () => {
    const bytes = await window.electron?.ipcRenderer?.readStudioDemoMusic?.();
    if (!bytes) {
      throw new Error('The demo music could not be read');
    }
    // A copy of exactly the file's bytes: decoding takes its buffer over, and
    // the array handed across may be a view into a larger one.
    const music = await context.decodeAudioData(bytes.slice().buffer);
    if (stopped) {
      return undefined;
    }
    // A buffer source loops on the sample, where a media element's `loop`
    // leaves a gap at every repeat.
    const playing = context.createBufferSource();
    playing.buffer = music;
    playing.loop = true;
    playing.connect(input);
    playing.start();
    source = playing;
    await settle();
    if (!wantPaused && !stopped && context.state !== 'running') {
      throw new Error('Demo audio could not start');
    }
    return undefined;
  })();
  // What a provider holds between frames to say there is music
  // (`useQuietDemoAudio`): never empty, so the runner wakes a scene that had
  // come to rest in the silence before the demo began. The measurements
  // themselves are read through `readFrame`, every frame.
  const points = axis.map((x) => ({ x, y: MIN_GAIN }));
  const waveform = [0];
  const silence = { points: [], waveform: [], sound: undefined };
  const readFrame: ISceneAudio['readFrame'] = () =>
    stopped ||
    !source ||
    context.state !== 'running' ||
    context.currentTime === 0
      ? silence
      : reader.read();
  return {
    ready,
    readFrame,
    points,
    waveform,
    setPaused: (next: boolean) => {
      wantPaused = next;
      return settle();
    },
    stop: () => {
      stopped = true;
      source?.stop();
      source?.disconnect();
      input.disconnect();
      return context.close();
    },
  };
}
