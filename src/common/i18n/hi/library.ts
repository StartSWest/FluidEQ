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
  'library.browse.genre': 'शैलियाँ',
  'library.browse.song': 'गाने',
  'library.browse.folder': 'फ़ोल्डर',
  'library.browse.directory': 'ट्री',
  'library.browse.folderHint': 'संगीत वाला हर फ़ोल्डर, एक साथ',
  'library.browse.directoryHint': 'रूट फ़ोल्डर से भीतर की ओर',
  'library.browse.folderReading': 'फ़ोल्डर कैसे पढ़े जाएँ',
  'library.jumpTo': 'किसी अक्षर पर जाएँ',
  'library.coverflow.previous': 'पिछला कवर',
  'library.coverflow.next': 'अगला कवर',
  'library.folderCount': '{count} फ़ोल्डर',
  'library.filterHere': 'इन गानों को फ़िल्टर करें',
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
  'library.sort.track': 'एल्बम क्रम',

  'library.column.title': 'शीर्षक',
  'library.column.artist': 'कलाकार',
  'library.column.album': 'एल्बम',
  'library.column.year': 'वर्ष',
  'library.column.length': 'लंबाई',
  'library.column.trackNo': 'ट्रैक संख्या',

  'library.unknownAlbum': 'अज्ञात एल्बम',
  'library.unknownArtist': 'अज्ञात कलाकार',
  'library.genre.unknown': 'अज्ञात शैली',
  'library.trackCount': '{count} गाने',
  'library.albumCount': '{count} एल्बम',
  'library.artistCount': '{count} कलाकार',

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
  'library.trackMenu': 'और क्रियाएँ',

  'library.unplayable': 'FluidEQ यह प्रारूप नहीं चला सकता',
  'library.metadataError': 'FluidEQ इस फ़ाइल के टैग नहीं पढ़ सका।',
  'library.pending': 'यह फ़ाइल मिल गई है और उसका विवरण अभी भी पढ़ा जा रहा है।',
  'library.indexReset':
    'लाइब्रेरी इंडेक्स पढ़ा नहीं जा सका और उसे फिर से बनाया गया है।',

  'library.back': 'वापस',

  'library.upNext': 'आगे',
  'library.upNext.empty': 'कतार अभी खाली है',
  'library.upNext.added': 'आपकी पसंद',
  'library.upNext.rest': 'उसके बाद',
  'library.upNext.continued': 'इससे मिलता-जुलता',
  'library.upNext.keepPlaying': 'बजाते रहें',
  'library.upNext.keepPlayingHint':
    'सूची खत्म होने पर उसी शैली का और संगीत चलता रहेगा',
  'library.queueAdd': 'कतार में जोड़ें',

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
  'library.mute': 'म्यूट करें',
  'library.unmute': 'अनम्यूट करें',
  'library.playbackOptions': 'प्लेबैक विकल्प',
  'library.position': 'स्थिति',
  'library.queue': 'कतार',
  'library.queue.remove': 'कतार से हटाएँ',
  'library.nowPlaying': 'अभी चल रहा है',
  'library.nothingPlaying': 'कुछ नहीं चल रहा',
  'library.nothingPlayingHint': 'सुनने के लिए कुछ चुनें',
  'library.systemAudio': 'सिस्टम ऑडियो',
  'library.remoteAudio': 'रिमोट प्ले · {name}',

  'library.trackActions': 'इस गाने का क्या करें',
  'library.browse.playlist': 'प्लेलिस्ट',
  'library.playlist.favorites': 'पसंदीदा',
  'library.playlist.addToFavorites': 'पसंदीदा में जोड़ें',
  'library.playlist.removeFromFavorites': 'पसंदीदा से हटाएँ',
  'library.playlist.favorite': 'आपके पसंदीदा में है',
  'library.playlist.addTo': 'प्लेलिस्ट में जोड़ें',
  'library.playlist.alreadyIn': 'इस प्लेलिस्ट में पहले से है',
  'library.playlist.removeFrom': 'इस प्लेलिस्ट से हटाएँ',
  'library.playlist.new': 'नई प्लेलिस्ट',
  'library.playlist.newName': 'प्लेलिस्ट का नाम',
  'library.playlist.create': 'बनाएँ',
  'library.playlist.rename': 'नाम बदलें',
  'library.playlist.keep': 'रहने दें',
  'library.playlist.delete': 'प्लेलिस्ट मिटाएँ',
  'library.playlist.deleteConfirm':
    '“{name}” मिटाएँ? गाने आपकी लाइब्रेरी में बने रहेंगे।',
  'library.playlist.builtIn': 'पसंदीदा हमेशा रहती है और मिटाई नहीं जा सकती',
  'library.playlist.songCount': '{count} गाने',
  'library.playlist.songCountOne': '1 गाना',
  'library.playlist.empty': 'इस प्लेलिस्ट में अभी कुछ नहीं है',
  'library.playlist.emptyHint':
    'किसी गाने पर दायाँ क्लिक करें और “प्लेलिस्ट में जोड़ें” चुनें।',
  'library.playlist.missing':
    'इस प्लेलिस्ट के {count} गाने अभी आपकी लाइब्रेरी में नहीं हैं',
  'library.playlist.reset':
    'आपकी प्लेलिस्ट पढ़ी नहीं जा सकीं और रीसेट कर दी गई हैं।',
  'library.karaoke.send': 'कराओके में भेजें',
  'library.karaoke.sending': 'कराओके में भेजा जा रहा है…',
  'library.karaoke.failed':
    'यह फ़ाइल कराओके में नहीं भेजी जा सकी — शायद यह बहुत बड़ी है या पढ़ी नहीं जा सकती।',
};

export default library;
