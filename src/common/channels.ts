/*
<AQUA: System-wide parametric audio equalizer interface>
Copyright (C) <2023>  <AQUA Dev Team>
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

enum ChannelEnum {
  HEALTH_CHECK = 'healthCheck',
  SET_WINDOW_SIZE = 'setWindowSize',
  GET_STATE = 'getState',
  GET_ENABLE = 'getEnable',
  SET_ENABLE = 'setEnable',
  SET_AUTO_PREAMP = 'setAutoPreAmp',
  SET_GRAPH_VIEW = 'setGraphView',
  GET_PREAMP = 'getPreAmp',
  SET_PREAMP = 'setPreAmp',
  GET_FILTER_GAIN = 'getFilterGain',
  SET_FILTER_GAIN = 'setFilterGain',
  GET_FILTER_FREQUENCY = 'getFilterFrequency',
  SET_FILTER_FREQUENCY = 'setFilterFrequency',
  GET_FILTER_QUALITY = 'getFilterQuality',
  SET_FILTER_QUALITY = 'setFilterQuality',
  GET_FILTER_TYPE = 'getFilterType',
  SET_FILTER_TYPE = 'setFilterType',
  /**
   * Several bands, one write.
   *
   * The four setters above each end in a full flush: an installation check, a
   * config rewrite behind a five-attempt retry, and a preset save. That is the
   * right cost for one band. Editing a selection of ten paid it ten times over
   * for a single knob turn, which is slow enough that the requests outlive the
   * ten-second reply timeout and the edit reports itself as a failure.
   */
  SET_FILTER_VALUES = 'setFilterValues',
  /**
   * Start or stop a Chromium memory-infra recording.
   *
   * Development only — the handler refuses in a packaged build, and the
   * control that sends it is not rendered there either.
   */
  TOGGLE_MEMORY_TRACE = 'toggleMemoryTrace',
  GET_FILTER_COUNT = 'getFilterCount',
  ADD_FILTER = 'addFilter',
  REMOVE_FILTER = 'removeFilter',
  LOAD_PRESET = 'loadPreset',
  SAVE_PRESET = 'savePreset',
  DELETE_PRESET = 'deletePreset',
  RENAME_PRESET = 'renamePreset',
  GET_PRESET_FILE_LIST = 'getPresetFileList',
  RESTORE_PRESET_BASELINE = 'restorePresetBaseline',
  GET_PRESET_BASELINE_NAMES = 'getPresetBaselineNames',
  GET_AUTO_EQ_DEVICE_LIST = 'getAutoEqDeviceList',
  GET_AUTO_EQ_RESPONSE_LIST = 'getAutoEqResponseList',
  LOAD_AUTO_EQ_PRESET = 'loadAutoEqPreset',
  GET_CONVOLUTION_CATALOG = 'getConvolutionCatalog',
  DOWNLOAD_CONVOLUTION = 'downloadConvolution',
  CLEAR_CONVOLUTION = 'clearConvolution',
  // Both open a native file picker in the main process and return a short
  // description of what was applied, so the renderer never handles a path.
  IMPORT_EQ_FILE = 'importEqFile',
  IMPORT_EQ_TEXT = 'importEqText',
  IMPORT_CONVOLUTION_FILE = 'importConvolutionFile',
  CHECK_AUTO_EQ_UPDATE = 'checkAutoEqUpdate',
  UPDATE_AUTO_EQ_DATABASE = 'updateAutoEqDatabase',
  CLEAR_GAINS = 'clearGains',
  SET_FIXED_BAND = 'setFixedBand',
  SET_VOICING = 'setVoicing',
  SET_DRIVER = 'setDriver',
  SET_HEADPHONE = 'setHeadphone',
  // The measured correction, stored as its own layer. An empty payload removes
  // it; nothing here ever touches the user's bands.
  SET_SMART_EQ = 'setSmartEq',
  // Switch a layer out of the config without disturbing a single one of its
  // settings — the A/B switch on each chip. Takes a feature name and whether it
  // should be off, and moves nothing else.
  SET_LAYER_BYPASS = 'setLayerBypass',
  // Clearing a reference clears the bands it wrote, because applying one wrote
  // them. The layers stacked after them are untouched: none of them came from
  // the reference and none of them stop being true without it.
  CLEAR_HEADSET = 'clearHeadset',
  // The Equalizer APO config as it stands on disk: every device, the files it
  // includes, and what each of them holds. Read rather than rebuilt, because
  // the question it answers is what APO has actually got.
  GET_APO_CONFIG_TREE = 'getApoConfigTree',
  // Write one config file back. Only files FluidEQ generated, only inside the
  // config directory, and only ever the one named — see the handler.
  WRITE_APO_CONFIG_FILE = 'writeApoConfigFile',
  // One output's whole chain, out to a file and back in again. The profile
  // travels rather than the generated files — see common/chainBundle for why.
  EXPORT_DEVICE_CHAIN = 'exportDeviceChain',
  IMPORT_DEVICE_CHAIN = 'importDeviceChain',
  GET_AUDIO_DEVICES = 'getAudioDevices',
  SET_DEFAULT_AUDIO_DEVICE = 'setDefaultAudioDevice',
  ACTIVATE_AUDIO_DEVICE_PROFILE = 'activateAudioDeviceProfile',
  GET_DEVICE_PROFILE_SETTINGS = 'getDeviceProfileSettings',
  ASSIGN_DEVICE_PROFILE = 'assignDeviceProfile',
  REMOVE_DEVICE_PROFILE = 'removeDeviceProfile',
  // Runs the Equalizer APO installer that ships inside ours. Nobody is sent to
  // a website to find one.
  INSTALL_EQUALIZER_APO = 'installEqualizerApo',
  // Everything a bug report needs, already redacted. Gathered in main because
  // the logs and the registry are not reachable from the renderer.
  GATHER_BUG_REPORT = 'gatherBugReport',
  // The built-in player's ad blocker. The window owns the switch and remembers
  // it; the main process holds the live value and pushes it to each player.
  SET_VIDEO_AD_BLOCK = 'setVideoAdBlock',
  // A link the player refused to follow, sent to the real browser instead —
  // only ever after the user pressed the button on the notice naming it.
  OPEN_VIDEO_LINK_EXTERNALLY = 'openVideoLinkExternally',
  // Sign out of every site in the player at once, and drop the cache with them.
  // The player's session persists so that logging in is worth doing, and this is
  // the other half of that bargain — see VIDEO_BROWSER_PARTITION.
  CLEAR_VIDEO_SESSION = 'clearVideoSession',
  // The window's own failures, written into the same log the bug reporter
  // reads. One way only, and no reply — the caller is error handling, and
  // error handling that can itself fail is not error handling.
  LOG_ERROR = 'logError',
  LOG_INFO = 'logInfo',
}

export default ChannelEnum;
