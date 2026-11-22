/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { ReactNode } from 'react';
import MenuIcon, { type MenuIconName } from '../icons/MenuIcon';

/**
 * A part of the artist's page named over it — "Albums 8", "Songs 30" — in
 * the shelf's own section heading (`LibrarySections.scss`), so the two
 * halves of the page read apart as the halves of a search do. Anything
 * handed in stands at its far end, past the rule.
 */
const LibraryArtistHeading = ({
  icon,
  label,
  count,
  children,
}: {
  icon: MenuIconName;
  label: string;
  count: number;
  children?: ReactNode;
}) => (
  <div className="library-section library-artist__heading">
    <MenuIcon name={icon} className="library-section__icon" />
    <span className="library-section__label">{label}</span>
    <span className="library-section__count">{count}</span>
    <span className="library-section__rule" aria-hidden="true" />
    {children}
  </div>
);

export default LibraryArtistHeading;
