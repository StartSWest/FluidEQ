import showGalleryGraph from '../../../renderer/plus/showGalleryGraph';
import {
  getGraphContents,
  getGraphView,
  getGraphWaveHidden,
  setGraphContents,
  setGraphView,
} from '../../../renderer/utils/graphStyle';

afterEach(() => {
  setGraphView('normal');
  setGraphContents('everything');
});

it.each(['curves', 'clean'] as const)(
  'opens Bands with the visualizer enabled from %s, including repeated presses',
  (contents) => {
    setGraphView('normal');
    setGraphContents(contents);
    setGraphView('fullscreen');
    const openBands = jest.fn(() => {
      expect(getGraphView()).toBe('normal');
      expect(getGraphWaveHidden()).toBe(false);
      expect(getGraphContents()).not.toBe('clean');
    });
    showGalleryGraph(openBands);
    showGalleryGraph(openBands);
    expect(openBands).toHaveBeenCalledTimes(2);
    expect(getGraphWaveHidden()).toBe(false);
  },
);
