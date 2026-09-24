import { useRef, type ReactNode } from 'react';
import PaneResizer from '../components/PaneResizer';
import { useTranslation } from '../utils/I18nContext';
import useStudioStageRatio from './useStudioStageRatio';

interface IStudioStageAreaProps {
  /**
   * Whichever well the bench chose. First in the area, because the divider
   * measures the stage from the area's first child.
   */
  stage: ReactNode;
  /**
   * The graph's divider, to try the scene on a taller or shorter graph. Only
   * at the graph's size: the others are fixed panels.
   */
  resizable: boolean;
  /** What stands under the stage and its divider. */
  children: ReactNode;
}

/**
 * The stage and what stands under it, at the shape its divider left it
 * (`useStudioStageRatio.ts`). The shape is this area's own state, so letting
 * go of the divider renders the area, not the whole bench around it.
 */
export default function StudioStageArea({
  stage,
  resizable,
  children,
}: IStudioStageAreaProps) {
  const { t } = useTranslation();
  const area = useRef<HTMLDivElement>(null);
  const shape = useStudioStageRatio(area);
  return (
    <div ref={area} className="studio-bench__stage" style={shape.style}>
      {stage}
      {resizable && (
        <PaneResizer
          ariaLabel={t('studio.stage.resize')}
          valuePercent={shape.resizer.valuePercent}
          onStart={shape.resizer.onStart}
          onDrag={shape.resizer.onDrag}
          onEnd={shape.resizer.onEnd}
        />
      )}
      {children}
    </div>
  );
}
