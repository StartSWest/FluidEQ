/* eslint-disable */
import { stateToString } from './main/flush';
import { parseEqText } from './common/apoText';
import {
  AutoEqFormat,
  FilterTypeEnum,
  getDefaultState,
  IState,
} from './common/constants';

const base: IState = {
  ...getDefaultState(),
  isEnabled: true,
  isAutoPreAmpOn: true,
  preAmp: -3,
  filters: {
    a: { id: 'a', frequency: 100, gain: 4.5, quality: 1.2, type: FilterTypeEnum.PK },
    b: { id: 'b', frequency: 60, gain: 0, quality: 0.7, type: FilterTypeEnum.LSC },
    c: { id: 'c', frequency: 8000, gain: -2, quality: 0.71, type: FilterTypeEnum.HSC },
    d: { id: 'd', frequency: 30, gain: 6, quality: 0.7, type: FilterTypeEnum.HPQ },
    e: { id: 'e', frequency: 5000, gain: 3, quality: 12, type: FilterTypeEnum.NO },
  },
  eqFormat: AutoEqFormat.PARAMETRIC,
  isFlat: false,
  voicing: { profileId: 'music', intensity: 0.5 },
  driver: { profileId: 'planar-headphone', intensity: 0.8 },
  headset: 'Sennheiser HD 600',
  convolution: {
    name: 'HD 600 correction',
    filters: {},
    fileName: 'hd600.wav',
    sourceUrl: 'https://example.invalid/hd600',
    sourceId: 'hd600',
  },
};

const text = stateToString(base, 'hd600.wav', '{0.0.0.00000000}.{abc}');
console.log('=== WRITTEN (JSON-escaped, shows separators) ===');
console.log(JSON.stringify(text));
console.log('=== WRITTEN (raw) ===');
console.log(text);
const parsed = parseEqText(text);
console.log('=== PARSED BACK ===');
console.log(
  JSON.stringify(
    {
      preAmp: parsed.preAmp,
      eqFormat: parsed.eqFormat,
      convolutionFileName: parsed.convolutionFileName,
      unsupported: parsed.unsupported,
      isEmpty: parsed.isEmpty,
      filterCount: Object.keys(parsed.filters).length,
      filters: Object.values(parsed.filters).map(
        (f) => `${f.type} ${f.frequency} ${f.gain} ${f.quality}`,
      ),
    },
    null,
    2,
  ),
);

console.log('=== GRAPHIC + VOICING ===');
const g: IState = {
  ...base,
  eqFormat: AutoEqFormat.GRAPHIC,
  graphicEq: [
    { frequency: 20, gain: -1.2 },
    { frequency: 0.5, gain: 3 },
    { frequency: 25000, gain: 2 },
  ],
};
const gtext = stateToString(g, undefined, 'all');
console.log(gtext);
const gparsed = parseEqText(gtext);
console.log(
  JSON.stringify(
    {
      eqFormat: gparsed.eqFormat,
      graphicEq: gparsed.graphicEq,
      filterCount: Object.keys(gparsed.filters).length,
      filters: Object.values(gparsed.filters).map(
        (f) => `${f.type} ${f.frequency} ${f.gain} ${f.quality}`,
      ),
      preAmp: gparsed.preAmp,
    },
    null,
    2,
  ),
);

console.log('=== DISABLED ===');
console.log(JSON.stringify(stateToString({ ...base, isEnabled: false })));
console.log(JSON.stringify(parseEqText(stateToString({ ...base, isEnabled: false }))));

console.log('=== isFlat: true ===');
console.log(stateToString({ ...base, isFlat: true }, 'hd600.wav', 'all'));

console.log('=== FIXED_BAND ===');
const fb = stateToString({ ...base, eqFormat: AutoEqFormat.FIXED_BAND }, undefined, 'all');
console.log(parseEqText(fb).eqFormat);

console.log('=== tiny gain exponential ===');
const tiny = stateToString(
  {
    ...getDefaultState(),
    isEnabled: true,
    isAutoPreAmpOn: false,
    preAmp: 0,
    filters: {
      z: { id: 'z', frequency: 1000, gain: 1e-7, quality: 1, type: FilterTypeEnum.PK },
    },
  },
  undefined,
  'all',
);
console.log(JSON.stringify(tiny));
console.log(JSON.stringify(parseEqText(tiny)));
