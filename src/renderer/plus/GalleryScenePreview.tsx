import { useEffect, useRef, type ComponentProps } from 'react';
import { SceneAudioProvider } from '../audio/SceneAudioContext';
import ScenePreview from './ScenePreview';
import useQuietDemoAudio from '../audio/useQuietDemoAudio';

type TGalleryScenePreviewProps = ComponentProps<typeof ScenePreview> & {
  /** Told when the scene starts or stops moving to the demo song. */
  onDemo: (demo: boolean) => void;
};

/**
 * A scene on its Gallery page: on the music playing, or on the demo song,
 * silently, while nothing plays (`useQuietDemoAudio`). Its own component so
 * that what the scene hears - read about twenty times a second - re-renders
 * this and the preview, never the whole page; the page hears only the flip,
 * for its tag.
 */
export default function GalleryScenePreview({
  onDemo,
  ...preview
}: TGalleryScenePreviewProps) {
  const { audio, demo } = useQuietDemoAudio();
  const demoRef = useRef(onDemo);
  demoRef.current = onDemo;
  useEffect(() => {
    demoRef.current(demo);
  }, [demo]);
  // Leaving the page, or the scene giving out, ends the demo's tag with it.
  useEffect(() => () => demoRef.current(false), []);
  return (
    <SceneAudioProvider value={audio}>
      {/* eslint-disable-next-line react/jsx-props-no-spreading -- every one of the preview's own props, passed on unchanged */}
      <ScenePreview {...preview} />
    </SceneAudioProvider>
  );
}
