/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import '../styles/StudioAsk.scss';

/**
 * How to get another picture or animation: ask the chat, with an example in
 * the member's own words. A list item, because it closes a list of what the
 * scene already has.
 */
export default function StudioAskCard({
  title,
  example,
}: {
  title: string;
  example: string;
}) {
  return (
    <li className="studio-ask">
      <span className="studio-ask__title">{title}</span>
      <span className="studio-ask__text">{example}</span>
    </li>
  );
}
