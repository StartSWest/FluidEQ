import { MAX_GAIN, MIN_GAIN } from 'common/constants';
import {
  STUDIO_TEST_BPM,
  STUDIO_TEST_CYCLE_BEATS,
} from 'common/studioTestMusic';
import type { ISceneAudio } from '../audio/SceneAudioContext';

/** An audible, local musical loop started only by the Demo button. Studio
 * hears its real analyser, not the stage's synthetic showcase measurements.
 * The preview recorder still receives canvas pixels only, never this audio. */
export default function createPublishDemoAudio(paused = false) {
  const context = new AudioContext();
  const analyser = context.createAnalyser();
  analyser.fftSize = 2048;
  analyser.smoothingTimeConstant = 0.2;
  const seconds = (60 / STUDIO_TEST_BPM) * STUDIO_TEST_CYCLE_BEATS;
  const buffer = context.createBuffer(
    1,
    Math.ceil(context.sampleRate * seconds),
    context.sampleRate,
  );
  const samples = buffer.getChannelData(0);
  const notes = [130.81, 164.81, 196, 261.63, 110, 164.81, 220, 329.63];
  for (let index = 0; index < samples.length; index += 1) {
    const time = index / context.sampleRate;
    const beat = (time * STUDIO_TEST_BPM) / 60;
    const age = ((beat % 1) * 60) / STUDIO_TEST_BPM;
    const pluckAge = (((beat * 2) % 1) * 30) / STUDIO_TEST_BPM;
    const note = notes[Math.floor(beat * 2) % notes.length];
    const kick =
      Math.sin(2 * Math.PI * (52 * age + 1.6 * (1 - Math.exp(-age * 35)))) *
      Math.exp(-age * 15);
    const pluck =
      Math.sin(2 * Math.PI * note * pluckAge) * Math.exp(-pluckAge * 14);
    const hat =
      Math.sin(time * 75431) *
      Math.sin(time * 61897) *
      Math.exp(-pluckAge * 100);
    const pad =
      Math.sin(2 * Math.PI * 130.81 * time) +
      Math.sin(2 * Math.PI * 196 * time);
    // A short edge ramp makes the loop's boundary silent without a click.
    const edge = Math.min(1, time * 100, (seconds - time) * 100);
    samples[index] =
      (kick * 0.19 + pluck * 0.09 + hat * 0.035 + pad * 0.025) * edge;
  }
  const source = context.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  source.connect(analyser);
  analyser.connect(context.destination);
  source.start();
  const ready = (paused ? context.suspend() : context.resume()).then(() => {
    if (!paused && context.state !== 'running') {
      throw new Error('Demo audio could not start');
    }
    return undefined;
  });
  const bins = new Float32Array(analyser.frequencyBinCount);
  const wave = new Float32Array(analyser.fftSize);
  const points = Array.from({ length: 320 }, (_, index) => ({
    x: 20 * 1000 ** (index / 319),
    y: MIN_GAIN,
  }));
  const waveform = Array.from({ length: 96 }, () => 0);
  const silence = { points: [], waveform: [], sound: undefined };
  let stopped = false;
  const readFrame: ISceneAudio['readFrame'] = () => {
    if (stopped || context.state !== 'running' || context.currentTime === 0) {
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
    setPaused: (next: boolean) => (next ? context.suspend() : context.resume()),
    stop: () => {
      stopped = true;
      source.stop();
      source.disconnect();
      analyser.disconnect();
      return context.close();
    },
  };
}
