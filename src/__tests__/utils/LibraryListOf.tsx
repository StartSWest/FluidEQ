/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { ReactNode } from 'react';
import type { ILibraryListQuery } from '../../common/library/query';
import {
  type ILibraryList,
  useLibraryList,
} from '../../renderer/library/useLibraryList';

/**
 * The list a view is handed, asked of the store the way the workspace asks
 * it (`useLibraryList`), for a view rendered on its own. Must sit inside a
 * `LibraryProvider`, like every list in the app.
 */
const LibraryListOf = ({
  query,
  children,
}: {
  query: ILibraryListQuery | undefined;
  children: (list: ILibraryList) => ReactNode;
}) => {
  const list = useLibraryList(query);
  return children(list);
};

export default LibraryListOf;
