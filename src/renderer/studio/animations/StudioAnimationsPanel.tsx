import { animatorChatKey } from 'common/studioChat';
import { useAnimatorChats } from '../chat/animatorChatStore';
import AnimatorChat from './AnimatorChat';
import StudioAnimations from './StudioAnimations';
import type { IViewedAnimation } from './useStudioAnimations';

interface IStudioAnimationsPanelProps {
  projectId: string;
  animations: IViewedAnimation[];
}

/**
 * The Animations tab with each animation's animator: a card says while its
 * animator works, and an opened animation has its animator beside it. Its
 * own component, so the animators' replies - a word at a time - re-render
 * this tab and never the whole bench around it.
 */
export default function StudioAnimationsPanel({
  projectId,
  animations,
}: IStudioAnimationsPanelProps) {
  const { busy } = useAnimatorChats();
  return (
    <StudioAnimations
      animations={animations}
      isWorking={(name) => busy[animatorChatKey(projectId, name)] === true}
      renderSide={(viewed) => (
        <AnimatorChat projectId={projectId} name={viewed.animation.name} />
      )}
    />
  );
}
