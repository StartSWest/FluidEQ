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
  /** Why this button is unavailable, or what it will do that is not obvious. */
  hint?: string;
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
 *
 * `hint` extends the last two without touching the first. A disabled button
 * that explains nothing reads as a bug rather than as a step in an order, and
 * the reason is usually a sentence — too long to sit under an icon, and exactly
 * right in a tooltip. The accessible name still begins with the visible label,
 * so the two continue to agree.
 */
const KaraokeMakerToolbarButton = ({
  icon,
  label,
  onClick,
  active = false,
  disabled = false,
  danger = false,
  hint,
}: IKaraokeMakerToolbarButtonProps) => (
  <button
    type="button"
    className={`karaoke-maker__tool-button${active ? ' is-active' : ''}${
      danger ? ' is-danger' : ''
    }`}
    onClick={onClick}
    disabled={disabled}
    aria-label={hint ? `${label} — ${hint}` : label}
    aria-pressed={active || undefined}
    data-tooltip={hint ? `${label} — ${hint}` : label}
  >
    <KaraokeMakerToolIcon name={icon} />
    <span className="karaoke-maker__tool-label">{label}</span>
  </button>
);

export default KaraokeMakerToolbarButton;
