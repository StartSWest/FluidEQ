/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useState } from 'react';
import type { TLibraryPlanId } from 'common/subscription';
import GetPlusDialog from './GetPlusDialog';
import PlusMark from './PlusMark';

interface IGetPlusButtonProps {
  /** What it says: Get Plus, or Get Plus again after it ended. */
  label: string;
  /** The app's own button classes, loud or quiet as the place recommends. */
  className: string;
  /** The plan the sheet starts on, for a press on one plan's price. */
  plan?: TLibraryPlanId;
}

/** A way into the Get Plus sheet, wherever Scenes offers Plus. */
export default function GetPlusButton({
  label,
  className,
  plan,
}: IGetPlusButtonProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className={`${className} plus-get`}
        onClick={() => setOpen(true)}
      >
        <PlusMark />
        {label}
      </button>
      {open && <GetPlusDialog plan={plan} onClose={() => setOpen(false)} />}
    </>
  );
}
