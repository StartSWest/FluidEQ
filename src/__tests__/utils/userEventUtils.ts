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

import '@testing-library/jest-dom';
import { render, type RenderResult } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';

// Annotated rather than inferred. `RenderResult` reaches into pretty-format
// for `PrettyFormatOptions`, which the compiler cannot name from here while
// emitting declarations, so inferring this type fails outright — naming it
// spares the compiler the trip.
export const setup = (
  jsx: React.ReactElement<
    unknown,
    string | React.JSXElementConstructor<unknown>
  >,
): RenderResult & { user: UserEvent } => {
  return {
    user: userEvent.setup(),
    ...render(jsx),
  };
};

export const clearAndType = async (
  user: UserEvent,
  element: Element,
  text: string,
  options?: Parameters<UserEvent['type']>[2],
) => {
  await user.clear(element);
  return user.type(element, text, options);
};
