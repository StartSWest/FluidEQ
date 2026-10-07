import {
  type ReactNode,
  type RefObject,
  useEffect,
  useRef,
  useState,
} from 'react';
import EqModeIcon from '../icons/EqModeIcon';
import { useTranslation } from '../utils/I18nContext';
import AnchoredMenu from '../widgets/AnchoredMenu';
import MenuIcon from '../icons/MenuIcon';
import Chevron from '../icons/Chevron';
// The segmented track every closed set of choices in the app is drawn on.
import '../styles/Dsp.scss';
import '../styles/EqModeSelect.scss';
import { EqModeReset, EqModeRows } from './eqMode/EqModeRows';
import EqModeTriggerFace from './eqMode/EqModeTriggerFace';
import useEqModeChoices, { EQ_MODE_SCOPES } from './eqMode/useEqModeChoices';

interface IEqModeSelectProps {
  /**
   * A control of the page's own in the menu's heading, before Reset: the EQ
   * page's pin (`EqPageModeSelect`). The amp's decks have no panel to pin
   * the menu into, and offer none.
   */
  headingAction?: ReactNode;
  /** The menu's button, for a page that hands the focus back to it. */
  triggerRef?: RefObject<HTMLButtonElement | null>;
}

export default function EqModeSelect({
  headingAction,
  triggerRef,
}: IEqModeSelectProps) {
  const { t } = useTranslation();
  const choices = useEqModeChoices();
  const [isOpen, setIsOpen] = useState(false);
  const ownAnchor = useRef<HTMLButtonElement>(null);
  const anchor = triggerRef ?? ownAnchor;
  const content = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }
    const outside = (event: Event) => {
      const target = event.target as Node;
      if (
        !anchor.current?.contains(target) &&
        !content.current?.contains(target)
      ) {
        setIsOpen(false);
      }
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setIsOpen(false);
        anchor.current?.focus();
      }
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('focusin', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('focusin', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [anchor, isOpen]);

  return (
    <div className="eq-toolbar__option" aria-busy={choices.isSaving}>
      <button
        ref={anchor}
        type="button"
        className="eq-mode-trigger"
        aria-label={t('eq.mode')}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        disabled={choices.disabled}
        onClick={() => setIsOpen((open) => !open)}
      >
        <EqModeTriggerFace customized={choices.customized} end={<Chevron />} />
      </button>
      <AnchoredMenu
        anchor={anchor.current}
        isOpen={isOpen}
        className="eq-mode-menu"
        role="dialog"
        ariaLabel={t('eq.mode')}
      >
        <div ref={content} className="eq-mode-menu__content eq-mode-choices">
          <div className="eq-mode-menu__heading">
            <span>
              <MenuIcon name="settings" />
              {t('eq.mode')}
            </span>
            <div className="eq-mode-menu__actions">
              {headingAction}
              <EqModeReset choices={choices} />
            </div>
          </div>
          <div className="eq-mode-menu__groups">
            {EQ_MODE_SCOPES.map((scope) => (
              <section className="eq-mode-menu__group" key={scope}>
                <strong className="eq-mode-menu__group-title">
                  <EqModeIcon kind={scope} />
                  {t(scope === 'eq' ? 'eq.mode.yourEq' : 'eq.mode.curves')}
                </strong>
                <EqModeRows choices={choices} scope={scope} />
              </section>
            ))}
          </div>
          <p className="eq-mode-choices__note eq-mode-menu__footer">
            {t('eq.mode.shapeHint')}
          </p>
        </div>
      </AnchoredMenu>
    </div>
  );
}
