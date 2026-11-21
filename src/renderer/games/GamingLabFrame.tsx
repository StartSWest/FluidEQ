/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { ReactNode } from 'react';
import MenuIcon from '../icons/MenuIcon';
import type { ILibraryRailWidth } from '../library/LibraryRailSplitter';
import { RAIL_DEFAULT_WIDTH } from '../library/libraryWorkspacePrefs';
import { useTranslation } from '../utils/I18nContext';
import StudioRail from '../widgets/StudioRail';
import '../styles/GamingLab.scss';

const nothing = () => undefined;

/**
 * The rail at the design's width, for a drawing of the page (Help's figure,
 * the release slide): it reads and remembers nothing of the reader's, and
 * is never dragged - Help's figures are inert, and the slide hides the edge.
 */
export const drawnRailWidth: ILibraryRailWidth = {
  width: RAIL_DEFAULT_WIDTH,
  isResizing: false,
  storageKey: '',
  setWidth: nothing,
  setIsResizing: nothing,
};

interface IGamingLabFrameProps {
  /** How many games the rail lists, said in its heading. */
  count: number;
  /** The games, as rail rows (`GamingGameRow`). */
  rows: ReactNode;
  /** The Lab's switch: off, the games read as standing by. */
  isOn: boolean;
  /** Open beside the page, or folded to its column of icons. */
  isPinned: boolean;
  onPinned: (next: boolean) => void;
  /** The rail's dragged width (`useRailWidth`), or `drawnRailWidth`. */
  railWidth: ILibraryRailWidth;
  onAdd: () => void;
  /** The page's top line (`GamingLabHead`). */
  head: ReactNode;
  children: ReactNode;
}

/**
 * THE GAMING LAB, LAID OUT AS THE LIBRARY IS (Ivan, 2026-11-19: "clean,
 * clear, without so many lines and borders, the way the Library is, with the
 * left panel as it is there, resizable, and it can be shown and hidden").
 *
 * One card, the page's, and two columns on it in its one tone: the games
 * down the studio rail every such page shares (`StudioRail`: the Library's
 * rail, splitter and width rule, with the Scenes tab's pin), and the page
 * beside it, parted by the rail's hairline alone and scrolling inside itself.
 * Adding a game is the rail's one recommendation, under the games, where the
 * Library adds a folder.
 *
 * The page, its Help drawing (`help/live/gamingFigures`) and the release
 * slide (`GamingLabVisual`) all draw this.
 */
const GamingLabFrame = ({
  count,
  rows,
  isOn,
  isPinned,
  onPinned,
  railWidth,
  onAdd,
  head,
  children,
}: IGamingLabFrameProps) => {
  const { t } = useTranslation();
  const heading = t('gaming.list.count', { count });
  return (
    <div className={`gaming-lab${isOn ? '' : ' is-off'}`}>
      <StudioRail
        rail={railWidth}
        isPinned={isPinned}
        onPinnedChange={onPinned}
        heading={heading}
      >
        <nav className="gaming-lab__games" aria-label={heading}>
          {rows}
          <button
            type="button"
            className="gaming-lab__add"
            title={t('gaming.add')}
            onClick={onAdd}
          >
            <MenuIcon name="plus" className="gaming-lab__add-icon" />
            <span className="studio-rail__word">{t('gaming.add')}</span>
          </button>
        </nav>
      </StudioRail>
      <div className="gaming-lab__main">
        {head}
        {children}
      </div>
    </div>
  );
};

export default GamingLabFrame;
