/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useState } from 'react';
import Glyph from '../../community/Glyph';
import { useTranslation } from '../../utils/I18nContext';

/**
 * Copies one turn of the conversation, as it was written — the member's
 * message or Claude's reply, with its markdown (Ivan, 2026-10-09: "add a
 * copy button for turns"). Says "Copied" until the pointer or the focus
 * leaves it, which is when the reader has seen it; no clock decides that.
 */
export default function StudioChatCopy({ text }: { text: string }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const label = t(copied ? 'studioChat.copied' : 'studioChat.copy');
  return (
    <button
      type="button"
      className={`studio-chat__copy${copied ? ' is-copied' : ''}`}
      title={label}
      aria-label={label}
      onClick={() => {
        navigator.clipboard
          .writeText(text)
          .then(() => setCopied(true))
          .catch(() => setCopied(false));
      }}
      onMouseLeave={() => setCopied(false)}
      onBlur={() => setCopied(false)}
    >
      <Glyph name={copied ? 'check' : 'copy'} />
    </button>
  );
}
