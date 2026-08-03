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
      const key = Object.keys(preset.filters)[0];
      expect(preset.filters[key]).toMatchObject({
        id: key,
        frequency: 200,
        gain: 8.8,
        quality: 0.7,
        type: FilterTypeEnum.LSC,
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
      expect(preset.filters[Object.keys(preset.filters)[0]]).toMatchObject({
        frequency: 31,
        gain: 6.3,
        quality: 1.41,
        type: FilterTypeEnum.PK,
      });
    });
  });
});
