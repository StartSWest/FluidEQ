/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { ReactNode } from 'react';
import {
  FluidEqProviderWrapper,
  IFluidEqContext,
} from '../../renderer/utils/FluidEqContext';
import defaultFluidEqContext from './mockFluidEqProvider';

/**
 * The app's context around a hook under test, as the window gives it — for
 * `renderHook`'s `wrapper`, which a hook that reads app state needs as much
 * as a component does.
 */
const FluidEqTestProvider = ({
  children,
  value = defaultFluidEqContext,
}: {
  children: ReactNode;
  value?: IFluidEqContext;
}) => <FluidEqProviderWrapper value={value}>{children}</FluidEqProviderWrapper>;

export default FluidEqTestProvider;
