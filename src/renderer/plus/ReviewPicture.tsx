/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useState } from 'react';
import Glyph from '../community/Glyph';

interface IReviewPictureProps {
  authorId: string;
  sceneId: string;
  /**
   * The hash of what the submission signed, which names the folder its
   * picture waits in (server migration 0038). Absent for one no longer
   * waiting, whose files are gone: the placeholder is drawn and nothing asked.
   */
  sha256?: string;
  className?: string;
}

type TPicture =
  { state: 'loading' } | { state: 'ready'; url: string } | { state: 'none' };

/**
 * The picture a scene waiting for review was sent with, drawn exactly as the
 * gallery draws one — the same classes, the same shimmer while it comes.
 *
 * Its own component because the file is not where the gallery's are: it waits
 * beside the scene under `review/`, readable by its maker and the admin only,
 * and the gallery's picture cache must never hold one. Asked again for a new
 * submission of the same scene, which is new bytes in a new folder.
 */
export default function ReviewPicture({
  authorId,
  sceneId,
  sha256,
  className,
}: IReviewPictureProps) {
  const [picture, setPicture] = useState<TPicture>(
    sha256 ? { state: 'loading' } : { state: 'none' },
  );

  useEffect(() => {
    if (!sha256) {
      setPicture({ state: 'none' });
      return undefined;
    }
    let current = true;
    setPicture({ state: 'loading' });
    window.electron?.ipcRenderer
      ?.reviewPicture?.(authorId, sceneId, sha256)
      .then((url) => {
        if (current) {
          setPicture(url ? { state: 'ready', url } : { state: 'none' });
        }
        return undefined;
      })
      .catch(() => {
        if (current) {
          setPicture({ state: 'none' });
        }
      });
    return () => {
      current = false;
    };
  }, [authorId, sceneId, sha256]);

  return (
    <div
      className={`gallery-picture gallery-picture--${picture.state}${className ? ` ${className}` : ''}`}
    >
      {picture.state === 'ready' && (
        <img
          className="gallery-picture__image"
          src={picture.url}
          alt=""
          draggable={false}
        />
      )}
      {picture.state === 'none' && (
        <span className="gallery-picture__none" aria-hidden="true">
          <Glyph name="looks" />
        </span>
      )}
    </div>
  );
}
