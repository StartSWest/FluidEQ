import fs from 'fs';
import { FilterTypeEnum, IFilter, IFiltersMap } from '../common/constants';

const SAMPLE_RATE = 48000;
const IMPULSE_LENGTH = 16384;

interface ITransferFunction {
  b0: number;
  b1: number;
  b2: number;
  a1: number;
  a2: number;
}

const getTransferFunction = (filter: IFilter): ITransferFunction => {
  const gain = 10 ** (filter.gain / 40);
  const omega = (2 * Math.PI * filter.frequency) / SAMPLE_RATE;
  const cosine = Math.cos(omega);
  const sine = Math.sin(omega);
  const shelf =
    filter.type === FilterTypeEnum.LSC || filter.type === FilterTypeEnum.HSC;
  const alpha = shelf
    ? (sine / 2) *
      Math.sqrt((gain + 1 / gain) * (1 / (filter.quality / 2) - 1) + 2)
    : sine / (2 * filter.quality);
  const beta = shelf ? 2 * Math.sqrt(gain) * alpha : 0;

  let b0 = 0;
  let b1 = 0;
  let b2 = 0;
  let a0 = 0;
  let a1 = 0;
  let a2 = 0;

  if (filter.type === FilterTypeEnum.LSC) {
    b0 = gain * (gain + 1 - (gain - 1) * cosine + beta);
    b1 = 2 * gain * (gain - 1 - (gain + 1) * cosine);
    b2 = gain * (gain + 1 - (gain - 1) * cosine - beta);
    a0 = gain + 1 + (gain - 1) * cosine + beta;
    a1 = -2 * (gain - 1 + (gain + 1) * cosine);
    a2 = gain + 1 + (gain - 1) * cosine - beta;
  } else if (filter.type === FilterTypeEnum.HSC) {
    b0 = gain * (gain + 1 + (gain - 1) * cosine + beta);
    b1 = -2 * gain * (gain - 1 + (gain + 1) * cosine);
    b2 = gain * (gain + 1 + (gain - 1) * cosine - beta);
    a0 = gain + 1 - (gain - 1) * cosine + beta;
    a1 = 2 * (gain - 1 - (gain + 1) * cosine);
    a2 = gain + 1 - (gain - 1) * cosine - beta;
  } else if (filter.type === FilterTypeEnum.PK) {
    b0 = 1 + alpha * gain;
    b1 = -2 * cosine;
    b2 = 1 - alpha * gain;
    a0 = 1 + alpha / gain;
    a1 = -2 * cosine;
    a2 = 1 - alpha / gain;
  } else if (filter.type === FilterTypeEnum.NO) {
    b0 = 1;
    b1 = -2 * cosine;
    b2 = 1;
    a0 = 1 + alpha;
    a1 = -2 * cosine;
    a2 = 1 - alpha;
  } else if (filter.type === FilterTypeEnum.LPQ) {
    b0 = (1 - cosine) / 2;
    b1 = 1 - cosine;
    b2 = (1 - cosine) / 2;
    a0 = 1 + alpha;
    a1 = -2 * cosine;
    a2 = 1 - alpha;
  } else if (filter.type === FilterTypeEnum.HPQ) {
    b0 = (1 + cosine) / 2;
    b1 = -(1 + cosine);
    b2 = (1 + cosine) / 2;
    a0 = 1 + alpha;
    a1 = -2 * cosine;
    a2 = 1 - alpha;
  } else {
    b0 = alpha;
    b1 = 0;
    b2 = -alpha;
    a0 = 1 + alpha;
    a1 = -2 * cosine;
    a2 = 1 - alpha;
  }

  return {
    b0: b0 / a0,
    b1: b1 / a0,
    b2: b2 / a0,
    a1: a1 / a0,
    a2: a2 / a0,
  };
};

const applyFilter = (signal: Float32Array, transfer: ITransferFunction) => {
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  for (let i = 0; i < signal.length; i += 1) {
    const input = signal[i];
    const output =
      transfer.b0 * input +
      transfer.b1 * x1 +
      transfer.b2 * x2 -
      transfer.a1 * y1 -
      transfer.a2 * y2;
    signal[i] = output;
    x2 = x1;
    x1 = input;
    y2 = y1;
    y1 = output;
  }
};

const createImpulse = (filters: IFiltersMap) => {
  const impulse = new Float32Array(IMPULSE_LENGTH);
  impulse[0] = 1;
  Object.values(filters).forEach((filter) => {
    applyFilter(impulse, getTransferFunction(filter));
  });
  return Array.from(impulse);
};

/** Write a mono 32-bit float impulse response understood by Equalizer APO. */
export const writeConvolutionWav = (filePath: string, filters: IFiltersMap) => {
  const samples = createImpulse(filters);
  const dataSize = samples.length * 4;
  const wav = Buffer.alloc(44 + dataSize);
  wav.write('RIFF', 0);
  wav.writeUInt32LE(36 + dataSize, 4);
  wav.write('WAVE', 8);
  wav.write('fmt ', 12);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(3, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(SAMPLE_RATE, 24);
  wav.writeUInt32LE(SAMPLE_RATE * 4, 28);
  wav.writeUInt16LE(4, 32);
  wav.writeUInt16LE(32, 34);
  wav.write('data', 36);
  wav.writeUInt32LE(dataSize, 40);
  samples.forEach((sample, index) => {
    wav.writeFloatLE(sample, 44 + index * 4);
  });
  fs.writeFileSync(filePath, wav);
};
