/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import Glyph from '../../community/Glyph';
import { useTranslation } from '../../utils/I18nContext';
import '../../styles/StudioChatAsk.scss';

/**
 * Over the chat of a copy of another member's scene: the AI asks before
 * every command, because a line in that member's files can tell it to run
 * one. Unlike a folder from outside FluidEQ (`StudioChatOutside`) there is
 * nothing to press: nobody here can vouch for somebody else's files, so the
 * copy stays this careful for as long as it is kept (`projectOrigin.ts`).
 */
export default function StudioChatMemberCopy() {
  const { t } = useTranslation();
  return (
    <section
      className="studio-chat__ask"
      aria-label={t('studioChat.memberCopy.title')}
    >
      <span className="studio-chat__ask-mark" aria-hidden="true">
        <Glyph name="shield" />
      </span>
      <div className="studio-chat__ask-content">
        <p className="studio-chat__ask-title">
          {t('studioChat.memberCopy.title')}
        </p>
        <p className="studio-chat__ask-body">
          {t('studioChat.memberCopy.body')}
        </p>
      </div>
    </section>
  );
}
