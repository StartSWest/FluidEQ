/*
<AQUA: System-wide parametric audio equalizer interface>
Copyright (C) <2023>  <AQUA Dev Team>
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

import {
  memo,
  useCallback,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import PaneResizer from '../components/PaneResizer';
import {
  applyDspSettings,
  persistDspSettings,
  useDspEngineState,
  useDspSettings,
} from '../dsp/store';
import {
  clampToWindow,
  commitPaneSizes,
  getEditorHeight,
  setEditorHeight,
  useEditorHeight,
} from '../utils/paneSizes';
import { DspPanelPage } from '../workspacePages';

/**
 * The DSP page, subscribed to the rack's settings itself.
 *
 * The settings live in the DSP store because the engine that consumes them
 * runs inside `LibraryPlayerContext`; reading them here rather than in
 * `AppContent` is the other half of that. The root used to read them for this
 * one prop, and the store publishes on every step of a knob, so every drag
 * re-rendered the whole window — titlebar, both side columns, the chart and
 * any mounted player — for a page that is one leaf of it.
 */
export const DspPage = memo(
  ({ onOpenEngineDialog }: { onOpenEngineDialog: () => void }) => {
    const settings = useDspSettings();
    const engineState = useDspEngineState();
    return (
      <DspPanelPage.Page
        settings={settings}
        onChange={applyDspSettings}
        onCommit={persistDspSettings}
        engineState={engineState}
        onOpenEngineDialog={onOpenEngineDialog}
      />
    );
  },
);

/**
 * The pane above the graph, sized by the divider.
 *
 * Its height is read here and nowhere above. The store publishes on every
 * pixel of a divider drag and on every resize of the column, and read in
 * `AppContent` it re-rendered the whole window for one number each time. The
 * children are built by the root and handed down, so they keep their identity
 * and React passes over them when only the height moves.
 */
export const MiddleContent = ({
  paneKey,
  isSized,
  children,
}: {
  paneKey: string;
  isSized: boolean;
  children: ReactNode;
}) => {
  const editorHeight = useEditorHeight(paneKey);
  return (
    <div
      className="middle-content"
      // What the divider actually sets: the height of everything above the
      // graph, on every tab. It used to be a ceiling on the EQ tab so the card
      // could hug its content — see App.scss for why one handle behaving
      // differently depending on the open tab was not worth what it bought.
      style={
        isSized
          ? ({ '--editor-height': `${editorHeight}px` } as CSSProperties)
          : undefined
      }
    >
      {children}
    </div>
  );
};

/**
 * What a drag on the divider does to the pane it moves, and whether one is
 * under way.
 */
export const useGraphPaneResize = (paneKey: string, isGraphFirst: boolean) => {
  // The editor's height when the drag began, so every move is measured from
  // one fixed point rather than accumulated.
  const graphDragStart = useRef(0);
  // Read by the player, which has to stop swallowing pointer events for the
  // length of a drag — see VideoBrowser.scss.
  const [isResizingPanes, setIsResizingPanes] = useState(false);

  const handleGraphResizeStart = useCallback(() => {
    graphDragStart.current = getEditorHeight(paneKey);
    setIsResizingPanes(true);
  }, [paneKey]);

  /**
   * Move the divider.
   *
   * What is set is the page's pane — the graph simply takes what is left.
   * With the graph under the page, dragging down gives the page more and the
   * graph less; with the graph above it (`isGraphFirst`) the page is under the
   * divider, so dragging down gives it LESS. Either way the handle goes where
   * it is carried, and both ends of the drag stay live because the pane being
   * sized is the one whose content can actually vary.
   */
  const handleGraphResizeDrag = useCallback(
    (deltaY: number) => {
      setEditorHeight(
        clampToWindow(
          graphDragStart.current + (isGraphFirst ? -deltaY : deltaY),
        ),
        paneKey,
      );
    },
    [paneKey, isGraphFirst],
  );

  const handleGraphResizeEnd = useCallback(() => {
    setIsResizingPanes(false);
    commitPaneSizes();
  }, []);

  return {
    isResizingPanes,
    handleGraphResizeStart,
    handleGraphResizeDrag,
    handleGraphResizeEnd,
  };
};

/** The divider, reading the height it reports for itself — see above. */
export const GraphPaneResizer = ({
  paneKey,
  ariaLabel,
  onStart,
  onDrag,
  onEnd,
}: {
  paneKey: string;
  ariaLabel: string;
  onStart: () => void;
  onDrag: (deltaY: number) => void;
  onEnd: () => void;
}) => {
  const editorHeight = useEditorHeight(paneKey);
  // How much of the workspace the editor currently has, as a percentage. Only
  // for the divider's `aria-valuenow` — a pixel height means nothing read out
  // loud without also knowing how tall the window is.
  const valuePercent = Math.round(
    (editorHeight / Math.max(1, window.innerHeight)) * 100,
  );
  return (
    <PaneResizer
      ariaLabel={ariaLabel}
      valuePercent={valuePercent}
      onStart={onStart}
      onDrag={onDrag}
      onEnd={onEnd}
    />
  );
};
