import { useCallback, useEffect, useState, type MouseEvent } from 'react';
import Glyph from '../community/Glyph';
import { useTranslation } from '../utils/I18nContext';
import AnchoredMenu, { isInsideAnchoredMenu } from '../widgets/AnchoredMenu';
import type { IPictureSource } from './pictureClipboard';
import usePictureCopy from './usePictureCopy';

interface IOpenMenu {
  anchor: HTMLElement;
  source: IPictureSource;
}

/**
 * The right click a picture offers, on the Studio's previews: the chat's
 * pictures and the Pictures card's (Ivan, 2026-11-09: "I need to be able to
 * copy image from previews too"). A menu of one, "Copy image", on the app's
 * own menu (`AnchoredMenu`, the Studio's action-menu look), opened from the
 * picture the click landed on.
 *
 * The item says "Copied" for its moment and the menu closes when the word
 * does, so what happened is seen before the menu goes. A press elsewhere and
 * Escape close it, as every menu on `AnchoredMenu` does.
 */
export default function useStudioPictureMenu() {
  const { t } = useTranslation();
  const [open, setOpen] = useState<IOpenMenu>();
  const close = useCallback(() => setOpen(undefined), []);
  const { copy, label, reset, copying } = usePictureCopy(close);
  // Opened by the keyboard's menu key as well as a click: the one item takes
  // the focus the moment it is drawn, which is after the menu has measured
  // where it goes, so Enter copies.
  const focusItem = useCallback((node: HTMLButtonElement | null) => {
    node?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    if (!open) {
      return undefined;
    }
    const onPointerDown = (event: globalThis.MouseEvent) => {
      if (!isInsideAnchoredMenu(event.target)) {
        setOpen(undefined);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(undefined);
      }
    };
    window.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  /** Opens on the picture clicked: the listener's own element, or `anchor`. */
  const openMenu = useCallback(
    (
      event: MouseEvent<HTMLElement>,
      source: IPictureSource,
      anchor: HTMLElement = event.currentTarget,
    ) => {
      event.preventDefault();
      reset();
      setOpen({ anchor, source });
    },
    [reset],
  );

  const menu = (
    <AnchoredMenu
      anchor={open?.anchor ?? null}
      isOpen={open !== undefined}
      className="studio-ship-more__menu"
      ariaLabel={t('studio.picture.copy')}
      align="left"
    >
      <button
        ref={focusItem}
        type="button"
        role="menuitem"
        className="studio-ship-more__item"
        aria-busy={copying}
        onClick={() => {
          if (open && !copying) {
            copy(open.source);
          }
        }}
      >
        <Glyph name="copy" />
        {label}
      </button>
    </AnchoredMenu>
  );

  return { openMenu, menu };
}
