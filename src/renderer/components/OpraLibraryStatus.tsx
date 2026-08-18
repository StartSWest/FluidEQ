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

import { useEffect, useState } from 'react';
import { ErrorDescription } from 'common/errors';
import { IOpraUpdateStatus } from 'common/constants';
import { useFluidEqContext } from '../utils/FluidEqContext';
import { useTranslation } from '../utils/I18nContext';
import Button from '../widgets/Button';
import { checkOpraUpdate, updateOpraDatabase } from '../utils/equalizerApi';
import '../styles/AutoEQ.scss';

/**
 * Fires when the library on disk has been replaced, so the picker rereads it.
 *
 * A window event rather than a prop: the status sits in the page heading and
 * the picker is a card further down, and threading a callback between them
 * through the page would make the page own a concern neither half is asking it
 * to hold.
 */
export const OPRA_UPDATED_EVENT = 'fluideq-opra-updated';

/**
 * How current the bundled OPRA library is, and the button that refreshes it.
 *
 * Lives in the page heading rather than at the foot of the picker: it describes
 * the whole library, not the curve being chosen, and at the bottom of the card
 * it read as a footnote to the pickers above it.
 */
export default function OpraLibraryStatus() {
  const { setGlobalError } = useFluidEqContext();
  const { t } = useTranslation();
  const [status, setStatus] = useState<IOpraUpdateStatus>();
  const [isChecking, setIsChecking] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    checkOpraUpdate()
      .then(setStatus)
      .catch(() => setStatus(undefined))
      .finally(() => setIsChecking(false));
  }, []);

  useEffect(() => {
    const unsubscribe = window.electron.ipcRenderer.on(
      'databases-synced',
      (...args: unknown[]) => {
        const result = args[0] as { opra?: IOpraUpdateStatus } | undefined;
        if (result?.opra) {
          setStatus(result.opra);
          setIsChecking(false);
        }
      },
    );
    return () => {
      unsubscribe();
    };
  }, []);

  const update = async () => {
    setIsUpdating(true);
    try {
      setStatus(await updateOpraDatabase());
      window.dispatchEvent(new Event(OPRA_UPDATED_EVENT));
    } catch (error) {
      setGlobalError(error as ErrorDescription);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="autoeq-update">
      <span>
        {isChecking && t('autoeq.checking')}
        {!isChecking &&
          status?.updateAvailable &&
          t('autoeq.updateAvailable', {
            count: status.latest?.productCount.toLocaleString() ?? '',
          })}
        {!isChecking &&
          status &&
          !status.updateAvailable &&
          t('autoeq.upToDate', {
            count: status.current.productCount.toLocaleString(),
          })}
        {!isChecking && !status && t('autoeq.updateUnknown')}
      </span>
      {status?.updateAvailable && (
        <Button
          className="small"
          ariaLabel={t('autoeq.updateAria')}
          isDisabled={isUpdating}
          handleChange={update}
        >
          {isUpdating ? t('autoeq.updating') : t('autoeq.update')}
        </Button>
      )}
    </div>
  );
}
