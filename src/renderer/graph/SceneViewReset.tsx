import { useState, useSyncExternalStore, type CSSProperties } from 'react';
import ProfileActionIcon from '../icons/ProfileActionIcon';
import { useTranslation } from '../utils/I18nContext';
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
 * AND ONLY WHILE THE CAMERA'S KEY IS HELD OVER THE SCENE (Ivan, 2026-11-09:
 * "reset view button only appears when pressing the modifier key that is
 * used for modifying the scene"): the key the viewer chose for the camera,
 * Ctrl unless they chose another (`sceneCameraControl.ts`), held with the
 * pointer over the surface it stands on - the moment somebody is about to
 * turn the view, or has just turned it. Let go, it goes. Before this it
 * showed whenever the pointer was over a turned scene and faded with the
 * window's idle chrome; a plate over the picture each time the mouse
 * crossed it was more than the view's way home needed.
 *
 * A turned view with the key held shows it; the scene's own view never does,
 * key or not. Keyboard focus keeps it shown, so Tab can reach it and press
 * it, and the key's state clears when the window loses focus
 * (`sceneInteraction.ts`), so it cannot stay up after the key went up
 * somewhere else. Nothing here counts time.
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
  const keyHeld = useSyncExternalStore(
    interaction.subscribe,
    interaction.keyHeldOver,
    interaction.keyHeldOver,
  );
  const [isFocused, setIsFocused] = useState(false);

  if (!moved) {
    return null;
  }
  const isShown = isFocused || keyHeld;
  return (
    <span
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
