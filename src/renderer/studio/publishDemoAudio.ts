import { MAX_GAIN, MIN_GAIN } from 'common/constants';
import type { ISceneAudio } from '../audio/SceneAudioContext';

/** The Publish dialog's Demo: a short instrumental loop that ships with the
 * app (`studioDemoMusic.ts` in main says what it is and how its join was
 * made), played on repeat when the Demo button is pressed. It replaces a loop
 * synthesised here from sine waves (Ivan, 2026-11-07: "that ugly sound").
 * Studio hears its real analyser, not the stage's synthetic showcase
 * measurements. The preview recorder still receives canvas pixels only, never
 * this audio.
 *
 * `audible: false` measures the same loop without a sound: the Gallery's
 * preview moves to it while nothing is playing (Ivan, 2026-11-09: "a fake
 * audio but that don't sound, just move"). The analyser still feeds the
 * destination, through a gain of nought, because a graph that reaches no
 * destination is not pulled and its analyser reads nothing. */
export default function createPublishDemoAudio(
  paused = false,
  { audible = true }: { audible?: boolean } = {},
) {
  const context = new AudioContext();
  const analyser = context.createAnalyser();
  analyser.fftSize = 2048;
  analyser.smoothingTimeConstant = 0.2;
  if (audible) {
    analyser.connect(context.destination);
  } else {
    const mute = context.createGain();
    mute.gain.value = 0;
    analyser.connect(mute).connect(context.destination);
  }
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
    playing.connect(analyser);
    playing.start();
    source = playing;
    await settle();
    if (!wantPaused && !stopped && context.state !== 'running') {
      throw new Error('Demo audio could not start');
    }
    return undefined;
  })();
  const bins = new Float32Array(analyser.frequencyBinCount);
  const wave = new Float32Array(analyser.fftSize);
  const points = Array.from({ length: 320 }, (_, index) => ({
    x: 20 * 1000 ** (index / 319),
    y: MIN_GAIN,
  }));
  const waveform = Array.from({ length: 96 }, () => 0);
  const silence = { points: [], waveform: [], sound: undefined };
  const readFrame: ISceneAudio['readFrame'] = () => {
    if (
      stopped ||
      !source ||
      context.state !== 'running' ||
      context.currentTime === 0
    ) {
      return silence;
    }
    analyser.getFloatFrequencyData(bins);
    analyser.getFloatTimeDomainData(wave);
    let peak = -100;
    bins.forEach((value) => {
      peak = Math.max(peak, value);
    });
    points.forEach((point) => {
      const bin = Math.min(
        bins.length - 1,
        Math.round((point.x * analyser.fftSize) / context.sampleRate),
      );
      point.y = Math.max(
        MIN_GAIN,
        Math.min(MAX_GAIN, bins[bin] - peak + MAX_GAIN),
      );
    });
    waveform.forEach((_value, index) => {
      const from = Math.floor((index * wave.length) / waveform.length);
      const to = Math.floor(((index + 1) * wave.length) / waveform.length);
      let amplitude = 0;
      for (let sample = from; sample < to; sample += 1) {
        amplitude = Math.max(amplitude, Math.abs(wave[sample]));
      }
      waveform[index] = amplitude;
    });
    return { points, waveform, sound: undefined };
  };
  return {
    ready,
    readFrame,
    // The arrays `readFrame` fills in place, for a provider that has to say
    // there is music without a React render per frame (`useQuietDemoAudio`).
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
      analyser.disconnect();
      return context.close();
    },
  };
}
