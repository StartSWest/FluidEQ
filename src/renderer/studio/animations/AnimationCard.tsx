/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import Glyph from '../../community/Glyph';
import { useTranslation } from '../../utils/I18nContext';
import AnchoredMenu from '../../widgets/AnchoredMenu';
import useChatPopover from '../chat/useChatPopover';
import AnimationFrame from './AnimationFrame';
import { useLoopFrame } from './useAnimationPlayer';
import type { IViewedAnimation } from './useStudioAnimations';
import '../../styles/StudioChatPop.scss';

interface IAnimationCardProps {
  viewed: IViewedAnimation;
  /** "8 frames · 9 fps · loops", or "plays once". */
  meta: string;
  /** The scene's chat was asked to remove it and has not yet. */
  removing: boolean;
  /** The scene plays nothing of it, as main's record says (`usageOf`). */
  unused: boolean;
  onOpen: () => void;
  onRename: () => void;
  onShow: () => void;
  onDelete: () => void;
}

/**
 * One animation in the tab, playing its loop as the scene plays it, cropped
 * to what its frames draw (`drawnBoxOf`). The card opens it; its menu (Ivan,
 * 2026-11-10) opens, renames, shows its file and deletes it. The menu is a
 * sibling of the card's button, never inside it: a button in a button is
 * neither.
 */
export default function AnimationCard({
  viewed,
  meta,
  removing,
  unused,
  onOpen,
  onRename,
  onShow,
  onDelete,
}: IAnimationCardProps) {
  const { t } = useTranslation();
  const frame = useLoopFrame(viewed);
  const popover = useChatPopover();
  const { animation } = viewed;
  const menuLabel = t('studio.animation.menu', { name: animation.name });
  const pick = (action: () => void) => () => {
    popover.close();
    action();
  };
  return (
    <li className={`studio-animation-card${removing ? ' is-removing' : ''}`}>
      <button
        type="button"
        className="studio-animation-card__open"
        aria-label={t('studio.animation.open', { name: animation.name })}
        onClick={onOpen}
      >
        <span className="studio-animation-card__frame">
          {viewed.bitmap ? (
            <AnimationFrame
              className="studio-animation-card__art"
              viewed={viewed}
              frame={frame}
              within={viewed.drawn}
            />
          ) : (
            <span className="studio-animation-card__unreadable">
              <Glyph name="alert" />
              {t('studio.animation.unreadable')}
            </span>
          )}
          {viewed.bitmap && (
            <span className="studio-animation-card__count">
              {t('studio.animation.frameOf', {
                frame: frame + 1,
                count: animation.count,
              })}
            </span>
          )}
          {removing ? (
            <span className="studio-animation-card__removing">
              {t('studio.animation.removing')}
            </span>
          ) : (
            unused && (
              <span className="studio-animation-card__unused">
                {t('studio.animation.unused')}
              </span>
            )
          )}
        </span>
        <span className="studio-animation-card__about">
          <span className="studio-animation-card__name" title={animation.name}>
            {animation.name}
          </span>
          <span className="studio-animation-card__meta">{meta}</span>
        </span>
      </button>
      <button
        ref={popover.setAnchor}
        type="button"
        className="studio-animation-card__more"
        title={menuLabel}
        aria-label={menuLabel}
        aria-expanded={popover.isOpen}
        aria-haspopup="menu"
        onClick={popover.toggle}
      >
        <Glyph name="more" />
      </button>
      <AnchoredMenu
        anchor={popover.anchor}
        isOpen={popover.isOpen}
        role="menu"
        className="studio-chat-pop studio-chat-pop--menu"
        ariaLabel={menuLabel}
      >
        <button
          type="button"
          role="menuitem"
          className="studio-chat-pop__item"
          disabled={!viewed.bitmap}
          onClick={pick(onOpen)}
        >
          <Glyph name="expand" />
          <span>{t('studio.animation.menuOpen')}</span>
        </button>
        <button
          type="button"
          role="menuitem"
          className="studio-chat-pop__item"
          disabled={removing}
          onClick={pick(onRename)}
        >
          <Glyph name="text-mark" />
          <span>{t('studio.animation.menuRename')}</span>
        </button>
        <button
          type="button"
          role="menuitem"
          className="studio-chat-pop__item"
          onClick={pick(onShow)}
        >
          <Glyph name="folder" />
          <span>{t('studio.animation.menuShow')}</span>
        </button>
        <div className="studio-chat-pop__rule" role="none" />
        <button
          type="button"
          role="menuitem"
          className="studio-chat-pop__item"
          disabled={removing}
          onClick={pick(onDelete)}
        >
          <Glyph name="delete" />
          <span>{t('studio.animation.menuDelete')}</span>
        </button>
      </AnchoredMenu>
    </li>
  );
}
