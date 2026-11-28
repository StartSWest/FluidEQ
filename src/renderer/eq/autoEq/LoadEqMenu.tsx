/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import Chevron from '../../icons/Chevron';
import MenuIcon from '../../icons/MenuIcon';
import TextInput from '../../widgets/TextInput';
import AnimatedHeight from '../../widgets/AnimatedHeight';
import AnchoredMenu from '../../widgets/AnchoredMenu';
import { viewClass } from '../../utils/viewStep';
import useHasChanged from '../../utils/useHasChanged';
import { useTranslation } from '../../utils/I18nContext';
import { putOnSavedEq } from '../../audio/savedEqActions';
import AutoEqMiniCurve from './AutoEqMiniCurve';
import AutoEqEqList from './AutoEqEqList';
import { orderSavedEqs, rowStateOf } from './savedEqOrder';
import useSavedEqMenu from './useSavedEqMenu';
import useSavedEqOn from './useSavedEqOn';

/** The menu lists this many; Manage has the rest. */
const SHOWN = 5;

/**
 * The name of the saved EQ that is on, and the one place a saved EQ is loaded
 * from (Ivan, 2026-11-27, option A: "how we load one??"). It used to share the
 * disk's menu, where a press on a saved EQ loaded it under an icon that says
 * save. Every row here loads — the one on, changed since, goes back to how it
 * was saved — and Manage saved EQs… opens every one of them, with the panel's
 * own rows, in the menu itself. Nothing in this menu writes a saved EQ but
 * Manage's own Replace, which asks first.
 */
const LoadEqMenu = () => {
  const { t } = useTranslation();
  const { eqs, live, states, on, isChanged } = useSavedEqOn();
  const menu = useSavedEqMenu<'list' | 'manage'>('list');

  // The face names the saved EQ that is on (Ivan, 2026-11-20: "aqui debe
  // decir el EQ que esta cargado"), and says Saved EQs while none is. The
  // whole of it in the tooltip, for a long name cut short and for the row
  // down to glyphs; Changed is the disk's amber dot beside it.
  let label = t('eq.tools.loadEq');
  if (on) {
    label = isChanged
      ? t('eq.tools.loadEqChanged', { name: on.name })
      : t('eq.tools.loadEqOn', { name: on.name });
  }
  const faceSwap = useHasChanged(on?.id ?? '') ? ' is-swap' : '';
  const shown = orderSavedEqs(eqs, states).slice(0, SHOWN);

  return (
    <>
      <button
        ref={menu.setAnchor}
        type="button"
        className={`button small subtle eq-load-trigger${faceSwap}`}
        title={label}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={menu.isOpen}
        onClick={() => menu.toggle()}
      >
        <MenuIcon name="openEq" className="eq-toolbar__icon" />
        {/* Hidden, never removed, where the row is down to glyphs. */}
        <span
          key={on?.id ?? 'none'}
          className="eq-toolbar__word eq-load-trigger__name"
          aria-hidden="true"
        >
          {on ? on.name : t('autoEq.eqs.title')}
        </span>
        <Chevron />
      </button>
      <AnchoredMenu
        anchor={menu.anchor}
        isOpen={menu.isOpen}
        className={`band-menu eq-saved-menu is-${menu.view}`}
        ariaLabel={t('autoEq.eqs.title')}
      >
        <AnimatedHeight className="eq-saved-menu__body">
          {menu.view === 'manage' && (
            <div
              className={`eq-saved-menu__form eq-saved-menu__manage ${viewClass(menu.step)}`}
            >
              <div className="eq-saved-menu__head">
                <button
                  type="button"
                  className="button small subtle eq-saved-menu__back"
                  aria-label={t('autoEq.manage.back')}
                  title={t('autoEq.manage.back')}
                  onClick={() => menu.go('list')}
                >
                  <MenuIcon name="back" />
                </button>
                <p className="band-menu__subject">{t('autoEq.eqs.title')}</p>
              </div>
              <TextInput
                value={menu.search}
                ariaLabel={t('autoEq.eqs.search')}
                placeholder={t('autoEq.eqs.search')}
                isDisabled={false}
                errorMessage=""
                handleChange={menu.setSearch}
                handleSubmit={menu.setSearch}
              />
              <AutoEqEqList search={menu.search} />
            </div>
          )}
          {menu.view === 'list' && (
            <div className={`eq-saved-menu__list ${viewClass(menu.step)}`}>
              <p className="band-menu__subject">{t('eq.tools.loadEq')}</p>
              {shown.length === 0 && (
                <p className="eq-saved-menu__empty">{t('autoEq.eqs.empty')}</p>
              )}
              {shown.map((eq) => {
                const state = rowStateOf(eq, states);
                return (
                  <button
                    key={eq.id}
                    type="button"
                    role="menuitem"
                    className="eq-saved-menu__eq"
                    aria-label={
                      state === 'changed'
                        ? t('autoEq.eqs.reloadNamed', { name: eq.name })
                        : t('autoEq.eqs.loadNamed', { name: eq.name })
                    }
                    disabled={!live}
                    onClick={() => {
                      menu.close();
                      putOnSavedEq(eq);
                    }}
                  >
                    <AutoEqMiniCurve
                      filters={eq.sound.filters}
                      width={44}
                      height={18}
                      className="eq-saved-menu__curve"
                    />
                    <span className="eq-saved-menu__name">{eq.name}</span>
                    <span className="eq-saved-menu__end">
                      {state === 'playing' && (
                        <span className="eq-auto-eq__tag is-playing">
                          {t('autoEq.eqs.playing')}
                        </span>
                      )}
                      {state === 'changed' && (
                        <span className="eq-auto-eq__tag is-changed">
                          {t('autoEq.state.changed')}
                        </span>
                      )}
                      {state !== 'playing' && (
                        <span className="eq-saved-menu__verb">
                          {state === 'changed'
                            ? t('autoEq.eqs.reload')
                            : t('autoEq.eqs.load')}
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
              <span className="band-menu__rule" role="separator" />
              <button
                type="button"
                role="menuitem"
                onClick={() => menu.go('manage')}
              >
                <MenuIcon name="settings" className="band-menu__icon" />
                <span>{t('autoEq.eqs.manageAll')}</span>
              </button>
            </div>
          )}
        </AnimatedHeight>
      </AnchoredMenu>
    </>
  );
};

export default LoadEqMenu;
