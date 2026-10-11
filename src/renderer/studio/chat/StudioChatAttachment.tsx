/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useMemo, useState } from 'react';
import Glyph from '../../community/Glyph';
import { useTranslation } from '../../utils/I18nContext';
import StudioChatSketch from './StudioChatSketch';

interface IStudioChatAttachmentProps {
  /** The stage's picture going with the next message, marks and all. */
  image: Uint8Array;
  onChange: (image: Uint8Array) => void;
  onRemove: () => void;
}

/**
 * The stage's picture in the message box, as it will go with the message:
 * pressing it opens it large to draw on (`StudioChatSketch.tsx`), and the
 * cross takes it off the message.
 */
export default function StudioChatAttachment({
  image,
  onChange,
  onRemove,
}: IStudioChatAttachmentProps) {
  const { t } = useTranslation();
  const [sketching, setSketching] = useState(false);
  const url = useMemo(
    () => URL.createObjectURL(new Blob([new Uint8Array(image)])),
    [image],
  );
  useEffect(() => () => URL.revokeObjectURL(url), [url]);

  return (
    <div className="studio-chat__attachment">
      <button
        type="button"
        className="studio-chat__attachment-picture"
        title={t('studioChat.sketch.open')}
        aria-label={t('studioChat.sketch.open')}
        onClick={() => setSketching(true)}
      >
        <img src={url} alt="" />
        <span className="studio-chat__attachment-draw" aria-hidden="true">
          <Glyph name="studio" />
        </span>
      </button>
      <button
        type="button"
        className="studio-chat__attachment-remove"
        title={t('studioChat.sketch.remove')}
        aria-label={t('studioChat.sketch.remove')}
        onClick={onRemove}
      >
        <Glyph name="close" />
      </button>
      {sketching && (
        <StudioChatSketch
          image={image}
          onClose={() => setSketching(false)}
          onDone={(marked) => {
            setSketching(false);
            onChange(marked);
          }}
        />
      )}
    </div>
  );
}
