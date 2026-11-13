import { useEffect, useRef, useState } from 'react';

interface IGalleryCardClipProps {
  /** The clip, as an object URL `useCardClip` made and will revoke. */
  url: string;
}

/**
 * A card's clip over its cover: silent, looping, and invisible until its
 * first frame is actually playing, so the cover never gives way to a black
 * box while the file is read. Gone with the hover; its element lets go of the
 * decoder on the way out instead of waiting for collection.
 */
export default function GalleryCardClip({ url }: IGalleryCardClipProps) {
  const video = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const element = video.current;
    setPlaying(false);
    return () => {
      if (element) {
        element.pause();
        element.removeAttribute('src');
        element.load();
      }
    };
  }, [url]);

  return (
    <video
      ref={video}
      className={`gallery-card__clip${playing ? ' is-playing' : ''}`}
      src={url}
      aria-hidden="true"
      preload="auto"
      muted
      playsInline
      autoPlay
      loop
      disablePictureInPicture
      onPlaying={() => setPlaying(true)}
    />
  );
}
