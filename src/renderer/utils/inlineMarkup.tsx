/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { Fragment } from 'react';

/**
 * A line of text with its bold runs and inline code drawn: `**bold**` and
 * `` `code` ``, the two things the changelog and a translated sentence with
 * a name in it actually use. Everything else is left as written, which for
 * prose is the right answer anyway.
 *
 * Just enough Markdown for text whose shape we control. A Markdown library
 * would be a dependency and a bundle's worth of parser for it; if a table or
 * a nested list is ever needed, that is the moment to reconsider.
 */
const renderInline = (text: string, keyPrefix: string) =>
  text
    .split(/(\*\*[^*]+\*\*|`[^`]+`)/g)
    .filter(Boolean)
    .map((part, index) => {
      const key = `${keyPrefix}-${index}`;
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={key}>{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return <code key={key}>{part.slice(1, -1)}</code>;
      }
      return <Fragment key={key}>{part}</Fragment>;
    });

export default renderInline;
