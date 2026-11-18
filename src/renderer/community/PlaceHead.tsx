/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { ReactNode } from 'react';

interface IPlaceHeadProps {
  title: string;
  /** What the place is for: read out after its name, never drawn. */
  description: string;
  /** Classes of the place's own, on the row it draws for `children`. */
  className?: string;
  /** What stands at the page's top: a status, the toasts. */
  children?: ReactNode;
}

/**
 * A Scenes place's name - the Studio's, Dynamic lighting's - for screen
 * readers only. There is no big title over the page (Ivan, 2026-11-17, of
 * the Studio and Dynamic lighting: "remove the Studio header and all that,
 * make it like the Gallery"): the rail beside the page names the place,
 * and a 30px title with a line under it pushed the work down. It was the
 * Library hero's title and line, and before that a 15px name beside a
 * tinted glyph tile over a rule. Whatever a place hangs at its top
 * (`children`) still gets a row of its own.
 */
export default function PlaceHead({
  title,
  description,
  className,
  children,
}: IPlaceHeadProps) {
  return (
    <>
      <h2 className="place-head__name">
        {title}
        <span>{`. ${description}`}</span>
      </h2>
      {children !== undefined && (
        <div className={`place-head${className ? ` ${className}` : ''}`}>
          {children}
        </div>
      )}
    </>
  );
}
