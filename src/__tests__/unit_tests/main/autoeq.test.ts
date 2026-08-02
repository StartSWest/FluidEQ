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
        addFileToPath(TEST_DATA_READ_DIR, 'autoeq')
      );
      expect(devices).toMatchObject(['autoeqPreset']);
    });
  });

  describe('getAutoEqResponseList', () => {
    it('should fetch auto eq response names', () => {
      const responses = getAutoEqResponseList(
        'autoeqPreset',
        addFileToPath(TEST_DATA_READ_DIR, 'autoeq')
      );
      expect(responses).toMatchObject(['testResponse']);
    });
  });

  describe('getAutoEqPreset', () => {
    it('should fetch auto eq preset data', () => {
      const preset = getAutoEqPreset(
        'autoeqPreset',
        'testResponse',
        addFileToPath(TEST_DATA_READ_DIR, 'autoeq')
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
  });
});
