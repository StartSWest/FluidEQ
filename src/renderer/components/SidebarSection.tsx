/*
<AQUA: System-wide parametric audio equalizer interface>
Copyright (C) <2023>  <AQUA Dev Team>

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
  /** Optional status pill on the right of the header. */
  badge?: ReactNode;
  children: ReactNode;
}

/**
 * One section of the output sidebar.
 *
 * The three sections — the output, what you listen on, and your saved sound —
 * were each built by hand and drifted: different headings, different padding,
 * one with no title at all. This gives them a single shape and lets any of
 * them fold away, because on a short window all three at once do not fit and
 * the one you are not using should be the one that gives up its room.
 *
 * Open by default. Collapsing is for reclaiming space, not a setting to
 * discover, so nothing is hidden until the user chooses to hide it.
 */
export default function SidebarSection({
  eyebrow,
  title,
  badge,
  children,
}: ISidebarSectionProps) {
  const [isOpen, setIsOpen] = useState(true);
  const contentId = useId();

  return (
    <section className={`sidebar-section${isOpen ? ' is-open' : ''}`}>
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
        {badge}
        <svg
          className="sidebar-section__chevron"
          viewBox="0 0 24 24"
          aria-hidden="true"
          focusable="false"
        >
          <path
            d="M6 9l6 6 6-6"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {/* The 0fr to 1fr grid row is the one height transition that does not
          need a measured pixel value, so the content can be any size and the
          animation still runs. */}
      <div className="sidebar-section__reveal" id={contentId}>
        <div className="sidebar-section__body">{children}</div>
      </div>
    </section>
  );
}
