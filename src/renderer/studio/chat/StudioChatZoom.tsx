/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import Glyph from '../../community/Glyph';
import { useTranslation } from '../../utils/I18nContext';
import {
  STUDIO_CHAT_ZOOMS,
  stepStudioChatZoom,
  useStudioChat,
} from './studioChatStore';

/**
 * The chat's own text size: smaller, the size now (which puts it back to
 * normal), larger. Beside the line under the message box, where a reader
 * who finds the words small looks; Ctrl and the wheel over the chat do the
 * same (`useChatZoomWheel`).
 */
export default function StudioChatZoom() {
  const { t } = useTranslation();
  const { zoom } = useStudioChat();
  const percent = Math.round(zoom * 100);
  return (
    <div
      className="studio-chat__zoom"
      role="group"
      aria-label={t('studioChat.zoom.label')}
    >
      <button
        type="button"
        title={t('studioChat.zoom.out')}
        aria-label={t('studioChat.zoom.out')}
        disabled={zoom === STUDIO_CHAT_ZOOMS[0]}
        onClick={() => stepStudioChatZoom(-1)}
      >
        <Glyph name="zoom-out" />
      </button>
      <button
        type="button"
        className="studio-chat__zoom-size"
        title={t('studioChat.zoom.reset')}
        aria-label={t('studioChat.zoom.reset')}
        disabled={zoom === 1}
        onClick={() => stepStudioChatZoom(0)}
      >
        {percent}%
      </button>
      <button
        type="button"
        title={t('studioChat.zoom.in')}
        aria-label={t('studioChat.zoom.in')}
        disabled={zoom === STUDIO_CHAT_ZOOMS[STUDIO_CHAT_ZOOMS.length - 1]}
        onClick={() => stepStudioChatZoom(1)}
      >
        <Glyph name="zoom-in" />
      </button>
    </div>
  );
}
