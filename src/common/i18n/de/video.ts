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
import { Dictionary } from '../en';

const video: Partial<Dictionary> = {
  'video.sites': 'Video-Seiten',
  'video.back': 'Zurück',
  'video.forward': 'Vorwärts',
  'video.reload': 'Neu laden',
  'video.stop': 'Stopp',
  'video.searchAria': 'Auf der aktuellen Seite suchen',
  'video.searchOn': 'Auf {site} suchen',
  'video.searchGo': 'Suchen',
  'video.searchClear': 'Suche löschen',
  'video.searchRecent': 'Letzte Suchanfragen',
  'video.searchForget': '„{term}“ vergessen',
  'video.searchForgetAll': 'Letzte Suchanfragen löschen',
  'video.adBlock': 'Werbung blockieren',
  'video.adBlockHint':
    'Überspringt Videowerbung und blendet Werbeflächen auf YouTube aus.',
  'video.signOut': 'Von allen Seiten abmelden',
  'video.signOutBusy': 'Wird abgemeldet…',
  'video.signOutHint':
    'Löscht alle Cookies, Anmeldungen und zwischengespeicherten Seiten des Players.',
  'video.signOutDone': 'Abgemeldet',
  'video.signOutFailed': 'Abmelden nicht möglich',
  'video.blockedTitle': 'Dieser Link führt aus dem Player heraus',
  'video.openInBrowser': 'Im Browser öffnen',
  'video.downloadChoosing': 'Speicherort für diese Datei wählen',
  'video.downloadSaving': '{file} wird gespeichert',
  'video.downloadComplete': 'Auf dem Computer gespeichert',
  'video.downloadFailed': 'Der Download konnte nicht gespeichert werden',
  'video.downloadProgress': 'Downloadfortschritt',
  'video.downloadCopyPath': 'Pfad kopieren',
  'video.downloadCopied': 'Pfad kopiert',
  'video.downloadShowFolder': 'Im Ordner anzeigen',
  'video.resize': 'Ziehen, um die Größe des Players zu ändern',
};

export default video;
