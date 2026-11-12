/* FluidEQ — GPL-3.0-or-later */

import { useEffect, useState } from 'react';
import type { ISignedEditionStatus } from 'common/signedEdition';
import { useAccount } from '../account/accountStore';

/**
 * What this copy and this account are to the Signed Edition, asked again
 * whenever somebody signs in or out. Undefined until the first answer: a
 * place that looks different for each edition draws nothing before it, never
 * a guess.
 */
export const useSignedEdition = (): ISignedEditionStatus | undefined => {
  const account = useAccount();
  const who = account.status === 'signed-in' ? account.identity?.id : undefined;
  const [status, setStatus] = useState<ISignedEditionStatus>();

  useEffect(() => {
    let current = true;
    const asked = window.electron?.ipcRenderer?.signedEditionStatus?.();
    asked
      ?.then((next) => {
        if (current) {
          setStatus(next);
        }
        return undefined;
      })
      .catch(() => undefined);
    return () => {
      current = false;
    };
  }, [who]);

  return status;
};

/** A signed copy with no owning account signed in: it works, and gets no updates. */
export const isUnactivated = (status: ISignedEditionStatus | undefined) =>
  status !== undefined &&
  status.signedCopy &&
  (status.account === 'signed-out' || status.account === 'not-owned');
