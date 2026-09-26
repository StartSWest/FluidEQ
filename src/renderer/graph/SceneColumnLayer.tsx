/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import { useCallback, useLayoutEffect, useState } from 'react';
import { publishSceneColumnHost } from '../utils/sceneCover';

/**
 * The layer behind an EQ page's head and its graph that a Plus visualizer is
 * drawn on, the plot still its frame, so the picture runs up under the
 * section pills and the title to the top of the column (Ivan, 2026-09-25:
 * "fill up to the top the graph only when plus viz"). Whether the graph's
 * scene goes here is `graphScenePlace.ts`; empty, the layer paints nothing.
 *
 * As tall as the head and the graph together, measured, because the two are
 * separate items of the column and the page and the divider under them are
 * sized by the split: a layer reaching past the graph's foot would stand over
 * the page, which is painted before it.
 */
export default function SceneColumnLayer() {
  const [layer, setLayer] = useState<HTMLDivElement | null>(null);
  const attach = useCallback((element: HTMLDivElement | null) => {
    setLayer(element);
    publishSceneColumnHost(element);
  }, []);

  useLayoutEffect(() => {
    const column = layer?.parentElement;
    if (!layer || !column || typeof ResizeObserver === 'undefined') {
      return undefined;
    }
    const measure = () => {
      const graph = column.querySelector(':scope > .graph-wrapper');
      const { top } = column.getBoundingClientRect();
      const bottom =
        graph instanceof HTMLElement
          ? graph.getBoundingClientRect().bottom
          : top;
      layer.style.height = `${Math.max(0, bottom - top)}px`;
    };
    measure();
    const observer = new ResizeObserver(measure);
    // The column for the window, its children for the split: a drag moves
    // the graph's foot without changing the column's size.
    observer.observe(column);
    const watch = () => {
      Array.from(column.children).forEach((child) => observer.observe(child));
    };
    watch();
    // A graph switched on or off, or the head arriving with the EQ pages.
    const children = new MutationObserver(() => {
      watch();
      measure();
    });
    children.observe(column, { childList: true });
    return () => {
      observer.disconnect();
      children.disconnect();
    };
  }, [layer]);

  return (
    <div
      ref={attach}
      className="scene-column-layer"
      data-scene-layer="column"
      aria-hidden="true"
    />
  );
}
