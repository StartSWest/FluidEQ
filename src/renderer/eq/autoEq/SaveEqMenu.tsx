/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useState } from 'react';
import log from 'electron-log/renderer';
import MenuIcon from '../../icons/MenuIcon';
import AnimatedHeight from '../../widgets/AnimatedHeight';
import AnchoredMenu from '../../widgets/AnchoredMenu';
import { viewClass } from '../../utils/viewStep';
import { useTranslation } from '../../utils/I18nContext';
import {
  undoSaveOver,
  updateSavedEqWithLive,
  useSaveOverUndo,
} from '../../audio/savedEqActions';
import AutoEqSaveEqForm from './AutoEqSaveEqForm';
import useSavedEqMenu from './useSavedEqMenu';
import useSavedEqOn, { usedOf } from './useSavedEqOn';

/**
 * The disk, in the bands toolbar after the saved EQ's name (Ivan, 2026-11-27,
 * option A: "the user should be update that one not load that one"). Every
 * entry under it saves; loading is the name's (`LoadEqMenu`). Save changes
 * writes what plays over the saved EQ that is on, says who follows it, and
 * leaves the menu open on the saved row with Undo, which stays until what
 * plays moves again; Save as new EQ… opens the panel's own form in the menu's
 * place. With no saved EQ on there is nothing to save over, and the disk opens
 * straight on the form. Changed is the amber dot on the glyph, which stays
 * when the row is down to glyphs.
 */
const SaveEqMenu = () => {
  const { t } = useTranslation();
  const { eqs, live, on, isChanged } = useSavedEqOn();
  const menu = useSavedEqMenu<'menu' | 'form'>('menu');
  const undo = useSaveOverUndo(on?.id);
  const [isSaving, setIsSaving] = useState(false);

  const label =
    on && isChanged
      ? t('autoEq.eqs.saveChangesNamed', { name: on.name })
      : t('eq.tools.saveEq');
  const used = on ? usedOf(on, t) : '';
  const usedLine = used !== '' && (
    <span className="eq-saved-menu__sub">
      {t('autoEq.eqs.usedByWhat', { what: used })}
    </span>
  );

  const saveChanges = () => {
    if (!on) {
      return;
    }
    setIsSaving(true);
    updateSavedEqWithLive(on)
      .catch((error: unknown) =>
        log.error('A saved EQ could not be updated', error),
      )
      .finally(() => setIsSaving(false));
  };

  // The saved EQ that is on: Save changes while what plays has moved off it,
  // and once it is saved the same row says so, with Undo while it can be.
  // Each of the two rows holds the other's sentence and end unseen, so both
  // are the height of the taller in every language and the menu does not
  // move when the save lands: "Save changes to …" took a line more than
  // "… is saved" in German, French and Russian.
  let onRow = null;
  if (on) {
    const isSave = isChanged && !undo;
    const reserved = (isShown: boolean) =>
      isShown ? undefined : 'is-reserved';
    const undoWords = (
      <>
        <MenuIcon name="reset" />
        {t('autoEq.eqs.undo')}
      </>
    );
    const words = (
      <span className="eq-saved-menu__words">
        <span className="eq-saved-menu__stack">
          <span className={reserved(isSave)} aria-hidden={!isSave}>
            {t('autoEq.eqs.saveChangesNamed', { name: on.name })}
          </span>
          <span className={reserved(!isSave)} aria-hidden={isSave}>
            {t('autoEq.eqs.savedNamed', { name: on.name })}
          </span>
        </span>
        {usedLine}
      </span>
    );
    const end = (
      <span className="eq-saved-menu__stack is-end">
        <span
          className={['eq-auto-eq__tag is-changed', reserved(isSave)]
            .filter(Boolean)
            .join(' ')}
          aria-hidden={!isSave}
        >
          {t('autoEq.state.changed')}
        </span>
        {!isSave && undo ? (
          <button
            type="button"
            role="menuitem"
            className="button small subtle eq-saved-menu__undo"
            aria-label={t('autoEq.eqs.undoNamed', { name: on.name })}
            onClick={() => {
              undoSaveOver().catch((error: unknown) =>
                log.error('A save over a saved EQ could not be undone', error),
              );
            }}
          >
            {undoWords}
          </button>
        ) : (
          // Its room alone, never pressable: a span drawn as the button.
          <span
            className="button small subtle eq-saved-menu__undo is-reserved"
            aria-hidden="true"
          >
            {undoWords}
          </span>
        )}
      </span>
    );
    onRow = isSave ? (
      <button
        type="button"
        role="menuitem"
        className="eq-saved-menu__save"
        disabled={!live || isSaving}
        onClick={saveChanges}
      >
        <MenuIcon name="saveEq" className="band-menu__icon" />
        {words}
        {end}
      </button>
    ) : (
      <div className="eq-saved-menu__save is-saved" role="none">
        <MenuIcon name="check" className="band-menu__icon" />
        {words}
        {end}
      </div>
    );
  }

  return (
    <>
      <button
        ref={menu.setAnchor}
        type="button"
        className="button small subtle eq-save-trigger"
        title={label}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={menu.isOpen}
        // Nothing on to save over: the name is the whole of what is asked.
        onClick={() => menu.toggle(!on && live ? 'form' : 'menu')}
      >
        <span className="eq-save-trigger__glyph">
          <MenuIcon name="saveEq" className="eq-toolbar__icon" />
          {isChanged && (
            <span className="eq-save-trigger__changed" aria-hidden="true" />
          )}
        </span>
      </button>
      <AnchoredMenu
        anchor={menu.anchor}
        isOpen={menu.isOpen}
        className={`band-menu eq-saved-menu is-${menu.view}`}
        ariaLabel={t('eq.tools.saveEq')}
      >
        <AnimatedHeight className="eq-saved-menu__body">
          {menu.view === 'form' && (
            <div className={`eq-saved-menu__form ${viewClass(menu.step)}`}>
              <p className="band-menu__subject">{t('autoEq.eqs.saveThis')}</p>
              <AutoEqSaveEqForm
                suggestedName={t('autoEq.eqs.defaultName', {
                  count: eqs.length + 1,
                })}
                onCancel={
                  menu.root === 'form' ? menu.close : () => menu.go('menu')
                }
                onSaved={menu.close}
              />
            </div>
          )}
          {menu.view === 'menu' && (
            <div className={`eq-saved-menu__list ${viewClass(menu.step)}`}>
              <p className="band-menu__subject">{t('eq.tools.saveEq')}</p>
              {onRow}
              <button
                type="button"
                role="menuitem"
                disabled={!live}
                onClick={() => menu.go('form')}
              >
                <MenuIcon name="plus" className="band-menu__icon" />
                <span>{t('autoEq.eqs.saveNew')}</span>
              </button>
            </div>
          )}
        </AnimatedHeight>
      </AnchoredMenu>
    </>
  );
};

export default SaveEqMenu;
