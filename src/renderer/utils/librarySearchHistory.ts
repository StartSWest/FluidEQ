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

import { createSearchHistoryStore } from './searchHistoryStore';

/**
 * What has been searched for in the Library.
 *
 * Its own key, not the Media tab's: the two are different lists about
 * different things, and suggesting somebody's web searches inside their own
 * music collection — or the reverse — would be a small but real leak between
 * two unrelated features. See `searchHistoryStore` for the rest.
 */
export const librarySearchHistory = createSearchHistoryStore(
  'fluideq.librarySearchHistory',
);
