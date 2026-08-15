/* FluidEQ Karaoke Maker movable floating panel. GPL-3.0-or-later. */

import {
  CSSProperties,
  PointerEvent as ReactPointerEvent,
  ReactNode,
  RefObject,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import KaraokeMakerToolIcon from './KaraokeMakerToolIcon';

interface IKaraokeMakerFloatingPanelProps {
  anchorRef?: RefObject<HTMLElement | null>;
  ariaLabel?: string;
  ariaLive?: 'off' | 'polite' | 'assertive';
  children: ReactNode;
  className: string;
  closeLabel?: string;
  moveLabel: string;
  onClose?: () => void;
}

interface IFloatingPanelDrag {
  pointerId: number;
  startX: number;
  startY: number;
  positionX: number;
  positionY: number;
  minimumX: number;
  maximumX: number;
  minimumY: number;
  maximumY: number;
}

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value));

/**
 * Shared movement shell for temporary Maker tools. Keeping selection editing
 * and line capture on the same surface avoids reserving permanent footer
 * space for controls that only exist while the user is actively editing.
 */
const KaraokeMakerFloatingPanel = ({
  anchorRef,
  ariaLabel,
  ariaLive = 'polite',
  children,
  className,
  closeLabel,
  moveLabel,
  onClose,
}: IKaraokeMakerFloatingPanelProps) => {
  const rootRef = useRef<HTMLElement>(null);
  const dragRef = useRef<IFloatingPanelDrag | undefined>(undefined);
  const [position, setPosition] = useState<
    { x: number; y: number } | undefined
  >(undefined);

  const constrainPosition = useCallback(
    (candidate: { x: number; y: number }) => {
      const card = rootRef.current?.getBoundingClientRect();
      const host = rootRef.current?.parentElement?.getBoundingClientRect();
      if (!card || !host) {
        return candidate;
      }
      const inset = 10;
      const halfWidth = card.width / 2;
      const halfHeight = card.height / 2;
      const minimumX = halfWidth + inset;
      const minimumY = halfHeight + inset;
      return {
        x: clamp(
          candidate.x,
          minimumX,
          Math.max(minimumX, host.width - halfWidth - inset),
        ),
        y: clamp(
          candidate.y,
          minimumY,
          Math.max(minimumY, host.height - halfHeight - inset),
        ),
      };
    },
    [],
  );

  const resetPosition = useCallback(() => {
    const card = rootRef.current?.getBoundingClientRect();
    const host = rootRef.current?.parentElement?.getBoundingClientRect();
    if (!card || !host) {
      return;
    }
    const anchor = anchorRef?.current?.getBoundingClientRect();
    setPosition(
      constrainPosition({
        x: host.width / 2,
        y: anchor ? anchor.bottom - host.top : host.height / 2,
      }),
    );
  }, [anchorRef, constrainPosition]);

  useLayoutEffect(() => {
    resetPosition();
  }, [resetPosition]);

  useLayoutEffect(() => {
    const keepInsideWindow = () => {
      setPosition((current) =>
        current ? constrainPosition(current) : current,
      );
    };
    window.addEventListener('resize', keepInsideWindow);
    const host = rootRef.current?.parentElement;
    const resizeObserver =
      host && typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(keepInsideWindow)
        : undefined;
    if (host && resizeObserver) {
      resizeObserver.observe(host);
      if (rootRef.current) {
        resizeObserver.observe(rootRef.current);
      }
    }
    return () => {
      window.removeEventListener('resize', keepInsideWindow);
      resizeObserver?.disconnect();
    };
  }, [constrainPosition]);

  const startDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0 || !rootRef.current?.parentElement) {
      return;
    }
    event.preventDefault();
    const card = rootRef.current.getBoundingClientRect();
    const host = rootRef.current.parentElement.getBoundingClientRect();
    const inset = 10;
    const positionX = position?.x ?? card.left - host.left + card.width / 2;
    const positionY = position?.y ?? card.top - host.top + card.height / 2;
    const minimumX = card.width / 2 + inset;
    const minimumY = card.height / 2 + inset;
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      positionX,
      positionY,
      minimumX,
      maximumX: Math.max(minimumX, host.width - card.width / 2 - inset),
      minimumY,
      maximumY: Math.max(minimumY, host.height - card.height / 2 - inset),
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const moveDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }
    setPosition({
      x: clamp(
        drag.positionX + event.clientX - drag.startX,
        drag.minimumX,
        drag.maximumX,
      ),
      y: clamp(
        drag.positionY + event.clientY - drag.startY,
        drag.minimumY,
        drag.maximumY,
      ),
    });
  };

  const finishDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) {
      return;
    }
    dragRef.current = undefined;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  };

  const style: CSSProperties = {
    left: position?.x,
    top: position?.y,
    transform: 'translate(-50%, -50%)',
    visibility: position ? 'visible' : 'hidden',
  };

  return (
    <aside
      ref={rootRef}
      className={className}
      style={style}
      aria-label={ariaLabel}
      aria-live={ariaLive}
    >
      <button
        type="button"
        className="karaoke-maker__capture-drag"
        aria-label={moveLabel}
        data-tooltip={moveLabel}
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
        onDoubleClick={resetPosition}
        onKeyDown={(event) => {
          if (event.key === 'Home') {
            event.preventDefault();
            resetPosition();
            return;
          }
          const movement: Record<string, { x: number; y: number }> = {
            ArrowLeft: { x: -12, y: 0 },
            ArrowRight: { x: 12, y: 0 },
            ArrowUp: { x: 0, y: -12 },
            ArrowDown: { x: 0, y: 12 },
          };
          const delta = movement[event.key];
          if (delta) {
            event.preventDefault();
            setPosition((current) =>
              constrainPosition({
                x: (current?.x ?? 0) + delta.x,
                y: (current?.y ?? 0) + delta.y,
              }),
            );
          }
        }}
      >
        <span />
        <span />
        <span />
      </button>

      {onClose && closeLabel && (
        <button
          type="button"
          className="karaoke-maker__capture-coach-close"
          aria-label={closeLabel}
          data-tooltip={closeLabel}
          onClick={onClose}
        >
          <KaraokeMakerToolIcon name="close" />
        </button>
      )}

      {children}
    </aside>
  );
};

export default KaraokeMakerFloatingPanel;
