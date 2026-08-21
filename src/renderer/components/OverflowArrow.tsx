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

import ArrowIcon from '../icons/ArrowIcon';
import { useTranslation } from '../utils/I18nContext';

/**
 * The way to the part of a row that does not fit.
 *
 * `ArrowIcon` draws a chevron up and down only and the stylesheet turns it; a
 * third and fourth drawing of the same shape is one more thing to keep in
 * step with the other two.
 */
const OverflowArrow = ({
  direction,
  onPress,
}: {
  direction: 'back' | 'forward';
  onPress: () => void;
}) => {
  const { t } = useTranslation();
  const label = t(
    direction === 'back' ? 'tabs.scrollBack' : 'tabs.scrollForward',
  );
  return (
    <button
      type="button"
      className={`overflow-arrow overflow-arrow--${direction}`}
      aria-label={label}
      title={label}
      onClick={onPress}
    >
      <ArrowIcon type="up" />
    </button>
  );
};

export default OverflowArrow;
