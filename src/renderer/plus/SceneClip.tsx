import { useEffect, useRef, useState } from 'react';

interface ISceneClipProps {
  /** The clip, as an object URL `useSceneClip` made and will revoke. */
  url: string;
  /** Where it is laid: a gallery card's cover or a look picker tile. */
  className: string;
}

/**
 * Chromium tells when a frame reached the screen; a test's DOM does not, and
 * `playing` - playback began, a frame or more before anything is painted -
 * stands in for it there.
 */
const SEES_FRAMES =
  typeof HTMLVideoElement !== 'undefined' &&
  'requestVideoFrameCallback' in HTMLVideoElement.prototype;

/**
 * A scene's published clip over its picture: silent, looping, and invisible
 * until its first frame has actually been painted, so the picture never gives
 * way to a black box while the file is read and the decoder starts.
 *
 * Paused while the window is hidden (minimized, another desktop): a clip
 * nobody can see still costs a decoder. Its element lets go of the decoder
 * on the way out instead of waiting for collection.
 */
export default function SceneClip({ url, className }: ISceneClipProps) {
  const video = useRef<HTMLVideoElement>(null);
  const [painted, setPainted] = useState(false);

  useEffect(() => {
    const element = video.current;
    setPainted(false);
    if (!element) {
      return undefined;
    }
    const frame = SEES_FRAMES
      ? element.requestVideoFrameCallback(() => setPainted(true))
      : 0;
    const followWindow = () => {
      if (document.hidden) {
        element.pause();
      } else {
        // Refused only when the element has no source left to play.
        element.play().catch(() => undefined);
      }
    };
    if (document.hidden) {
      element.pause();
    }
    document.addEventListener('visibilitychange', followWindow);
    return () => {
      document.removeEventListener('visibilitychange', followWindow);
      if (SEES_FRAMES) {
        element.cancelVideoFrameCallback(frame);
      }
      // React has already written the next clip's address when this runs for
      // a change of clip; only the one this effect started is let go.
      if (element.getAttribute('src') === url) {
        element.pause();
        element.removeAttribute('src');
        element.load();
      }
    };
  }, [url]);

  return (
    <video
      ref={video}
      className={`${className}${painted ? ' is-playing' : ''}`}
      src={url}
      aria-hidden="true"
      preload="auto"
      muted
      playsInline
      autoPlay={!document.hidden}
      loop
      disablePictureInPicture
      onPlaying={SEES_FRAMES ? undefined : () => setPainted(true)}
    />
  );
}
