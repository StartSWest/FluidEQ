/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { BRAND_MARK } from 'common/branding';

interface IBrandMarkProps {
  /** Extra class on the tile, for a panel that wants a different size. */
  className?: string;
}

/**
 * The logo, wherever the app shows itself.
 *
 * The tile comes with it rather than being left to each caller: `.brand-mark`
 * is what styles the frame AND the stroke inside it, so a bare `<svg>` handed
 * to a different parent draws an invisible path. Always decorative — every
 * place this appears has the product name in text beside it, so announcing the
 * glyph as well would read the name twice.
 */
export default function BrandMark({ className }: IBrandMarkProps) {
  return (
    <div
      className={className ? `brand-mark ${className}` : 'brand-mark'}
      aria-hidden="true"
    >
      <svg viewBox={BRAND_MARK.viewBox}>
        <path d={BRAND_MARK.path} />
      </svg>
    </div>
  );
}
