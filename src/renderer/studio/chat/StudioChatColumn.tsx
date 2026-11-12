/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useRef, useState, type ComponentProps } from 'react';
import ColumnResizer from '../../components/ColumnResizer';
import Glyph from '../../community/Glyph';
import { useTranslation } from '../../utils/I18nContext';
import { readStored, writeStored } from '../../utils/graphStorage';
import { useSceneChatAsked } from './askSceneChat';
import StudioChat from './StudioChat';
import useChatWidth, { useFullscreenChatWidth } from './useChatWidth';

const FOLDED_KEY = 'fluideq.studio.chatFolded';

/**
 * The chat's column beside the stage, or the thin rail it folds into so the
 * stage can have the width (the mockup's "Chat folded away"). Open, its
 * left edge drags to make it wider or narrower (`useChatWidth.ts`). Folded or
 * not, and the width, are remembered for the next visit.
 *
 * In the Studio's full screen it is over the scene, and away is slid off the
 * screen (`useFullscreenPanes.ts`), never the rail: its fold button slides it
 * away as the plate's Chat button and Ctrl+L do, a rail folded in the window
 * stands open there, and its divider sets the full screen's own width.
 */
export default function StudioChatColumn({
  project,
  version,
  captureStage,
  fullScreen,
}: Omit<ComponentProps<typeof StudioChat>, 'onFold'> & {
  /** Present while the Studio fills the screen. */
  fullScreen?: { onHide: () => void } | undefined;
}) {
  const { t } = useTranslation();
  const [folded, setFolded] = useState(() => readStored(FOLDED_KEY) === 'true');
  const column = useRef<HTMLElement>(null);
  const windowWidth = useChatWidth(column);
  const fullWidth = useFullscreenChatWidth(column);
  const { resizer } = fullScreen ? fullWidth : windowWidth;
  const fold = (next: boolean) => {
    setFolded(next);
    writeStored(FOLDED_KEY, String(next));
  };
  // Asked for from another tab: a folded pane opens to show what was
  // written into it (`askSceneChat`).
  useSceneChatAsked(() => fold(false));

  if (folded && !fullScreen) {
    return (
      <aside className="studio-bench__chat is-folded">
        <button
          type="button"
          className="studio-chat__rail"
          onClick={() => fold(false)}
        >
          <Glyph name="studio" />
          <span>{t('studioChat.unfold')}</span>
        </button>
      </aside>
    );
  }
  return (
    <aside
      ref={column}
      className="studio-bench__chat"
      // Both widths stand on the column, each read by the sheet where it
      // applies: leaving full screen shows the window's at once.
      style={{ ...windowWidth.style, ...fullWidth.style }}
    >
      <ColumnResizer
        ariaLabel={t('studioChat.resize')}
        valuePercent={resizer.valuePercent}
        onStart={resizer.onStart}
        onDrag={resizer.onDrag}
        onEnd={resizer.onEnd}
        onReset={resizer.onReset}
      />
      <StudioChat
        project={project}
        version={version}
        captureStage={captureStage}
        onFold={fullScreen?.onHide ?? (() => fold(true))}
      />
    </aside>
  );
}
