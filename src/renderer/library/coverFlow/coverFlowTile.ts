/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The Library's generated tile (`LibraryCoverArt`), painted on a canvas for
 * the Cover Flow scene: the same hue from the same name and the same
 * initials, for a song or album with no cover, or one that will not decode.
 */
import {
  libraryTileHue,
  libraryTileInitials,
} from '../../../common/library/artwork';
import readableContext from './coverFlowCanvas';

const drawTile = (label: string, edge: number): HTMLCanvasElement => {
  const canvas = document.createElement('canvas');
  canvas.width = edge;
  canvas.height = edge;
  const context = readableContext(canvas);
  if (!context) {
    return canvas;
  }
  const hue = libraryTileHue(label);
  // 155 degrees, as the tile's CSS gradient runs.
  const angle = (155 - 90) * (Math.PI / 180);
  const half = edge / 2;
  const dx = Math.cos(angle) * half;
  const dy = Math.sin(angle) * half;
  const gradient = context.createLinearGradient(
    half - dx,
    half - dy,
    half + dx,
    half + dy,
  );
  gradient.addColorStop(0, `hsl(${hue}deg 58% 34%)`);
  gradient.addColorStop(1, `hsl(${hue}deg 66% 20%)`);
  context.fillStyle = gradient;
  context.fillRect(0, 0, edge, edge);
  context.fillStyle = 'rgba(255, 255, 255, 0.92)';
  context.font = `700 ${edge * 0.3}px -apple-system, "Segoe UI", Ubuntu, Cantarell, "Noto Sans", "DejaVu Sans", sans-serif`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(libraryTileInitials(label), half, half);
  return canvas;
};

export default drawTile;
