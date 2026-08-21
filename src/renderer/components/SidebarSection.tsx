/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { ReactNode, useId, useState } from 'react';
import '../styles/SidebarSection.scss';

interface ISidebarSectionProps {
  /** Small caps line above the title. */
  eyebrow: string;
  title: string;
  /**
   * The one control that stays put when the section is folded.
   *
   * Collapsing is for hiding detail, not for hiding the thing you came to
   * change — a folded section whose picker had vanished with it would just
   * have to be unfolded again to be useful.
   */
  summary?: ReactNode;
  /** Hide the summary while expanded when it only previews folded content. */
  summaryWhenCollapsedOnly?: boolean;
  /**
   * A control of this section's that is never folded away.
   *
   * Not the same thing as `summary`, which previews what folding hid and is
   * therefore dropped once the section is open. This is a setting that lives
   * on this card, and hiding it while the card is open would be the one
   * arrangement where it is never on screen at all.
   */
  aside?: ReactNode;
  /** Extra class on the section, for callers outside the sidebar. */
  className?: string;
  /**
   * Whether it starts open. Open unless a caller says otherwise: collapsing
   * reclaims space, it is not a setting to go looking for.
   */
  defaultOpen?: boolean;
  children: ReactNode;
}

/**
 * One section of the output sidebar.
 *
 * The three sections — the output, what you listen on, and your saved sound —
 * were each built separately and had drifted: different heading markup,
 * different padding, one with no title at all. This gives them a single shape
 * and lets any of them fold away, because on a short window all three at once
 * do not fit and the one you are not using should give up its room.
 *
 * Open by default. Collapsing reclaims space; it is not a setting to discover,
 * so nothing is hidden until the user chooses to hide it.
 */
export default function SidebarSection({
  eyebrow,
  title,
  summary,
  summaryWhenCollapsedOnly = false,
  aside,
  className,
  defaultOpen = true,
  children,
}: ISidebarSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const contentId = useId();

  return (
    <section
      className={`sidebar-section${isOpen ? ' is-open' : ''}${
        className ? ` ${className}` : ''
      }`}
    >
      <button
        type="button"
        className="sidebar-section__header"
        aria-expanded={isOpen}
        aria-controls={contentId}
        onClick={() => setIsOpen((current) => !current)}
      >
        <span className="sidebar-section__heading">
          <span className="eyebrow">{eyebrow}</span>
          <span className="sidebar-section__title">{title}</span>
        </span>
        <svg
          className="sidebar-section__chevron"
          viewBox="0 0 24 24"
          aria-hidden="true"
          focusable="false"
        >
          <path
            d="M7 10l5 5 5-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {aside && <div className="sidebar-section__aside">{aside}</div>}

      {summary && (!summaryWhenCollapsedOnly || !isOpen) && (
        <div className="sidebar-section__summary">{summary}</div>
      )}

      {/* A 0fr to 1fr grid row is the one height transition that needs no
          measured pixel value, so a section can hold anything — including a
          list that grows — and still open smoothly. */}
      <div className="sidebar-section__reveal" id={contentId}>
        <div className="sidebar-section__body">{children}</div>
      </div>
    </section>
  );
}
