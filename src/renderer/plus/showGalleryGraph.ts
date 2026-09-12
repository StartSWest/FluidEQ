import { exitGraphFullScreen, showGraphWave } from '../utils/graphStyle';

/** Apply the normal view's preferences after leaving expanded/fullscreen. */
export default function showGalleryGraph(openBands: () => void): void {
  exitGraphFullScreen();
  showGraphWave();
  openBands();
}
