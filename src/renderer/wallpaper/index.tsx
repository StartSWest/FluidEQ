import { createRoot } from 'react-dom/client';
import type { IWallpaperSurfaceBridge } from 'common/wallpaper';
import forgetReactTimings from '../utils/forgetReactTimings';
import WallpaperSurface from './WallpaperSurface';
import './surface.css';

// A desktop background stays up for hours, so in development React's timing
// entries would pile up here as they do in the window.
forgetReactTimings();

declare global {
  interface Window {
    wallpaper?: IWallpaperSurfaceBridge;
  }
}

const bridge = window.wallpaper;
if (!bridge) {
  throw new Error('Desktop visualizer preload did not load.');
}
// Report rendering/worker failures to the visible app, where Retry and Stop live.
window.addEventListener('error', () => bridge.failed());
window.addEventListener('unhandledrejection', () => bridge.failed());
const container = document.getElementById('root');
if (container) {
  createRoot(container).render(<WallpaperSurface bridge={bridge} />);
} else {
  bridge.failed();
}
