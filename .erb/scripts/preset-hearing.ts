/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * How `smoke-presets.ts` reads a render and hears it: the host's float WAV,
 * loudness as the ear weighs it, whether a source is fair to judge levels
 * on at all, and a fair programme built out of one that is not.
 */
import { readFileSync, writeFileSync } from 'fs';
import { FilterTypeEnum } from '../../src/common/constants';
import { IEqSettings } from '../../src/common/dsp/chain';
import { dspPresetVoicing } from '../../src/common/dsp/presetVoicing';
import {
  biquadCoefficients,
  createBiquadState,
  processBiquad,
} from '../../src/renderer/dsp/biquad';

export interface IAudio {
  rate: number;
  channels: Float32Array[];
}

/** The host writes float WAV, but walking chunks keeps the reader honest. */
export const readFloatWav = (file: string): IAudio => {
  const bytes = readFileSync(file);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let at = 12;
  let format = 0;
  let channelCount = 0;
  let rate = 0;
  let bits = 0;
  let dataAt = 0;
  let dataBytes = 0;
  while (at + 8 <= bytes.length) {
    const id = bytes.toString('ascii', at, at + 4);
    const size = view.getUint32(at + 4, true);
    if (id === 'fmt ') {
      format = view.getUint16(at + 8, true);
      channelCount = view.getUint16(at + 10, true);
      rate = view.getUint32(at + 12, true);
      bits = view.getUint16(at + 22, true);
    } else if (id === 'data') {
      dataAt = at + 8;
      dataBytes = size;
      break;
    }
    at += 8 + size + (size % 2);
  }
  if (format !== 3 || bits !== 32 || channelCount < 1 || dataAt === 0) {
    throw new Error(`preset smoke: unreadable float WAV ${file}`);
  }
  const frames = Math.floor(dataBytes / (4 * channelCount));
  const channels = Array.from(
    { length: channelCount },
    () => new Float32Array(frames),
  );
  for (let frame = 0; frame < frames; frame += 1) {
    for (let channel = 0; channel < channelCount; channel += 1) {
      channels[channel][frame] = view.getFloat32(
        dataAt + (frame * channelCount + channel) * 4,
        true,
      );
    }
  }
  return { rate, channels };
};

/** Stereo float WAV, the host's own format, for a programme built here. */
export const writeFloatWav = (file: string, audio: IAudio): void => {
  const [left, right] = audio.channels;
  const frames = left.length;
  const data = Buffer.alloc(44 + frames * 8);
  data.write('RIFF', 0, 'ascii');
  data.writeUInt32LE(36 + frames * 8, 4);
  data.write('WAVEfmt ', 8, 'ascii');
  data.writeUInt32LE(16, 16);
  data.writeUInt16LE(3, 20);
  data.writeUInt16LE(2, 22);
  data.writeUInt32LE(audio.rate, 24);
  data.writeUInt32LE(audio.rate * 8, 28);
  data.writeUInt16LE(8, 32);
  data.writeUInt16LE(32, 34);
  data.write('data', 36, 'ascii');
  data.writeUInt32LE(frames * 8, 40);
  for (let at = 0; at < frames; at += 1) {
    data.writeFloatLE(left[at], 44 + at * 8);
    data.writeFloatLE(right[at], 48 + at * 8);
  }
  writeFileSync(file, data);
};

/** How far behind the song its stand-in ambience runs, and how quietly. */
const AMBIENCE_DELAY_SECONDS = 3.5;
const AMBIENCE_DB = -9;
/** Where the programme's loudest sample lands: -1 dBFS. */
const FAIR_PEAK = 0.89;

/**
 * A fair stereo programme out of one channel of a song: the song in the
 * middle, and the same song AMBIENCE_DELAY_SECONDS later and AMBIENCE_DB down
 * as its sides — unrelated to the middle at any instant, with a musical
 * spectrum, which is what a real mix's ambience is. Left is middle plus side,
 * right is middle minus side, scaled so the loudest sample sits at -1 dBFS.
 *
 * `seconds` of programme needs that much song plus the delay.
 */
export const fairStereo = (
  song: Float32Array,
  rate: number,
  seconds: number,
): IAudio => {
  const frames = Math.round(rate * seconds);
  const shift = Math.round(rate * AMBIENCE_DELAY_SECONDS);
  if (song.length < frames + shift) {
    throw new Error('preset smoke: too little song to build the programme');
  }
  const sideGain = 10 ** (AMBIENCE_DB / 20);
  const left = new Float32Array(frames);
  const right = new Float32Array(frames);
  let peak = 0;
  for (let at = 0; at < frames; at += 1) {
    const side = song[at + shift] * sideGain;
    left[at] = song[at] + side;
    right[at] = song[at] - side;
    peak = Math.max(peak, Math.abs(left[at]), Math.abs(right[at]));
  }
  const scale = FAIR_PEAK / Math.max(peak, 1e-9);
  for (let at = 0; at < frames; at += 1) {
    left[at] *= scale;
    right[at] *= scale;
  }
  return { rate, channels: [left, right] };
};

/** The seconds of song `fairStereo` needs for `seconds` of programme. */
export const songSecondsFor = (seconds: number): number =>
  seconds + AMBIENCE_DELAY_SECONDS + 1;

/**
 * A preset as it is heard: its rack's output, then its curve.
 *
 * A preset's tone left the rack for the main EQ (`presetCurve.ts`), which the
 * engine applies after everything the rack does, with the cookbook filters
 * Equalizer APO renders. So the rack alone no longer says how loud a preset
 * is: Warm's rack lost the level its bass lift carried and measured quieter
 * than DSP Off while nothing a listener hears had moved. The level windows
 * judge the rack and its curve together, before the listener's own headroom;
 * the shape checks stay on the rack, whose limiter they hold, because the
 * curve's headroom is the preamp's to find — on this engine as on APO.
 */
export const withCurve = (
  audio: IAudio,
  id: string,
  curve: IEqSettings,
): IAudio => {
  const filters = Object.values(
    dspPresetVoicing(id, curve).apoOverride?.filters ?? {},
  );
  return {
    rate: audio.rate,
    channels: audio.channels.map((channel) => {
      const out = Float32Array.from(channel);
      filters.forEach((filter) => {
        processBiquad(
          createBiquadState(),
          out,
          biquadCoefficients(
            {
              type: filter.type,
              frequency: filter.frequency,
              gainDb: filter.gain,
              quality: filter.quality,
            },
            audio.rate,
            'clean',
          ),
        );
      });
      return out;
    }),
  };
};

/** Filter warm-up, left out of every measurement here. */
export const settleFrames = (audio: IAudio): number =>
  Math.min(
    Math.floor(audio.rate / 4),
    Math.floor((audio.channels[0]?.length ?? 0) / 4),
  );

const filtered = (
  channel: Float32Array,
  rate: number,
  bands: readonly {
    type: FilterTypeEnum;
    frequency: number;
    gainDb: number;
    quality: number;
  }[],
): Float32Array => {
  const out = Float32Array.from(channel);
  bands.forEach((band) =>
    processBiquad(
      createBiquadState(),
      out,
      biquadCoefficients(band, rate, 'clean'),
    ),
  );
  return out;
};

/** ITU-R BS.1770's K-weighting: its +4 dB shelf and its 38 Hz high pass. */
const K_WEIGHTING = [
  {
    type: FilterTypeEnum.HSC,
    frequency: 1681.974450955533,
    gainDb: 3.999843853973347,
    quality: 0.7071752369554196,
  },
  {
    type: FilterTypeEnum.HPQ,
    frequency: 38.13547087602444,
    gainDb: 0,
    quality: 0.5003270373238773,
  },
];

/**
 * Loudness as the ear weighs it: the RMS of the K-weighted programme, all
 * channels as one (BS.1770 without its gate — the renders are music with no
 * silence to leave out).
 *
 * The level windows compare this rather than RMS. RMS is ruled by the bass,
 * so a curve that trades its low mids for presence (Gaming) read two
 * decibels quiet while sounding level, and one that trades the other way
 * (Warm) read hot — and a window drawn in RMS asks every tone curve to be
 * level in the one band the ear weighs least.
 */
export const heardLevel = (audio: IAudio): number => {
  const skip = settleFrames(audio);
  let sum = 0;
  let count = 0;
  audio.channels.forEach((channel) => {
    const weighted = filtered(channel, audio.rate, K_WEIGHTING);
    for (let at = skip; at < weighted.length; at += 1) {
      sum += weighted[at] * weighted[at];
      count += 1;
    }
  });
  return Math.sqrt(sum / Math.max(1, count));
};

/**
 * How alike the two channels' bass is, from -1 to 1: under 150 Hz, where a
 * mixed record keeps its low end in the middle.
 *
 * A level judged on a source whose bass is out of phase between its channels
 * judges the file: every stage that folds the bass to mono (Bass Forge, Bass
 * Punch, an EQ's mono corner) cancels it outright. The instrumental this gate
 * was drawn on turned out to be exactly that — the right channel the left
 * turned upside down, a correlation of -1.00 — and every mono-bass chain
 * failed the floor on it while sounding level on real records.
 */
export const bassCorrelation = (audio: IAudio): number => {
  const [left, right] = audio.channels;
  if (!right) {
    return 1;
  }
  const lowPass = [
    {
      type: FilterTypeEnum.LPQ,
      frequency: 150,
      gainDb: 0,
      quality: 0.7071,
    },
  ];
  const l = filtered(left, audio.rate, lowPass);
  const r = filtered(right, audio.rate, lowPass);
  const skip = settleFrames(audio);
  let lr = 0;
  let ll = 0;
  let rr = 0;
  for (let at = skip; at < l.length; at += 1) {
    lr += l[at] * r[at];
    ll += l[at] * l[at];
    rr += r[at] * r[at];
  }
  return ll > 0 && rr > 0 ? lr / Math.sqrt(ll * rr) : 1;
};
