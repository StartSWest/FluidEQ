import { createRoot } from 'react-dom/client';
import type { IWallpaperSurfaceBridge } from 'common/wallpaper';
import WallpaperSurface from './WallpaperSurface';
import './surface.css';

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
