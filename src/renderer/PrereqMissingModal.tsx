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

import { useEffect, useState } from 'react';
import Button from './widgets/Button';
import { installEqualizerApo } from './utils/equalizerApi';
import './styles/Modal.scss';

/**
 * Only reached if the bundled installer is missing from the build, which is
 * a broken build rather than a normal state. Kept so the dialog still has
 * something to offer instead of a dead button.
 */
const EQUALIZER_APO_OFFICIAL_DOWNLOAD =
  'https://sourceforge.net/projects/equalizerapo/files/latest/download';

interface IPrereqMissingModalProps {
  isLoading: boolean;
  errorMsg: string;
  actionMsg: string;
  onRetry: () => void;
}

export default function PrereqMissingModal({
  isLoading,
  errorMsg,
  actionMsg,
  onRetry,
}: IPrereqMissingModalProps) {
  const [isDismissed, setIsDismissed] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [startError, setStartError] = useState<string>();

  useEffect(() => setIsDismissed(false), [actionMsg, errorMsg]);

  // Opens the copy that shipped inside FluidEQ's own installer. It is already
  // on disk; there is nothing to download and nowhere to go.
  const handleInstall = async () => {
    setIsStarting(true);
    setStartError(undefined);
    try {
      await installEqualizerApo();
    } catch (e) {
      // A build without the bundled file is the only way here. Say so, and
      // leave the official project as the way out rather than a dead end.
      setStartError(
        'The bundled installer could not be started. Get Equalizer APO from the official project instead.',
      );
      window.open(EQUALIZER_APO_OFFICIAL_DOWNLOAD, '_blank', 'noopener');
    } finally {
      setIsStarting(false);
    }
  };

  if (isDismissed) {
    return null;
  }

  return (
    <aside className="prereq-notice" role="alert">
      <div className="prereq-notice__copy">
        <h2>Equalizer APO needs attention</h2>
        <p>
          {errorMsg} {actionMsg}
        </p>
        <p className="dependency-credit">
          {startError ??
            'Equalizer APO is included with FluidEQ — nothing will be downloaded. Its setup will ask which audio devices to equalise, and for a restart afterwards. Separate GPLv2 project by Jonas Thedering, bundled unchanged.'}
        </p>
      </div>
      <div className="prereq-notice__actions">
        <Button
          ariaLabel="Run the bundled Equalizer APO installer"
          isDisabled={isLoading || isStarting}
          className="default"
          handleChange={handleInstall}
        >
          {isStarting ? 'Starting…' : 'Install APO'}
        </Button>
        <Button
          ariaLabel="Retry after installation"
          isDisabled={isLoading}
          className="default"
          handleChange={onRetry}
        >
          Retry
        </Button>
        <Button
          ariaLabel="Dismiss Equalizer APO warning"
          isDisabled={false}
          className="default"
          handleChange={() => setIsDismissed(true)}
        >
          Dismiss
        </Button>
      </div>
    </aside>
  );
}
