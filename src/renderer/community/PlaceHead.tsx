/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { ReactNode } from 'react';

interface IPlaceHeadProps {
  title: string;
  description: string;
  /** Classes of the place's own, beside the head's. */
  className?: string;
  /** What stands at the head's end: a status, the toasts. */
  children?: ReactNode;
}

/**
 * A Scenes place's head - the Gallery's, the Studio's, Dynamic lighting's -
 * set as the Library sets a record's (`.library-hero`): the name in its
 * 30px title over what the place is for in its second ink, with no tile
 * beside it, since the rail beside the page already carries the place's
 * glyph (Ivan, 2026-11-17: "everything there needs to look like the
 * Library"). It was a 15px name beside a tinted glyph tile over a rule,
 * which read as one more card's caption on a page of cards.
 */
export default function PlaceHead({
  title,
  description,
  className,
  children,
}: IPlaceHeadProps) {
  return (
    <header
      className={`community__head place-head${className ? ` ${className}` : ''}`}
    >
      <span className="place-head__text">
        <h2 className="library-hero__title">{title}</h2>
        <span className="library-hero__who">{description}</span>
      </span>
      {children}
    </header>
  );
}
