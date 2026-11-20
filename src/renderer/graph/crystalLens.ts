/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useCallback, useEffect, useRef } from 'react';

/**
 * The bend at a crystal's rim (`scene-crystal` in `_glass.scss`; Ivan,
 * 2026-11-19, picking round 3: "cristal").
 *
 * A displacement map in the backdrop filter: red and green say how far, and
 * which way, each pixel of the face samples the picture behind it. Over the
 * middle nothing moves; towards an edge each pixel reads from further inside,
 * so the scene bends at the rim the way it does at the edge of a real pane,
 * which is what tells a crystal from a frosted box.
 *
 * Built at the element's own size, because the rim is a fixed width in
 * pixels and a map stretched to another size would widen it. A size seen
 * before is drawn once (`maps`). Rebuilt only when the element's size
 * changes, which its ResizeObserver says; the filter is shared by nothing.
 *
 * Where the browser cannot take an SVG filter in `backdrop-filter`, nothing
 * is built and the crystal is the frost alone.
 */

/** How deep the rim is, in pixels, at most. */
const RIM_PX = 12;
/** How far the rim's outermost pixel reads inwards, in pixels, at most. */
const BEND_PX = 22;

/** Maps kept, the oldest going first: a few sizes per crystal on screen. */
const MAX_MAPS = 24;

const SVG_NS = 'http://www.w3.org/2000/svg';

let defs: SVGDefsElement | undefined;
let sequence = 0;
const maps = new Map<string, string>();

const supportsLens = (): boolean =>
  typeof CSS !== 'undefined' &&
  typeof CSS.supports === 'function' &&
  CSS.supports('backdrop-filter', 'url(#a)');

/** The one hidden `<defs>` every crystal's filter lives in. */
const lensDefs = (): SVGDefsElement => {
  if (defs?.isConnected) {
    return defs;
  }
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('width', '0');
  svg.setAttribute('height', '0');
  svg.setAttribute('aria-hidden', 'true');
  svg.style.position = 'absolute';
  svg.style.pointerEvents = 'none';
  defs = document.createElementNS(SVG_NS, 'defs');
  svg.appendChild(defs);
  document.body.appendChild(svg);
  return defs;
};

/**
 * The map for a rounded box of `width` by `height` with corners of `radius`:
 * each pixel's distance in from the nearest edge, and the inward direction
 * there, as the displacement it gets — strongest at the edge, gone at the
 * rim's inner line, eased so the bend has no visible seam.
 */
const mapFor = (width: number, height: number, radius: number): string => {
  const key = `${width}x${height}r${radius}`;
  const known = maps.get(key);
  if (known) {
    return known;
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) {
    return '';
  }
  const rim = Math.max(1, Math.min(RIM_PX, height / 2, width / 2));
  const image = context.createImageData(width, height);
  const { data } = image;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const intoCornerX = Math.max(radius - x, 0, x - (width - 1 - radius));
      const intoCornerY = Math.max(radius - y, 0, y - (height - 1 - radius));
      let distance: number;
      let towardX = 0;
      let towardY = 0;
      if (intoCornerX > 0 && intoCornerY > 0) {
        const length = Math.hypot(intoCornerX, intoCornerY);
        distance = Math.max(0, radius - length);
        towardX = ((x < width / 2 ? 1 : -1) * intoCornerX) / length;
        towardY = ((y < height / 2 ? 1 : -1) * intoCornerY) / length;
      } else {
        const left = x;
        const right = width - 1 - x;
        const top = y;
        const bottom = height - 1 - y;
        distance = Math.min(left, right, top, bottom);
        if (distance === left) {
          towardX = 1;
        } else if (distance === right) {
          towardX = -1;
        } else if (distance === top) {
          towardY = 1;
        } else {
          towardY = -1;
        }
      }
      const reach = Math.max(0, 1 - distance / rim);
      const strength = reach * reach;
      const at = (y * width + x) * 4;
      data[at] = 128 + towardX * strength * 127;
      data[at + 1] = 128 + towardY * strength * 127;
      data[at + 2] = 128;
      data[at + 3] = 255;
    }
  }
  context.putImageData(image, 0, 0);
  const url = canvas.toDataURL();
  maps.set(key, url);
  while (maps.size > MAX_MAPS) {
    const [oldest] = maps.keys();
    maps.delete(oldest);
  }
  return url;
};

/**
 * A ref for a crystal: its filter is made when the element arrives, follows
 * its size, and goes with it. The element's `--crystal-lens` names the
 * filter, which the mixin puts ahead of the frost.
 */
const useCrystalLens = <T extends HTMLElement>() => {
  const cleanup = useRef<(() => void) | undefined>(undefined);

  useEffect(() => () => cleanup.current?.(), []);

  return useCallback((element: T | null) => {
    cleanup.current?.();
    cleanup.current = undefined;
    if (!element || !supportsLens() || typeof ResizeObserver === 'undefined') {
      return;
    }
    sequence += 1;
    const id = `crystal-lens-${sequence}`;
    const filter = document.createElementNS(SVG_NS, 'filter');
    filter.setAttribute('id', id);
    filter.setAttribute('x', '0');
    filter.setAttribute('y', '0');
    filter.setAttribute('filterUnits', 'userSpaceOnUse');
    filter.setAttribute('primitiveUnits', 'userSpaceOnUse');
    filter.setAttribute('color-interpolation-filters', 'sRGB');
    const map = document.createElementNS(SVG_NS, 'feImage');
    map.setAttribute('x', '0');
    map.setAttribute('y', '0');
    map.setAttribute('preserveAspectRatio', 'none');
    map.setAttribute('result', 'map');
    const bend = document.createElementNS(SVG_NS, 'feDisplacementMap');
    bend.setAttribute('in', 'SourceGraphic');
    bend.setAttribute('in2', 'map');
    bend.setAttribute('xChannelSelector', 'R');
    bend.setAttribute('yChannelSelector', 'G');
    filter.append(map, bend);
    lensDefs().appendChild(filter);

    let size = '';
    const fit = () => {
      // The layout size, which a scaled ancestor does not change: the
      // backdrop is filtered in the element's own pixels.
      const width = Math.round(element.offsetWidth);
      const height = Math.round(element.offsetHeight);
      const next = `${width}x${height}`;
      if (next === size || width < 4 || height < 4) {
        return;
      }
      size = next;
      const radius = Math.min(
        Number.parseFloat(getComputedStyle(element).borderTopLeftRadius) || 0,
        height / 2,
      );
      const url = mapFor(width, height, Math.round(radius));
      if (!url) {
        return;
      }
      filter.setAttribute('width', String(width));
      filter.setAttribute('height', String(height));
      map.setAttribute('width', String(width));
      map.setAttribute('height', String(height));
      map.setAttribute('href', url);
      bend.setAttribute('scale', String(Math.min(BEND_PX, height * 0.6)));
      element.style.setProperty('--crystal-lens', `url(#${id})`);
    };
    // A crystal that is growing or shrinking (the credit unfolding its
    // tools) keeps the map it has, stretched, until its own transition says
    // it has finished: a map per frame of the growth was a canvas drawn and
    // encoded sixteen times to be seen for one frame each.
    const settle = () => {
      if (element.getAnimations({ subtree: true }).length === 0) {
        fit();
      }
    };
    const observer = new ResizeObserver(settle);
    observer.observe(element);
    element.addEventListener('transitionend', settle);
    fit();
    cleanup.current = () => {
      observer.disconnect();
      element.removeEventListener('transitionend', settle);
      filter.remove();
      element.style.removeProperty('--crystal-lens');
    };
  }, []);
};

export default useCrystalLens;
