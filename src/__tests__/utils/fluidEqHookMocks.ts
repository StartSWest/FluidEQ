/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The equaliser context's three hooks, all answering from one fake.
 *
 * A component reads the narrowest of `useFluidEqShell`, `useFluidEqLayers`
 * and `useFluidEqContext` that has what it uses (`FluidEqContext.tsx`), so a
 * module mock that replaced only the last one left the other two looking for
 * a provider that the mock was standing in for. For a `jest.mock` factory:
 *
 *   ...jest.requireActual('__tests__/utils/fluidEqHookMocks').eqHooksFrom(
 *     () => ({ isEnabled: true }),
 *   ),
 */
export const eqHooksFrom = <State>(state: () => State) => ({
  useFluidEqContext: state,
  useFluidEqShell: state,
  useFluidEqLayers: state,
});

export default eqHooksFrom;
