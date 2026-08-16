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

/** The Remote Media tab. */
const video = {
  'video.sites': 'Video sites',
  'video.back': 'Back',
  'video.forward': 'Forward',
  'video.reload': 'Reload',
  'video.stop': 'Stop',
  'video.searchAria': 'Search the current site',
  'video.searchOn': 'Search {site}',
  'video.searchGo': 'Search',
  'video.searchClear': 'Clear the search',
  'video.searchRecent': 'Recent searches',
  'video.searchForget': 'Forget “{term}”',
  'video.searchForgetAll': 'Clear recent searches',
  'video.adBlock': 'Block ads',
  'video.adBlockHint': 'Skips video ads and hides ad slots on YouTube.',
  'video.signOut': 'Sign out of all sites',
  'video.signOutBusy': 'Signing out…',
  'video.signOutHint':
    'Clears every cookie, login and cached page the player is holding.',
  'video.signOutDone': 'Signed out',
  'video.signOutFailed': 'Could not sign out',
  'video.blockedTitle': 'That link leads outside the player',
  'video.openInBrowser': 'Open in browser',
  'video.downloadChoosing': 'Choose where to save this file',
  'video.downloadSaving': 'Saving {file}',
  'video.downloadComplete': 'Saved to your computer',
  'video.downloadFailed': 'The download could not be saved',
  'video.downloadProgress': 'Download progress',
  'video.downloadCopyPath': 'Copy path',
  'video.downloadCopied': 'Path copied',
  'video.downloadShowFolder': 'Show in folder',
  'video.resize': 'Drag to resize the player',
} as const;

export default video;
