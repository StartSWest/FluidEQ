import {
  useEffect,
  useId,
  useRef,
  type MouseEvent,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import DialogClose from '../../components/DialogClose';
import MenuIcon from '../../icons/MenuIcon';
import { useTranslation } from '../../utils/I18nContext';
import useModalKeys from '../../utils/useModalKeys';
import AnimationView from './AnimationView';
import type { IAnimationPlayer } from './useAnimationPlayer';
import type { IViewedAnimation } from './useStudioAnimations';
import '../../styles/Gallery.scss';
import '../../styles/StudioPictureLightbox.scss';

interface IStudioAnimationModalProps {
  viewed: IViewedAnimation;
  player: IAnimationPlayer;
  /** Beside the animation: the agent working on it, brought along. */
  side?: ReactNode;
  onClose: () => void;
}

/**
 * Whether an arrow key pressed on `target` is this view's to step frames
 * with. Not while somebody types (the animator's message box, a field) or
 * works inside the chat, whose menus walk with the arrows; and not from a
 * dialog opened over this one, such as the chat's picture viewer, which
 * steps its own pictures.
 */
const stepsFrames = (target: EventTarget | null, surface: Element | null) => {
  if (!(target instanceof Element)) {
    return true;
  }
  const dialog = target.closest('[role="dialog"]');
  if (dialog && dialog !== surface) {
    return false;
  }
  return !target.closest(
    '.studio-chat, input, textarea, select, [contenteditable="true"]',
  );
};

/**
 * An opened animation over the Studio, to see it bigger (Ivan, 2026-11-09:
 * "que tenga para expandir y abrir en un modal", "para verse mas grande"):
 * the same view and the same player as below, in the picture viewer's shell,
 * the stage taking everything the window leaves after one row of controls
 * and the strip. Esc, a click outside it and the close button go back, on
 * the same frame, playing or not; the arrow keys step through the frames.
 * The animator comes along beside it (`side`), to watch the frames and talk
 * to it without coming back.
 */
export default function StudioAnimationModal({
  viewed,
  player,
  side,
  onClose,
}: IStudioAnimationModalProps) {
  const { t } = useTranslation();
  const titleId = useId();
  const surfaceRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  useModalKeys(surfaceRef, closeRef, { busy: false, onCancel: onClose });
  const { animation } = viewed;
  const { frame, goTo } = player;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const step = { ArrowLeft: -1, ArrowRight: 1 }[event.key];
      if (
        step === undefined ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        event.defaultPrevented ||
        !stepsFrames(event.target, surfaceRef.current)
      ) {
        return;
      }
      event.preventDefault();
      // Modal: the graph and the Studio behind it listen for the same keys.
      event.stopPropagation();
      goTo(frame + step);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [frame, goTo]);

  const closeOnEmpty = (event: MouseEvent<HTMLElement>) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  return createPortal(
    <div
      className="gallery-dialog-backdrop"
      role="presentation"
      onClick={closeOnEmpty}
    >
      <div
        ref={surfaceRef}
        className="studio-lightbox studio-animation-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="studio-lightbox__head">
          <span className="dialog-frame__tile" aria-hidden="true">
            <MenuIcon name="image" />
          </span>
          <div className="studio-lightbox__heading">
            <h2 id={titleId} className="dialog-frame__title">
              {animation.name}
            </h2>
            <span className="studio-lightbox__size">
              {t(
                animation.loop
                  ? 'studio.animation.meta'
                  : 'studio.animation.metaOnce',
                { count: animation.count, fps: animation.fps },
              )}
            </span>
          </div>
        </div>
        <DialogClose
          ref={closeRef}
          className="studio-lightbox__close"
          label={t('studio.animation.close')}
          onClose={onClose}
        />
        <div className="studio-animation-modal__body">
          <AnimationView viewed={viewed} player={player} />
          {side}
        </div>
      </div>
    </div>,
    document.body,
  );
}
