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

import { useEffect, useMemo, useState } from 'react';
import { ErrorDescription } from 'common/errors';
import { IAutoEqUpdateStatus } from 'common/constants';
import { useAquaContext } from './utils/AquaContext';
import Button from './widgets/Button';
import Dropdown from './widgets/Dropdown';
import { IOptionEntry } from './widgets/List';
import './styles/AutoEQ.scss';
import {
  getAutoEqDeviceList,
  getAutoEqResponseList,
  loadAutoEqPreset,
  checkAutoEqUpdate,
  updateAutoEqDatabase,
} from './utils/equalizerApi';

const AutoEQ = () => {
  const NO_DEVICE_SELECTION = 'Pick a device first! 🎧';
  const NO_RESPONSES = 'No supported responses 😞';
  const NO_RESPONSE_SELECTION = 'Pick a response! 🔊';

  const { globalError, setGlobalError, performHealthCheck } = useAquaContext();
  const [devices, setDevices] = useState<string[]>([]);
  const [responses, setResponses] = useState<string[]>([]);
  const [currentDevice, setCurrentDevice] = useState<string>('');
  const [currentResponse, setCurrentResponse] = useState<string>('');
  const [updateStatus, setUpdateStatus] = useState<IAutoEqUpdateStatus>();
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);

  // Fetch supported devices from storage
  useEffect(() => {
    const fetchDeviceNames = async () => {
      try {
        setDevices(await getAutoEqDeviceList());
      } catch (e) {
        setGlobalError(e as ErrorDescription);
      }
    };

    fetchDeviceNames();
    checkAutoEqUpdate()
      .then(setUpdateStatus)
      .catch(() => undefined)
      .finally(() => setIsCheckingUpdate(false));
  }, [setGlobalError]);

  const refreshUpdateStatus = async () => {
    setIsCheckingUpdate(true);
    try {
      setUpdateStatus(await checkAutoEqUpdate());
    } catch {
      setUpdateStatus(undefined);
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  const updateDatabase = async () => {
    setIsUpdating(true);
    try {
      setUpdateStatus(await updateAutoEqDatabase());
      setDevices(await getAutoEqDeviceList());
      setCurrentDevice('');
      setCurrentResponse('');
      setResponses([]);
    } catch (e) {
      setGlobalError(e as ErrorDescription);
    } finally {
      setIsUpdating(false);
    }
  };

  // When user changes the current selected device, fetch the supported responses
  const handleDeviceChange = async (newValue: string) => {
    try {
      setResponses(await getAutoEqResponseList(newValue));
      setCurrentDevice(newValue);
      // Reset currentResponse to blank whenever it changes.
      setCurrentResponse('');
    } catch (e) {
      setGlobalError(e as ErrorDescription);
    }
  };

  const applyAutoEQ = async () => {
    try {
      await loadAutoEqPreset(currentDevice, currentResponse);
      performHealthCheck();
    } catch (e) {
      setGlobalError(e as ErrorDescription);
    }
  };

  const deviceOptions: IOptionEntry[] = useMemo(
    () =>
      devices.map((s) => {
        return {
          value: s,
          label: s,
          display: <div>{s}</div>,
        };
      }),
    [devices],
  );

  const responseOptions: IOptionEntry[] = useMemo(
    () =>
      responses.map((s) => {
        return {
          value: s,
          label: s,
          display: <div>{s}</div>,
        };
      }),
    [responses],
  );

  return (
    <>
      <div className="section-heading auto-eq-title">
        <div>
          <span className="eyebrow">START FROM A REFERENCE</span>
          <h4>AutoEQ library</h4>
        </div>
        <span>Community measurements</span>
      </div>
      <div className="auto-eq">
        <div className="autoeq-field autoeq-field--model">
          <span>Headphone model</span>
          <Dropdown
            name="Audio Device"
            options={deviceOptions}
            value={currentDevice}
            handleChange={handleDeviceChange}
            isDisabled={!!globalError}
            noSelectionPlaceholder={NO_DEVICE_SELECTION}
            emptyOptionsPlaceholder="No measured model matches your search."
            filterPlaceholder="Search by brand or model..."
            isFilterable
          />
        </div>
        <div className="autoeq-field">
          <span>Measurement / target</span>
          <Dropdown
            name="Target Frequency Response"
            options={responseOptions}
            value={currentResponse}
            handleChange={(newValue) => setCurrentResponse(newValue)}
            isDisabled={!!globalError || responses.length === 0}
            emptyOptionsPlaceholder={NO_RESPONSES}
            noSelectionPlaceholder={NO_RESPONSE_SELECTION}
          />
        </div>
        <Button
          className="small"
          ariaLabel="Apply Auto EQ"
          isDisabled={
            !!globalError || currentDevice === '' || currentResponse === ''
          }
          handleChange={applyAutoEQ}
        >
          Apply curve
        </Button>
      </div>
      <div className="autoeq-update">
        <span>
          {isCheckingUpdate && 'Checking official database...'}
          {!isCheckingUpdate &&
            updateStatus?.updateAvailable &&
            `Update available (${updateStatus.latest?.modelCount.toLocaleString()} models)`}
          {!isCheckingUpdate &&
            updateStatus &&
            !updateStatus.updateAvailable &&
            `Official database up to date - ${updateStatus.current.modelCount.toLocaleString()} models`}
          {!isCheckingUpdate && !updateStatus && 'Update check unavailable'}
        </span>
        {updateStatus?.updateAvailable ? (
          <Button
            className="small"
            ariaLabel="Update AutoEq database"
            isDisabled={isUpdating}
            handleChange={updateDatabase}
          >
            {isUpdating ? 'Updating...' : 'Update database'}
          </Button>
        ) : (
          <Button
            className="small"
            ariaLabel="Check AutoEq database updates"
            isDisabled={isCheckingUpdate || isUpdating}
            handleChange={refreshUpdateStatus}
          >
            Check again
          </Button>
        )}
      </div>
    </>
  );
};

export default AutoEQ;
