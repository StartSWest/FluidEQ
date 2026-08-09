/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import { TranslationKey } from 'common/i18n';
import AutoEQ from './AutoEQ';
import { useTranslation } from './utils/I18nContext';
import './styles/AutoEQPanel.scss';

/**
 * The three pickers, explained in the order they are asked.
 *
 * Titled with the same keys the pickers themselves carry, deliberately: a note
 * about "the measurement source" that does not use the words written above the
 * control is a note about something else as far as the reader is concerned, and
 * it would drift the first time either was reworded.
 */
const GUIDE: { title: TranslationKey; hint: TranslationKey }[] = [
  { title: 'autoeq.source', hint: 'autoeq.source.hint' },
  { title: 'autoeq.model', hint: 'autoeq.model.hint' },
  { title: 'autoeq.target', hint: 'autoeq.target.hint' },
];

/**
 * The page the reference picker lives on.
 *
 * It is a page rather than a component with a heading because the picker had
 * been a strip across the top of the EQ tab, where it was three combo boxes and
 * a button with no room to say what any of them were for — and every band below
 * it paid for the height. Here it has the tab to itself: what is applied is
 * stated first, the pickers get a line of their own, and what to put in each of
 * them is written underneath instead of being folded away.
 *
 * `AutoEQ` is rendered untouched. This page styles around it — see
 * AutoEQPanel.scss, which stands the collapsible down since a fold control on a
 * tab of its own can only empty the page.
 */
const AutoEQPanel = () => {
  const { t } = useTranslation();

  return (
    <section className="autoeq-panel" aria-labelledby="autoeq-panel-title">
      <div className="autoeq-panel__intro">
        <p className="eyebrow">{t('autoeq.page.eyebrow')}</p>
        <h2 id="autoeq-panel-title">{t('autoeq.page.title')}</h2>
        <p>{t('autoeq.page.intro')}</p>
      </div>

      <div className="autoeq-panel__picker">
        <AutoEQ />
      </div>

      <div className="autoeq-panel__guide">
        {GUIDE.map((step, index) => (
          <article className="autoeq-guide" key={step.title}>
            {/* Decorative. The order is already carried by the reading order
                and by the pickers above, so a screen reader counting to three
                would only be repeating itself. */}
            <span className="autoeq-guide__step" aria-hidden="true">
              {index + 1}
            </span>
            <strong>{t(step.title)}</strong>
            <p>{t(step.hint)}</p>
          </article>
        ))}
      </div>
    </section>
  );
};

export default AutoEQPanel;
