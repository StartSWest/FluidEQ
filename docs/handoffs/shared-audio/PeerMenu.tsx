/* FluidEQ — GPL-3.0-or-later. The app's anchored popup and actual menu styles. */
import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import MenuIcon from '../../../src/renderer/icons/MenuIcon';
import AnchoredMenu, {
  isInsideAnchoredMenu,
} from '../../../src/renderer/widgets/AnchoredMenu';
import '../../../src/renderer/styles/BandMenu.scss';

export default function PeerMenu({
  name,
  paused,
  onPause,
  onUnlink,
}: {
  name: string;
  paused: boolean;
  onPause(): void;
  onUnlink(): void;
}) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const first = useRef<HTMLButtonElement>(null);
  const last = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) {
      return undefined;
    }
    const outside = (event: MouseEvent) => {
      if (
        !trigger.current?.contains(event.target as Node) &&
        !isInsideAnchoredMenu(event.target)
      ) {
        setOpen(false);
      }
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    window.addEventListener('mousedown', outside);
    window.addEventListener('keydown', key);
    return () => {
      window.removeEventListener('mousedown', outside);
      window.removeEventListener('keydown', key);
    };
  }, [open]);

  const close = () => {
    setOpen(false);
    trigger.current?.focus();
  };
  const navigate = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      (event.currentTarget === first.current
        ? last.current
        : first.current
      )?.focus();
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      (event.key === 'Home' ? first.current : last.current)?.focus();
    } else if (event.key === 'Tab') {
      close();
    }
  };

  return (
    <>
      <button
        ref={trigger}
        type="button"
        className="button small subtle"
        aria-label={`Options for ${name}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        •••
      </button>
      <AnchoredMenu
        anchor={trigger.current}
        isOpen={open}
        className="band-menu"
        ariaLabel={`Options for ${name}`}
      >
        <p className="band-menu__subject">{name}</p>
        <button
          ref={(element) => {
            first.current = element;
            if (element && open) {
              element.focus();
            }
          }}
          type="button"
          role="menuitem"
          onKeyDown={navigate}
          onClick={() => {
            onPause();
            close();
          }}
        >
          <MenuIcon
            name={paused ? 'play' : 'pause'}
            className="band-menu__icon"
          />
          <span>{paused ? 'Resume' : 'Pause'}</span>
        </button>
        <div className="band-menu__rule" role="none" />
        <button
          ref={last}
          type="button"
          role="menuitem"
          onKeyDown={navigate}
          onClick={() => {
            close();
            onUnlink();
          }}
        >
          <MenuIcon name="bothWays" className="band-menu__icon" />
          <span>Unlink</span>
        </button>
      </AnchoredMenu>
    </>
  );
}
