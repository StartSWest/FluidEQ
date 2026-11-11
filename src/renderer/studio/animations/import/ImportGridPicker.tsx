/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useId, useMemo } from 'react';
import { MAX_ANIMATION_FRAMES } from 'common/studioAnimation';
import type { IGrid } from 'common/sheetGrid';
import { useTranslation } from '../../../utils/I18nContext';

interface IImportGridPickerProps {
  /** The sheet as chosen, to show with the cuts over it. */
  picture: Uint8Array;
  width: number;
  height: number;
  grid: IGrid;
  count: number;
  onChange: (grid: IGrid, count: number) => void;
}

const clampWhole = (value: string, least: number, most: number) => {
  const number = Math.round(Number(value));
  return Number.isFinite(number)
    ? Math.min(most, Math.max(least, number))
    : least;
};

/**
 * How a still sheet is cut into frames, set on the sheet itself: how many
 * across, how many down and how many of those cells are frames, the cuts
 * drawn over the picture as they change. Read from the gaps between frames
 * when the sheet has them; a guess the member corrects when it has not.
 */
export default function ImportGridPicker({
  picture,
  width,
  height,
  grid,
  count,
  onChange,
}: IImportGridPickerProps) {
  const { t } = useTranslation();
  const id = useId();
  const url = useMemo(
    () => URL.createObjectURL(new Blob([picture.slice()])),
    [picture],
  );
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  const cells = grid.columns * grid.rows;
  // At most a cell a pixel across or down, and never more frames than an
  // animation holds.
  const mostColumns = Math.min(width, MAX_ANIMATION_FRAMES);
  const mostRows = Math.min(height, MAX_ANIMATION_FRAMES);
  const set = (columns: number, rows: number, frames: number) => {
    const next = Math.min(columns * rows, MAX_ANIMATION_FRAMES);
    onChange({ columns, rows, found: false }, Math.min(frames, next));
  };
  const cellW = width / grid.columns;
  const cellH = height / grid.rows;
  const fields: Array<{
    key: string;
    label: string;
    value: number;
    most: number;
    change: (value: number) => void;
  }> = [
    {
      key: 'columns',
      label: t('studio.animationImport.columns'),
      value: grid.columns,
      most: mostColumns,
      change: (columns) =>
        set(columns, grid.rows, count === cells ? columns * grid.rows : count),
    },
    {
      key: 'rows',
      label: t('studio.animationImport.rows'),
      value: grid.rows,
      most: mostRows,
      change: (rows) =>
        set(grid.columns, rows, count === cells ? grid.columns * rows : count),
    },
    {
      key: 'count',
      label: t('studio.animationImport.count'),
      value: count,
      most: Math.min(cells, MAX_ANIMATION_FRAMES),
      change: (frames) => set(grid.columns, grid.rows, frames),
    },
  ];
  return (
    <div className="studio-animation-import__grid">
      <div className="studio-animation-import__sheet">
        <img src={url} alt="" width={width} height={height} />
        <svg
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {Array.from({ length: cells }, (_, index) => (
            <rect
              key={index}
              className={index < count ? undefined : 'is-unused'}
              x={(index % grid.columns) * cellW}
              y={Math.floor(index / grid.columns) * cellH}
              width={cellW}
              height={cellH}
            />
          ))}
        </svg>
      </div>
      <div className="studio-animation-import__grid-fields">
        {fields.map((field) => (
          <div key={field.key} className="studio-new__field">
            <label htmlFor={`${id}-${field.key}`} className="studio-new__label">
              {field.label}
            </label>
            <input
              id={`${id}-${field.key}`}
              className="studio-new__input"
              type="number"
              min={1}
              max={field.most}
              step={1}
              value={field.value}
              onChange={(event) =>
                field.change(clampWhole(event.target.value, 1, field.most))
              }
            />
          </div>
        ))}
      </div>
      <p className="dialog-frame__rail-text">
        {t(
          grid.found
            ? 'studio.animationImport.gridFound'
            : 'studio.animationImport.gridGuess',
        )}
      </p>
    </div>
  );
}
