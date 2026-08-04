import { FilterTypeEnum } from 'common/constants';
import {
  getAutoEqDeviceList,
  getAutoEqPreset,
  getAutoEqResponseList,
} from 'main/autoeq';
import { addFileToPath } from 'main/flush';

const TEST_DATA_READ_DIR = 'src/__tests__/data/read_only';

describe('autoeq', () => {
  describe('getAutoEqDeviceList', () => {
    it('should fetch auto eq device names', () => {
      const devices = getAutoEqDeviceList(
        addFileToPath(TEST_DATA_READ_DIR, 'autoeq'),
      );
      expect(devices).toMatchObject(['autoeqPreset']);
    });
  });

  describe('getAutoEqResponseList', () => {
    it('should fetch auto eq response names', () => {
      const responses = getAutoEqResponseList(
        'autoeqPreset',
        addFileToPath(TEST_DATA_READ_DIR, 'autoeq'),
      );
      expect(responses).toEqual(
        expect.arrayContaining([
          'testResponse',
          'graphicResponse - GraphicEQ.txt',
          'fixedResponse - FixedBandEQ.txt',
        ]),
      );
    });
  });

  describe('getAutoEqPreset', () => {
    it('should fetch auto eq preset data', () => {
      const preset = getAutoEqPreset(
        'autoeqPreset',
        'testResponse',
        addFileToPath(TEST_DATA_READ_DIR, 'autoeq'),
      );

      expect(preset).toMatchObject({
        preAmp: -6.7,
      });
      expect(preset.filters).toBeDefined();
      // Looked up by frequency, never by position.
      //
      // Band ids come from uid(8). 2.31% of those are all digits, and 2.08% are
      // canonical array indices — the difference is a leading zero, which keeps
      // a key insertion-ordered. V8 enumerates the index-like keys first, so one
      // numeric id anywhere in the map silently moves a different band to the
      // front of Object.keys. With ten bands that is a 19% chance per run, which
      // is what "passes locally, fails in CI" looks like from the inside.
      expect(
        Object.values(preset.filters).find((band) => band.frequency === 200),
      ).toMatchObject({
        frequency: 200,
        gain: 8.8,
        quality: 0.7,
        type: FilterTypeEnum.LSC,
      });
      // What the old assertion was really checking with `id: key`, now stated
      // for every band rather than whichever one came out first.
      Object.entries(preset.filters).forEach(([id, band]) => {
        expect(band.id).toBe(id);
      });
    });

    it('loads GraphicEQ points and preserves the native format', () => {
      const preset = getAutoEqPreset(
        'autoeqPreset',
        'graphicResponse - GraphicEQ.txt',
        addFileToPath(TEST_DATA_READ_DIR, 'autoeq'),
      );

      expect(preset.eqFormat).toBe('graphic');
      expect(preset.preAmp).toBe(-6.8);
      expect(preset.graphicEq).toHaveLength(15);
      expect(Object.keys(preset.filters)).toHaveLength(15);
    });

    it('loads FixedBandEQ as fixed APO filter bands', () => {
      const preset = getAutoEqPreset(
        'autoeqPreset',
        'fixedResponse - FixedBandEQ.txt',
        addFileToPath(TEST_DATA_READ_DIR, 'autoeq'),
      );

      expect(preset.eqFormat).toBe('fixed-band');
      // By frequency, not by key order — see the note in the ParametricEQ test
      // above. This is the assertion that actually flaked: roughly one run in
      // five it read 125 Hz / -0.6 dB, because one of the ten generated ids had
      // come out numeric and jumped the queue.
      expect(
        Object.values(preset.filters).find((band) => band.frequency === 31),
      ).toMatchObject({
        frequency: 31,
        gain: 6.3,
        quality: 1.41,
        type: FilterTypeEnum.PK,
      });
    });
  });
});
