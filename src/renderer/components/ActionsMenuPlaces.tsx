/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import MenuIcon from '../icons/MenuIcon';
import { WORKSPACE_PLACES } from '../shell/workspacePlaces';
import { useTranslation } from '../utils/I18nContext';
import {
  useTitlebarPlacesShed,
  type TTitlebarPlace,
} from '../utils/titlebarPlaces';

/**
 * The places the titlebar has no room for, at the head of the actions menu:
 * at the largest zoom they leave the bar so the window's own buttons stay on
 * it (`titlebarPlaces.ts`), and nothing that leaves the bar goes out of reach.
 * First, because they are where the window goes, and a hand opening the menu
 * for one of them should not have to look past the engine for it. Nothing at
 * all while every place is on the bar.
 */
const ActionsMenuPlaces = ({
  onPlace,
}: {
  /** Opens the place; the menu has closed by then. */
  onPlace: (place: TTitlebarPlace) => void;
}) => {
  const { t } = useTranslation();
  const places = useTitlebarPlacesShed();
  if (places.length === 0) {
    return null;
  }
  return (
    <>
      {places.map((place) => (
        <button
          key={place}
          type="button"
          role="menuitem"
          className="workspace-header__menu-item"
          onClick={() => onPlace(place)}
        >
          <MenuIcon name={WORKSPACE_PLACES[place].icon} />
          {t(WORKSPACE_PLACES[place].label)}
        </button>
      ))}
      <hr className="actions-menu__rule" />
    </>
  );
};

export default ActionsMenuPlaces;
