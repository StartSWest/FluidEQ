/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useMemo } from 'react';
import { isDecodablePicture } from 'common/pictureBounds';
import { useTranslation } from '../../utils/I18nContext';
import type { IZoomView } from '../pictureZoom';
import type { IChatPicture } from './chatPictureList';
import { chatPictureIn } from './chatPictureIn';
import StudioChatSketch from './StudioChatSketch';

/** The PNG, JPEG or WebP a chat picture's data URL holds, or nothing. */
export const chatPictureBytes = (src: string): Uint8Array | undefined => {
  const found = /^data:image\/(?:png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(
    src,
  );
  if (!found) {
    return undefined;
  }
  try {
    const text = atob(found[1]);
    const bytes = new Uint8Array(text.length);
    for (let at = 0; at < text.length; at += 1) {
      bytes[at] = text.charCodeAt(at);
    }
    // Refused here, before the sketch decodes anything, when the header says
    // it decodes past `PICTURE_BOUNDS` (`pictureBounds.ts`).
    return isDecodablePicture(bytes) ? bytes : undefined;
  } catch {
    return undefined;
  }
};

interface IStudioChatPictureDrawProps {
  picture: IChatPicture;
  /** The closer look the viewer was on, to draw from. */
  openingView: IZoomView | undefined;
  /** Back to the viewer, nothing attached. */
  onBack: () => void;
  /** The drawn picture for the message box, as the box keeps a picture. */
  onAttach: (image: Uint8Array) => void;
}

/**
 * A picture from the chat drawn on and attached to the next message (Ivan,
 * 2026-11-09: "I should be able to draw also on zoomed pic inside the chat
 * and attach them to the chat"): the chat's own sketch (`StudioChatSketch`) —
 * its pen, arrows, words, crop, colours, Undo and Esc — opened on the
 * picture at the closer look the viewer was on, its marks at the picture's
 * own pixels whatever the zoom. Its button attaches the picture, marks and
 * all, through the door a pasted picture comes in by (`chatPictureIn`): one
 * JPEG, at most 2048 on its longest side, as the message box keeps every
 * picture. It takes the viewer's place rather than opening over it, so the
 * keyboard has one owner: two viewers' + − and Esc answered the same key.
 */
export default function StudioChatPictureDraw({
  picture,
  openingView,
  onBack,
  onAttach,
}: IStudioChatPictureDrawProps) {
  const { t } = useTranslation();
  const image = useMemo(() => chatPictureBytes(picture.src), [picture.src]);
  // A picture with nothing to draw on goes straight back to the viewer.
  useEffect(() => {
    if (!image) {
      onBack();
    }
  }, [image, onBack]);
  if (!image) {
    return null;
  }
  return (
    <StudioChatSketch
      image={image}
      openingView={openingView}
      doneLabel={t('studioChat.sketch.attach')}
      onClose={onBack}
      onDone={(marked) => {
        chatPictureIn(new Blob([new Uint8Array(marked)]))
          .then((attached) => {
            if (attached) {
              onAttach(attached);
            } else {
              onBack();
            }
            return undefined;
          })
          .catch(() => onBack());
      }}
    />
  );
}
