/* FluidEQ — GPL-3.0-or-later. The app's anchored popup and actual menu styles. */
import {
  useEffect,
  useCallback,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { useTranslation } from '../utils/I18nContext';
import MenuIcon from '../icons/MenuIcon';
import AnchoredMenu, { isInsideAnchoredMenu } from '../widgets/AnchoredMenu';
import '../styles/BandMenu.scss';

export default function RemoteAudioPeerMenu({
  name,
  paused,
  canPause = true,
  onPause,
  onUnlink,
}: {
  name: string;
  paused: boolean;
  canPause?: boolean;
  onPause(): void;
  onUnlink(): void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const first = useRef<HTMLButtonElement>(null);
  const last = useRef<HTMLButtonElement>(null);
  const focusFirst = useCallback(
    (element: HTMLButtonElement | null) => {
      first.current = element;
      if (element && open && canPause) {
        element.focus();
      }
    },
    [open, canPause],
  );
  const focusLast = useCallback(
    (element: HTMLButtonElement | null) => {
      last.current = element;
      if (element && open && !canPause) {
        element.focus();
      }
    },
    [open, canPause],
  );

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
      (!canPause || event.currentTarget === first.current
        ? last.current
        : first.current
      )?.focus();
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      (event.key === 'Home' && canPause
        ? first.current
        : last.current
      )?.focus();
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
        aria-label={t('remoteAudio.group.options', { name })}
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
        ariaLabel={t('remoteAudio.group.options', { name })}
      >
        <p className="band-menu__subject">{name}</p>
        <button
          disabled={!canPause}
          ref={focusFirst}
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
          <span>
            {paused
              ? t('remoteAudio.linked.resume')
              : t('remoteAudio.linked.pause')}
          </span>
        </button>
        <div className="band-menu__rule" role="none" />
        <button
          ref={focusLast}
          type="button"
          role="menuitem"
          onKeyDown={navigate}
          onClick={() => {
            close();
            onUnlink();
          }}
        >
          <MenuIcon name="bothWays" className="band-menu__icon" />
          <span>{t('remoteAudio.linked.unlink')}</span>
        </button>
      </AnchoredMenu>
    </>
  );
}
