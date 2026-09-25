import { useSyncExternalStore, type CSSProperties } from 'react';
import ProfileActionIcon from '../icons/ProfileActionIcon';
import { useTranslation } from '../utils/I18nContext';
import type { ISceneInteraction } from './sceneInteraction';
import '../styles/SceneHands.scss';

interface ISceneViewResetProps {
  interaction: ISceneInteraction;
  /** Where the surface puts it, and whether its chrome has gone idle. */
  className: string;
  /** Offsets the surface can only know as it lays itself out. */
  style?: CSSProperties;
}

/**
 * The way back to the scene's own view, on whatever surface it was turned
 * on: there only while the camera is somewhere else, so a scene nobody has
 * touched carries no control it does not need.
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
  if (!moved) {
    return null;
  }
  return (
    <span className={`scene-view-reset ${className}`} style={style}>
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
