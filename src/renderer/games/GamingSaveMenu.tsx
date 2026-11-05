/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useRef, useState } from 'react';
import { GAMING_PROFILE_NAME_MAX } from '../../common/gaming';
import DspPresetSaveDialog from '../dsp/DspPresetSaveDialog';
import Chevron from '../icons/Chevron';
import MenuIcon from '../icons/MenuIcon';
import { useTranslation } from '../utils/I18nContext';
import AnchoredMenu from '../widgets/AnchoredMenu';

interface IGamingSaveMenuProps {
  gameName: string;
  profileName: string;
  /** One of the listener's own, which "Update" can write the copy into. */
  isYours: boolean;
  isBusy: boolean;
  onSaveNew: (name: string) => void;
  onUpdate: () => void;
  onReset: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
}

type TNaming = 'save' | 'rename';

/**
 * Everything a game's copy can be done with, behind its one button (Ivan,
 * 2026-11-02): kept as a Gaming profile of its own, written into one of the
 * listener's profiles it came from, started again from its profile, named,
 * or taken away with the game. The profile a copy came from is never what
 * any of these change, unless the listener asks for exactly that with
 * "Update".
 */
const GamingSaveMenu = ({
  gameName,
  profileName,
  isYours,
  isBusy,
  onSaveNew,
  onUpdate,
  onReset,
  onRename,
  onDelete,
}: IGamingSaveMenuProps) => {
  const { t } = useTranslation();
  const holder = useRef<HTMLSpanElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [naming, setNaming] = useState<TNaming>();

  useEffect(() => {
    if (!open) {
      return undefined;
    }
    const outside = (event: MouseEvent) => {
      if (
        !holder.current?.contains(event.target as Node) &&
        !content.current?.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented) {
        event.preventDefault();
        setOpen(false);
        holder.current?.querySelector('button')?.focus();
      }
    };
    window.addEventListener('mousedown', outside);
    window.addEventListener('keydown', escape);
    return () => {
      window.removeEventListener('mousedown', outside);
      window.removeEventListener('keydown', escape);
    };
  }, [open]);

  const choose = (action: () => void) => {
    setOpen(false);
    action();
  };

  return (
    <span ref={holder} className="gaming-save">
      <button
        type="button"
        className="button small subtle"
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={isBusy}
        onClick={() => setOpen((now) => !now)}
      >
        {t('gaming.save')}
        <Chevron />
      </button>
      <AnchoredMenu
        anchor={holder.current}
        isOpen={open}
        className="gaming-save__menu"
        ariaLabel={t('gaming.save')}
      >
        <div ref={content} className="gaming-save__items">
          <button
            type="button"
            role="menuitem"
            className="gaming-save__item"
            onClick={() => choose(() => setNaming('save'))}
          >
            <MenuIcon name="filePlus" className="gaming-save__icon" />
            <span className="gaming-save__text">
              <span className="gaming-save__label">{t('gaming.save.new')}</span>
              <span className="gaming-save__hint">
                {t('gaming.save.newHint', { game: gameName })}
              </span>
            </span>
          </button>
          {isYours && (
            <button
              type="button"
              role="menuitem"
              className="gaming-save__item"
              onClick={() => choose(onUpdate)}
            >
              <MenuIcon name="save" className="gaming-save__icon" />
              <span className="gaming-save__text">
                <span className="gaming-save__label">
                  {t('gaming.save.update', { profile: profileName })}
                </span>
                <span className="gaming-save__hint">
                  {t('gaming.save.updateHint')}
                </span>
              </span>
            </button>
          )}
          <span className="gaming-save__rule" role="separator" />
          <button
            type="button"
            role="menuitem"
            className="gaming-save__item"
            onClick={() => choose(onReset)}
          >
            <MenuIcon name="reset" className="gaming-save__icon" />
            <span className="gaming-save__text">
              <span className="gaming-save__label">
                {t('gaming.save.reset', { profile: profileName })}
              </span>
              <span className="gaming-save__hint">
                {t('gaming.save.resetHint')}
              </span>
            </span>
          </button>
          <button
            type="button"
            role="menuitem"
            className="gaming-save__item"
            onClick={() => choose(() => setNaming('rename'))}
          >
            <MenuIcon name="pencil" className="gaming-save__icon" />
            <span className="gaming-save__text">
              <span className="gaming-save__label">
                {t('gaming.save.rename')}
              </span>
            </span>
          </button>
          <button
            type="button"
            role="menuitem"
            className="gaming-save__item is-danger"
            onClick={() => choose(onDelete)}
          >
            <MenuIcon name="trash" className="gaming-save__icon" />
            <span className="gaming-save__text">
              <span className="gaming-save__label">
                {t('gaming.save.delete')}
              </span>
              <span className="gaming-save__hint">
                {t('gaming.save.deleteHint')}
              </span>
            </span>
          </button>
        </div>
      </AnchoredMenu>
      {naming === 'save' && (
        <DspPresetSaveDialog
          existing={[]}
          titleKey="gaming.saveDialog.title"
          hintKey="gaming.saveDialog.hint"
          placeholderKey="gaming.saveDialog.placeholder"
          nameMax={GAMING_PROFILE_NAME_MAX}
          onSave={(name) => {
            setNaming(undefined);
            onSaveNew(name);
          }}
          onClose={() => setNaming(undefined)}
        />
      )}
      {naming === 'rename' && (
        <DspPresetSaveDialog
          existing={[]}
          titleKey="gaming.renameDialog.title"
          hintKey="gaming.renameDialog.hint"
          placeholderKey="gaming.renameDialog.placeholder"
          nameMax={GAMING_PROFILE_NAME_MAX}
          onSave={(name) => {
            setNaming(undefined);
            onRename(name);
          }}
          onClose={() => setNaming(undefined)}
        />
      )}
    </span>
  );
};

export default GamingSaveMenu;
