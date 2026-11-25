/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import DialogFrame from '../../components/DialogFrame';
import MenuIcon from '../../icons/MenuIcon';
import { useTranslation } from '../../utils/I18nContext';
import '../../styles/AudioEngineDialog.scss';

/**
 * The engine dialog, for the engine chapter (`helpChapters/engine.ts`): the
 * FluidEQ Engine recommended and chosen, Equalizer APO beside it on a machine
 * that has it, and the engine now in use at the foot.
 *
 * The frame is the app's own `DialogFrame`; inside it is
 * `AudioEngineDialog`'s markup, class for class: the real dialog reads the
 * reader's engines, portals over the window and installs on Apply.
 */

const nothing = () => undefined;

/** The dialog's width over a wide window. */
const DIALOG_WIDTH = 620;

const Mark = ({ kind }: { kind: 'yes' | 'no' }) => (
  <svg
    className={`engine-dialog__mark engine-dialog__mark--${kind}`}
    viewBox="0 0 14 14"
    aria-hidden="true"
  >
    {kind === 'yes' ? (
      <path d="M2.6 7.3l2.9 2.9L11.4 4" />
    ) : (
      <path d="M3.2 7h7.6" />
    )}
  </svg>
);

const Option = ({
  name,
  lines,
  isChecked,
  recommended,
}: {
  name: string;
  lines: readonly (readonly [string, 'yes' | 'no'])[];
  isChecked: boolean;
  recommended?: string;
}) => (
  <div role="radio" aria-checked={isChecked} className="engine-dialog__option">
    <span className="engine-dialog__radio" aria-hidden="true" />
    <div className="engine-dialog__option-body">
      <div className="engine-dialog__option-head">
        <span className="engine-dialog__name">{name}</span>
        {recommended && (
          <span className="engine-dialog__recommended">{recommended}</span>
        )}
      </div>
      <ul className="engine-dialog__lines">
        {lines.map(([text, kind]) => (
          <li
            key={text}
            className={`engine-dialog__line engine-dialog__line--${kind}`}
          >
            <Mark kind={kind} />
            <span>{text}</span>
          </li>
        ))}
      </ul>
    </div>
  </div>
);

export default function EngineDialogDrawing() {
  const { t } = useTranslation();
  return (
    <div style={{ width: DIALOG_WIDTH }}>
      <DialogFrame
        className="engine-dialog"
        icon={<MenuIcon name="configure" />}
        title={t('engine.title')}
        titleId="help-engine-dialog-title"
        description={t('engine.subtitle')}
        closeLabel={t('engine.close')}
        onClose={nothing}
        footer={
          <>
            <p className="dialog-frame__note engine-dialog__now">
              {t('engine.now', { engine: t('engine.fluid.name') })}
            </p>
            <div className="dialog-frame__actions">
              <button type="button" className="button small subtle">
                {t('engine.cancel')}
              </button>
              <button type="button" className="button small" disabled>
                {t('engine.apply')}
              </button>
            </div>
          </>
        }
      >
        <div role="radiogroup" className="engine-dialog__options">
          <Option
            name={t('engine.fluid.name')}
            recommended={t('engine.recommended')}
            isChecked
            lines={[
              [t('engine.fluid.l1'), 'yes'],
              [t('engine.fluid.l2'), 'yes'],
              [t('engine.fluid.l4'), 'yes'],
              [t('engine.fluid.l3'), 'no'],
            ]}
          />
          <Option
            name={t('engine.apo.name')}
            isChecked={false}
            lines={[
              [t('engine.apo.l1'), 'yes'],
              [t('engine.apo.l2'), 'no'],
              [t('engine.apo.l3'), 'no'],
            ]}
          />
        </div>
      </DialogFrame>
    </div>
  );
}
