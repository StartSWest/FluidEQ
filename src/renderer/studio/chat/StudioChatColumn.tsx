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
import StudioChat from './StudioChat';
import useChatWidth from './useChatWidth';

const FOLDED_KEY = 'fluideq.studio.chatFolded';

/**
 * The chat's column beside the stage, or the thin rail it folds into so the
 * stage can have the width (the mockup's "Chat folded away"). Open, its
 * left edge drags to make it wider or narrower (`useChatWidth.ts`). Folded or
 * not, and the width, are remembered for the next visit.
 */
export default function StudioChatColumn({
  project,
  version,
  captureStage,
}: Omit<ComponentProps<typeof StudioChat>, 'onFold'>) {
  const { t } = useTranslation();
  const [folded, setFolded] = useState(() => readStored(FOLDED_KEY) === 'true');
  const column = useRef<HTMLElement>(null);
  const width = useChatWidth(column);
  const fold = (next: boolean) => {
    setFolded(next);
    writeStored(FOLDED_KEY, String(next));
  };

  if (folded) {
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
    <aside ref={column} className="studio-bench__chat" style={width.style}>
      <ColumnResizer
        ariaLabel={t('studioChat.resize')}
        valuePercent={width.resizer.valuePercent}
        onStart={width.resizer.onStart}
        onDrag={width.resizer.onDrag}
        onEnd={width.resizer.onEnd}
        onReset={width.resizer.onReset}
      />
      <StudioChat
        project={project}
        version={version}
        captureStage={captureStage}
        onFold={() => fold(true)}
      />
    </aside>
  );
}
