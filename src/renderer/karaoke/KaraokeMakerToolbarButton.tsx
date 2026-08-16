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

import KaraokeMakerToolIcon, {
  TKaraokeMakerToolIcon,
} from './KaraokeMakerToolIcon';

interface IKaraokeMakerToolbarButtonProps {
  icon: TKaraokeMakerToolIcon;
  label: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  danger?: boolean;
}

/**
 * One button in the Maker's toolbar: an icon, a label, and a state.
 *
 * Lifted out of `KaraokeMaker.tsx` so the groups extracted alongside it can use
 * it without importing from the component they were extracted from — which
 * would be a cycle, and the reason this had to move first.
 *
 * The label does triple duty as the visible text, the accessible name and the
 * tooltip, so a button cannot end up saying one thing to the eye and another to
 * a screen reader.
 */
const KaraokeMakerToolbarButton = ({
  icon,
  label,
  onClick,
  active = false,
  disabled = false,
  danger = false,
}: IKaraokeMakerToolbarButtonProps) => (
  <button
    type="button"
    className={`karaoke-maker__tool-button${active ? ' is-active' : ''}${
      danger ? ' is-danger' : ''
    }`}
    onClick={onClick}
    disabled={disabled}
    aria-label={label}
    aria-pressed={active || undefined}
    data-tooltip={label}
  >
    <KaraokeMakerToolIcon name={icon} />
    <span className="karaoke-maker__tool-label">{label}</span>
  </button>
);

export default KaraokeMakerToolbarButton;
