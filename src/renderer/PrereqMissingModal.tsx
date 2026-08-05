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
import { APO_BUNDLE_MISSING } from 'common/constants';
import Button from './widgets/Button';
import { installEqualizerApo } from './utils/equalizerApi';
import './styles/Modal.scss';

/**
 * Reached only when this build genuinely has no copy of the installer in it —
 * see the handler below, which is careful to tell that apart from somebody
 * declining the permission prompt. Sending a user to a website to download
 * something already sitting in their install directory is the exact trip the
 * bundling removed.
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
      // Only one failure justifies sending somebody to a website: this build
      // genuinely has no copy of the installer in it, which is a broken build
      // rather than anything they did.
      //
      // Every other failure — declining the permission prompt, above all —
      // means the installer is sitting right there and the answer is to press
      // the button again. Opening SourceForge for that would be telling them
      // to go and download something they already have, which is exactly the
      // trip this feature exists to remove.
      const isMissing = String((e as Error)?.message ?? '').includes(
        APO_BUNDLE_MISSING,
      );
      if (isMissing) {
        setStartError(
          'This build is missing its copy of Equalizer APO. Opening the official project instead.',
        );
        window.open(EQUALIZER_APO_OFFICIAL_DOWNLOAD, '_blank', 'noopener');
      } else {
        setStartError(
          'Equalizer APO did not start — administrator permission is needed. Try again and approve the Windows prompt.',
        );
      }
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
