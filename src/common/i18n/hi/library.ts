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

/** The Library tab: local music and video files. */
import { Dictionary } from '../en';

const library: Partial<Dictionary> = {
  'tabs.library': 'लाइब्रेरी',

  'library.empty.title': 'अभी तक कोई संगीत नहीं',
  'library.empty.body':
    'एक फ़ोल्डर जोड़ें और FluidEQ उसमें मौजूद गाने और वीडियो पढ़ लेगा।',
  'library.empty.add': 'फ़ोल्डर जोड़ें',
  'library.empty.drop': 'या यहाँ फ़ोल्डर खींचकर छोड़ें',
  'library.karaokeSkipped':
    '{count} कराओके गाने छोड़ दिए गए — उन्हें कराओके टैब पर खोलें',

  'library.add': 'फ़ोल्डर जोड़ें',
  'library.rescan': 'फिर से स्कैन करें',
  'library.rescan.force': 'पुनः स्कैन करने के लिए बाध्य करें',
  'library.search': 'लाइब्रेरी में खोजें',
  'library.searchPlaceholder': 'गाने, कलाकार, एल्बम खोजें',

  'library.browse.album': 'एल्बम',
  'library.browse.artist': 'कलाकार',
  'library.browse.song': 'गाने',
  'library.browse.folder': 'फ़ोल्डर',
  'library.jumpTo': 'किसी अक्षर पर जाएँ',
  'library.folderCount': '{count} फ़ोल्डर',
  'library.filterHere': 'इन गानों को फ़िल्टर करें',
  'library.groupByFolder': 'फ़ोल्डर के अनुसार समूहित करें',
  'library.view.list': 'सूची',
  'library.view.grid': 'ग्रिड',
  'library.view.coverflow': 'Cover Flow',
  'library.view.aria': 'लाइब्रेरी किस तरह दिखाई जाती है',
  'library.browse.aria': 'लाइब्रेरी क्या दिखा रही है',

  'library.sort': 'क्रमबद्ध करें',
  'library.sortBy': 'क्रमबद्ध करें: {value}',
  'library.sort.direction': 'क्रम दिशा',
  'library.sort.title': 'शीर्षक',
  'library.sort.artist': 'कलाकार',
  'library.sort.album': 'एल्बम',
  'library.sort.year': 'वर्ष',
  'library.sort.added': 'हाल ही में जोड़ा गया',

  'library.column.title': 'शीर्षक',
  'library.column.artist': 'कलाकार',
  'library.column.album': 'एल्बम',
  'library.column.year': 'वर्ष',
  'library.column.length': 'लंबाई',

  'library.unknownAlbum': 'अज्ञात एल्बम',
  'library.unknownArtist': 'अज्ञात कलाकार',
  'library.trackCount': '{count} गाने',
  'library.albumCount': '{count} एल्बम',

  'library.videos': 'वीडियो',
  'library.videos.empty': 'आपके जोड़े गए फ़ोल्डरों में कोई वीडियो नहीं है।',

  'library.scan.running': '{name} पढ़ा जा रहा है',
  'library.scan.counted': '{seen} में से {parsed} फ़ाइलें',
  'library.scan.cancel': 'रोकें',
  'library.scan.background': 'बैकग्राउंड में जारी रखें',
  'library.scan.done': '{count} गाने जोड़े गए',

  'library.roots': 'फ़ोल्डर',
  'library.root.remove': 'यह फ़ोल्डर हटाएँ',
  'library.root.offline': 'यह फ़ोल्डर अभी उपलब्ध नहीं है',
  'library.reveal': 'एक्सप्लोरर में दिखाएँ',

  'library.unplayable': 'FluidEQ यह प्रारूप नहीं चला सकता',
  'library.metadataError': 'FluidEQ इस फ़ाइल के टैग नहीं पढ़ सका।',
  'library.pending': 'यह फ़ाइल मिल गई है और उसका विवरण अभी भी पढ़ा जा रहा है।',
  'library.indexReset':
    'लाइब्रेरी इंडेक्स पढ़ा नहीं जा सका और उसे फिर से बनाया गया है।',

  'library.back': 'वापस',

  'library.alsoInFolder': 'इसी फ़ोल्डर में है, इस एल्बम में नहीं',
  'library.play': 'चलाएँ',
  'library.pause': 'रोकें',
  'library.stop': 'बंद करें',
  'library.previous': 'पिछला',
  'library.back5': '5 सेकंड पीछे',
  'library.forward5': '5 सेकंड आगे',
  'library.next': 'अगला',
  'library.shuffle': 'शफ़ल',
  'library.repeat': 'दोहराएँ',
  'library.repeat.all': 'सभी दोहराएँ',
  'library.repeat.one': 'यह गाना दोहराएँ',
  'library.repeat.off': 'न दोहराएँ',
  'library.volume': 'आवाज़',
  'library.position': 'स्थिति',
  'library.queue': 'कतार',
  'library.queue.remove': 'कतार से हटाएँ',
  'library.nowPlaying': 'अभी चल रहा है',
  'library.fullScreen': 'पूर्ण स्क्रीन',
};

export default library;
