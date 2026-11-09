import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
} from 'react';
import ProfileActionIcon from '../icons/ProfileActionIcon';
import { useTranslation } from '../utils/I18nContext';
import useIsGraphChromeIdle from './graphChromeIdle';
import type { ISceneInteraction } from './sceneInteraction';
import '../styles/SceneHands.scss';

interface ISceneViewResetProps {
  interaction: ISceneInteraction;
  /** Where the surface puts it. */
  className: string;
  /** Offsets the surface can only know as it lays itself out. */
  style?: CSSProperties;
}

/**
 * The way back to the scene's own view, on whatever surface it was turned
 * on: there only while the camera is somewhere else, so a scene nobody has
 * touched carries no control it does not need.
 *
 * AND ONLY WHILE SOMEBODY IS AT THE SCENE (Ivan, 2026-11-08: "reset view
 * button in plus viz that moves cam needs to auto hide"). It used to stay over
 * the picture for as long as the view was turned: on the Studio's stage and
 * in the gallery's preview for good, on the graph until its chrome went idle.
 * Now, on every surface alike, it shows while the pointer is over the scene
 * or the button has the keyboard's focus, and fades out when the pointer
 * leaves. Where the window's chrome goes idle (`useIsGraphChromeIdle`, the five
 * still seconds the graph's toolbar fades on) it fades with it while the
 * pointer rests on the picture, and the next move or wheel over the scene —
 * which is also how the view is turned again — brings it back. Nothing here
 * counts time: the pointer's own events and the idle state the window already
 * keeps decide it.
 */
export default function SceneViewReset({
  interaction,
  className,
  style,
}: ISceneViewResetProps) {
  const { t } = useTranslation();
  const moved = useSyncExternalStore(
    interaction.subscribe,
    interaction.moved,
    interaction.moved,
  );
  const isChromeIdle = useIsGraphChromeIdle();
  const plateRef = useRef<HTMLSpanElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  // A move or a wheel over the scene since the chrome last went idle: what
  // brings the button back over a picture the window has gone still on.
  const [isWoken, setIsWoken] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  // The surface is the element the plate stands in: the graph's drawing, the
  // Studio's stage, the gallery's frame. Watched only while there is a plate.
  useEffect(() => {
    const surface = moved ? plateRef.current?.parentElement : undefined;
    if (!surface) {
      return undefined;
    }
    const enter = () => setIsHovered(true);
    const leave = () => {
      setIsHovered(false);
      setIsWoken(false);
    };
    const wake = () => {
      setIsHovered(true);
      setIsWoken(true);
    };
    // The pointer is already over the scene when the view is first turned —
    // that turn is what brings the plate — so the plate starts present.
    setIsHovered(surface.matches(':hover'));
    surface.addEventListener('pointerenter', enter);
    surface.addEventListener('pointerleave', leave);
    surface.addEventListener('pointermove', wake, { passive: true });
    surface.addEventListener('wheel', wake, { passive: true });
    return () => {
      surface.removeEventListener('pointerenter', enter);
      surface.removeEventListener('pointerleave', leave);
      surface.removeEventListener('pointermove', wake);
      surface.removeEventListener('wheel', wake);
    };
  }, [moved]);

  // Going idle takes the plate away even with the pointer resting on the
  // picture; only a fresh move over it brings it back.
  useEffect(() => {
    if (isChromeIdle) {
      setIsWoken(false);
    }
  }, [isChromeIdle]);

  if (!moved) {
    return null;
  }
  const isShown = isFocused || (isHovered && (!isChromeIdle || isWoken));
  return (
    <span
      ref={plateRef}
      className={`scene-view-reset ${className}${isShown ? '' : ' is-idle'}`}
      style={style}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
    >
      <button
        type="button"
        className="button small subtle"
        onClick={() => interaction.reset()}
      >
        <ProfileActionIcon action="restore" />
        {t('graph.scene.resetView')}
      </button>
    </span>
  );
}
