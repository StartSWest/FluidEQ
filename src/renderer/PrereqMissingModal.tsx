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
  const handleClose = async () => {
    window.electron.ipcRenderer.closeApp();
  };

  const handleInstall = () => {
    window.open(EQUALIZER_APO_OFFICIAL_DOWNLOAD, '_blank', 'noopener');
  };

  return (
    <div className="modal col">
      <div className="modal-content">
        <h1 className="header">Prerequisite Missing</h1>
        <div className="body">
          <p>
            {errorMsg} {actionMsg}
          </p>
          <p className="dependency-credit">
            Equalizer APO is a separate GPLv2 project by Jonas Thedering. The
            installer is downloaded unchanged from its official SourceForge
            project.
          </p>
        </div>
        <div className="footer row">
          <Button
            ariaLabel="Exit"
            isDisabled={isLoading}
            className="default"
            handleChange={handleClose}
          >
            Exit
          </Button>
          <Button
            ariaLabel="Download official Equalizer APO installer"
            isDisabled={isLoading}
            className="default"
            handleChange={handleInstall}
          >
            Install Equalizer APO
          </Button>
          <Button
            ariaLabel="Retry after installation"
            isDisabled={isLoading}
            className="default"
            handleChange={onRetry}
          >
            I installed it — Retry
          </Button>
        </div>
      </div>
    </div>
  );
}
