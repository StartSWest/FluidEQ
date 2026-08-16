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
  'video.sites': 'Siti video',
  'video.back': 'Indietro',
  'video.forward': 'Avanti',
  'video.reload': 'Ricarica',
  'video.stop': 'Interrompi',
  'video.searchAria': 'Cerca nel sito corrente',
  'video.searchOn': 'Cerca su {site}',
  'video.searchGo': 'Cerca',
  'video.searchClear': 'Cancella la ricerca',
  'video.searchRecent': 'Ricerche recenti',
  'video.searchForget': 'Dimentica «{term}»',
  'video.searchForgetAll': 'Cancella le ricerche recenti',
  'video.adBlock': 'Blocca gli annunci',
  'video.adBlockHint':
    'Salta gli annunci video e nasconde gli spazi pubblicitari su YouTube.',
  'video.signOut': 'Disconnetti da tutti i siti',
  'video.signOutBusy': 'Disconnessione…',
  'video.signOutHint':
    'Cancella tutti i cookie, gli accessi e le pagine in cache conservati dal player.',
  'video.signOutDone': 'Disconnesso',
  'video.signOutFailed': 'Impossibile disconnettersi',
  'video.blockedTitle': 'Quel link porta fuori dal player',
  'video.openInBrowser': 'Apri nel browser',
  'video.downloadChoosing': 'Scegli dove salvare questo file',
  'video.downloadSaving': 'Salvataggio di {file}',
  'video.downloadComplete': 'Salvato sul computer',
  'video.downloadFailed': 'Impossibile salvare il download',
  'video.downloadProgress': 'Avanzamento download',
  'video.downloadCopyPath': 'Copia percorso',
  'video.downloadCopied': 'Percorso copiato',
  'video.downloadShowFolder': 'Mostra nella cartella',
  'video.resize': 'Trascina per ridimensionare il player',
};

export default video;
