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
import './styles/Modal.scss';

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

  useEffect(() => setIsDismissed(false), [actionMsg, errorMsg]);

  const handleInstall = () => {
    window.open(EQUALIZER_APO_OFFICIAL_DOWNLOAD, '_blank', 'noopener');
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
          Separate GPLv2 project by Jonas Thedering. The installer comes
          unchanged from the official SourceForge project.
        </p>
      </div>
      <div className="prereq-notice__actions">
        <Button
          ariaLabel="Download official Equalizer APO installer"
          isDisabled={isLoading}
          className="default"
          handleChange={handleInstall}
        >
          Install APO
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
