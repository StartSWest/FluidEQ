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

/** The menu's items that can be pressed now, in order. */
const enabledItems = (from: Element | null): HTMLButtonElement[] => [
  ...(from
    ?.closest('[role="menu"]')
    ?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ??
    []),
];

export default function RemoteAudioPeerMenu({
  name,
  paused,
  canPause = true,
  canReconnect = true,
  onPause,
  onReconnect,
  onUnlink,
}: {
  name: string;
  paused: boolean;
  canPause?: boolean;
  /** False while a reconnect asked for already runs. */
  canReconnect?: boolean;
  onPause(): void;
  onReconnect(): void;
  onUnlink(): void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  // The subject heads the menu whatever is enabled, so it is where the menu
  // finds its first item to focus when it opens.
  const focusFirst = useCallback(
    (subject: HTMLParagraphElement | null) => {
      if (subject && open) {
        enabledItems(subject)[0]?.focus();
      }
    },
    [open],
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
    const items = enabledItems(event.currentTarget);
    const at = items.indexOf(event.currentTarget);
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      items[(at + step + items.length) % items.length]?.focus();
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      items[event.key === 'Home' ? 0 : items.length - 1]?.focus();
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
        <p className="band-menu__subject" ref={focusFirst}>
          {name}
        </p>
        <button
          disabled={!canPause}
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
        <button
          disabled={!canReconnect}
          type="button"
          role="menuitem"
          onKeyDown={navigate}
          onClick={() => {
            close();
            onReconnect();
          }}
        >
          <MenuIcon name="restart" className="band-menu__icon" />
          <span>{t('remoteAudio.linked.reconnect')}</span>
        </button>
        <div className="band-menu__rule" role="none" />
        <button
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
