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

/** The Library's tag editor. See `../en/libraryTags.ts`. */
const libraryTags = {
  'library.tags.menu.edit': 'टैग संपादित करें…',
  'library.tags.menu.editMany': '{count} गानों के टैग संपादित करें…',
  'library.tags.menu.editAlbum': 'एल्बम के टैग संपादित करें…',
  'library.tags.menu.cover': 'कवर बदलें…',
  'library.tags.menu.shortcut': 'Ctrl+I',
  'library.tags.selection.count': '{count} गाने',
  'library.tags.selection.edit': 'टैग संपादित करें',
  'library.tags.selection.clear': 'चयन हटाएँ',

  'library.tags.field.title': 'शीर्षक',
  'library.tags.field.artist': 'कलाकार',
  'library.tags.field.composer': 'संगीतकार',
  'library.tags.field.album': 'एल्बम',
  'library.tags.field.albumArtist': 'एल्बम कलाकार',
  'library.tags.field.trackNo': 'ट्रैक',
  'library.tags.field.trackTotal': 'कुल ट्रैक',
  'library.tags.field.discNo': 'डिस्क',
  'library.tags.field.discTotal': 'कुल डिस्क',
  'library.tags.field.year': 'वर्ष',
  'library.tags.field.genre': 'शैली',
  'library.tags.field.bpm': 'BPM',
  'library.tags.field.comment': 'टिप्पणी',
  'library.tags.field.grouping': 'समूह',
  'library.tags.field.publisher': 'लेबल',
  'library.tags.field.copyright': 'कॉपीराइट',
  'library.tags.field.isrc': 'ISRC',
  'library.tags.field.conductor': 'संचालक',
  'library.tags.field.subtitle': 'उपशीर्षक',
  'library.tags.field.remixer': 'रीमिक्स',
  'library.tags.field.initialKey': 'स्केल',
  'library.tags.field.compilation': 'संकलन',
  'library.tags.field.titleSort': 'शीर्षक का क्रम',
  'library.tags.field.artistSort': 'कलाकार का क्रम',
  'library.tags.field.albumSort': 'एल्बम का क्रम',
  'library.tags.field.albumArtistSort': 'एल्बम कलाकार का क्रम',
  'library.tags.field.composerSort': 'संगीतकार का क्रम',
  'library.tags.field.musicBrainzTrackId': 'MusicBrainz रिकॉर्डिंग',
  'library.tags.field.musicBrainzReleaseId': 'MusicBrainz रिलीज़',
  'library.tags.field.musicBrainzArtistId': 'MusicBrainz कलाकार',
  'library.tags.field.musicBrainzReleaseArtistId': 'MusicBrainz एल्बम कलाकार',
  'library.tags.field.musicBrainzReleaseGroupId': 'MusicBrainz रिलीज़ समूह',

  'library.tags.panel.title': 'टैग संपादित करें',
  'library.tags.panel.position': '{count} में से {index}',
  'library.tags.panel.previous': 'पिछला गाना (Alt+↑)',
  'library.tags.panel.next': 'अगला गाना (Alt+↓)',
  'library.tags.panel.close': 'बंद करें (Esc): बदलाव बने रहेंगे',
  'library.tags.panel.reading': 'फ़ाइल के टैग पढ़े जा रहे हैं…',
  'library.tags.panel.readFailed':
    'इस फ़ाइल के टैग नहीं पढ़े जा सके। हो सकता है वह ख़राब हो या उपयोग में हो।',
  'library.tags.panel.missing': 'यह गाना अब डिस्क पर नहीं है।',
  'library.tags.panel.unsupported':
    'FluidEQ इस तरह की फ़ाइल के टैग संपादित नहीं करता।',
  'library.tags.group.song': 'गाना',
  'library.tags.group.album': 'एल्बम',
  'library.tags.group.details': 'विवरण',
  'library.tags.group.file': 'फ़ाइल',
  'library.tags.of': '/',
  'library.tags.sameAsArtist': 'कलाकार जैसा ही',
  'library.tags.putBack': 'पहले जैसा करें',
  'library.tags.noArtist': 'कोई कलाकार नहीं',
  'library.tags.noAlbum': 'कोई एल्बम नहीं',
  'library.tags.genre.inLibrary': 'आपकी लाइब्रेरी में',
  'library.tags.tip.fileName':
    'शीर्षक फ़ाइल का नाम ही है। {title} का उपयोग करें?',
  'library.tags.tip.fileNameTrack':
    'शीर्षक फ़ाइल का नाम ही है। {title}, ट्रैक {track} का उपयोग करें?',
  'library.tags.tip.use': 'उपयोग करें',

  'library.tags.cover.dropHint': 'कोई चित्र छोड़ें या चिपकाएँ',
  'library.tags.cover.facts': '{width} × {height} · {kind} · {size}',
  'library.tags.cover.factsShort': '{kind} · {size}',
  'library.tags.cover.none': 'इस फ़ाइल में कोई कवर नहीं है',
  'library.tags.cover.new': 'नया कवर · {width} × {height}',
  'library.tags.cover.removed': 'सहेजने पर कवर हटा दिया जाएगा',
  'library.tags.cover.refused': 'केवल 20 MB तक का JPEG या PNG चित्र।',
  'library.tags.cover.emptyClipboard': 'क्लिपबोर्ड पर कोई चित्र नहीं है।',

  'library.tags.more.toggle': 'और फ़ील्ड',
  'library.tags.more.count': 'इस फ़ाइल में {count} · कोई भी जोड़ें',
  'library.tags.more.countNone': 'कोई भी जोड़ें',
  'library.tags.more.add': 'फ़ील्ड जोड़ें',
  'library.tags.more.addHint':
    'फ़ॉर्मैट जिस भी फ़ील्ड की अनुमति दे, उसके कोड से।',
  'library.tags.more.code': 'कोड',
  'library.tags.more.value': 'मान',
  'library.tags.more.addConfirm': 'जोड़ें',
  'library.tags.more.badCode':
    'इस फ़ाइल का फ़ॉर्मैट उस कोड को टेक्स्ट के रूप में नहीं रख सकता।',

  'library.tags.file.format': 'फ़ॉर्मैट',
  'library.tags.file.tags': 'फ़ाइल के टैग',
  'library.tags.file.noTags': 'कोई टैग नहीं',
  'library.tags.file.writeAs': 'इस रूप में लिखें',
  'library.tags.file.keep': '{version} रखें',
  'library.tags.file.v23Note':
    'v2.3 को Windows एक्सप्लोरर, कार स्टीरियो और पुराने प्लेयर सबसे अच्छी तरह पढ़ते हैं। v2.4 UTF-8 और एक फ़ील्ड में कई मान रखता है।',
  'library.tags.file.v24Note':
    'Windows एक्सप्लोरर और कुछ कार स्टीरियो v2.4 ठीक से नहीं पढ़ते; अगर यह फ़ाइल दूसरी जगह भी चलेगी तो v2.3 सुरक्षित विकल्प है।',
  'library.tags.file.id3v1': 'पुराने ID3v1 टैग को भी साथ में अपडेट रखें',
  'library.tags.file.readOnly':
    'यह फ़ाइल केवल पढ़ने के लिए है। लिखने से पहले आपसे पूछा जाएगा।',

  'library.tags.foot.none': 'कोई बदलाव नहीं',
  'library.tags.foot.noneHint':
    'एल्बम में आगे-पीछे जाते समय बदलाव बने रहते हैं',
  'library.tags.foot.changes': '{count} बदलाव सहेजे नहीं गए',
  'library.tags.foot.changesOne': '1 बदलाव सहेजा नहीं गया',
  'library.tags.foot.inSongs': '{count} गानों में',
  'library.tags.foot.inSongsOne': '1 गाने में',
  'library.tags.revert': 'बदलाव छोड़ें',
  'library.tags.save': 'सहेजें',
  'library.tags.saveSongs': '{count} गाने सहेजें',
  'library.tags.saveFailed':
    'कुछ मान लिखे गए रूप में नहीं लिखे जा सके। चिह्नित फ़ील्ड जाँचें।',

  'library.tags.set.reading': 'टैग पढ़े जा रहे हैं · {count} में से {done}',
  'library.tags.set.use': '{value} का उपयोग करें',
  'library.tags.set.coversMixed': '{count} अलग-अलग कवर',
  'library.tags.set.coversNone': '{count} गानों में कवर नहीं है',
  'library.tags.set.coverOne': 'सबके लिए एक कवर',
  'library.tags.set.coverNoneAll': 'किसी गाने में कवर नहीं है',
  'library.tags.set.coverToAll': 'सभी {count} गानों के लिए',
  'library.tags.set.songs': 'गाने',
  'library.tags.set.renumber': 'क्रम से दोबारा नंबर दें',
  'library.tags.set.fixAuto': 'अपने आप ठीक करें',
  'library.tags.set.moreFields': 'और फ़ील्ड ({fields})',
  'library.tags.set.varies': 'अलग-अलग:',
  'library.tags.set.variesPlaceholder': 'अलग-अलग · सबके लिए एक लिखें',
  'library.tags.set.useForAll': 'सभी {count} गानों के लिए इस्तेमाल करें',
  'library.tags.set.found': '{count} गाने मिले',
  'library.tags.set.foundOne': '1 गाना मिला',
  'library.tags.set.foundNone': 'किसी शीर्षक में यह नहीं है',
  'library.tags.cover.change': 'कवर बदलें',
  'library.tags.cover.changeShort': 'बदलें',
  'library.tags.cover.chooseImage': 'चित्र चुनें…',
  'library.tags.cover.pasteImage': 'क्लिपबोर्ड से चिपकाएँ',
  'library.tags.cover.removeCover': 'कवर हटाएँ',
  'library.tags.set.find': 'शीर्षकों में खोजें',
  'library.tags.set.replaceWith': 'इससे बदलें',
  'library.tags.set.replaceAll': 'सब बदलें',
  'library.tags.set.sheetHint':
    'Enter नीचे जाता है · Tab दाएँ · Ctrl+D ऊपर का सेल कॉपी करता है · क्रम बदलने के लिए पंक्ति को उसके हैंडल से खींचें, फिर दोबारा नंबर दें।',
  'library.tags.set.col.no': '#',
  'library.tags.set.col.time': 'अवधि',
  'library.tags.set.grip': 'क्रम बदलने के लिए खींचें',
  'library.tags.set.missingCell': 'नहीं है',
  'library.tags.set.groupSongs': '{count} गाने',
  'library.tags.set.changes': '{count} बदलाव',
  'library.tags.set.changesOne': '1 बदलाव',
  'library.tags.set.files': '{count} फ़ाइलें · अभी कुछ नहीं लिखा गया',
  'library.tags.set.filesOne': '1 फ़ाइल · अभी कुछ नहीं लिखा गया',
  'library.tags.set.discard': 'छोड़ें',
  'library.tags.set.back': 'वापस',
  'library.tags.set.leaveAsk': 'इन बदलावों को सहेजे बिना निकलें?',
  'library.tags.set.keepEditing': 'संपादन जारी रखें',
  'library.tags.set.unreadable':
    '{count} गाने पढ़े नहीं जा सके और छोड़ दिए गए हैं।',

  'library.tags.write.progress': 'टैग लिखे जा रहे हैं · {count} में से {done}',
  'library.tags.write.undoing':
    'टैग पहले जैसे किए जा रहे हैं · {count} में से {done}',
  'library.tags.write.background': 'बैकग्राउंड में जारी रखें',
  'library.tags.write.show': 'दिखाएँ',
  'library.tags.write.cancel': 'रद्द करें',
  'library.tags.write.written': '{count} में से {done} लिखे गए',
  'library.tags.write.needYou': '{count} को आपकी ज़रूरत है',
  'library.tags.write.review': '{count} फ़ाइलें देखें',
  'library.tags.write.reviewOne': '1 फ़ाइल देखें',
  'library.tags.write.done': '{count} फ़ाइलें अपडेट हुईं',
  'library.tags.write.doneOne': '1 फ़ाइल अपडेट हुई',
  'library.tags.write.doneNote':
    'पिछले टैग रखे गए हैं — पूर्ववत करें से सब वापस आ जाते हैं।',
  'library.tags.write.undo': 'पूर्ववत करें',
  'library.tags.write.undone': 'पूर्ववत हो गया',
  'library.tags.write.undoneNote':
    'हर फ़ाइल में फिर से पिछले टैग हैं, कवर समेत।',
  'library.tags.write.stopped': '{count} में से {done} के बाद रुका',
  'library.tags.write.stoppedNote':
    'जो फ़ाइलें लिखी जा चुकी हैं उनमें नए टैग रहेंगे; पूर्ववत करें से पुराने वापस आते हैं।',
  'library.tags.write.failed': '{count} नहीं लिखी जा सकीं',
  'library.tags.write.failedOne': '1 नहीं लिखी जा सकी',
  'library.tags.write.dismiss': 'बंद करें',
  'library.tags.problems.title': '{count} फ़ाइलों को आपकी ज़रूरत है',
  'library.tags.problems.titleOne': '1 फ़ाइल को आपकी ज़रूरत है',
  'library.tags.problems.allHandled': 'सब सुलझ गया',
  'library.tags.problems.waiting':
    '{count} अपने गाने के ख़त्म होने का इंतज़ार कर रही हैं',
  'library.tags.problems.waitingOne':
    '1 अपने गाने के ख़त्म होने का इंतज़ार कर रही है',
  'library.tags.problems.held':
    'अभी FluidEQ में चल रहा है — गाना ख़त्म होते ही लिखा जाएगा।',
  'library.tags.problems.locked':
    'किसी दूसरे प्रोग्राम में खुला है। उसे वहाँ बंद करें, फिर दोबारा कोशिश करें।',
  'library.tags.problems.readOnly':
    'यह फ़ाइल केवल पढ़ने के लिए है, इसलिए इसे ऐसे नहीं बदला जा सकता।',
  'library.tags.problems.failed':
    'यह फ़ाइल नहीं लिखी जा सकी। यह पहले जैसी है; कुछ नहीं खोया।',
  'library.tags.problems.missing':
    'यह फ़ाइल अब वहाँ नहीं है जहाँ लाइब्रेरी ने उसे पाया था।',
  'library.tags.problems.retry': 'फिर कोशिश करें',
  'library.tags.problems.skip': 'छोड़ें',
  'library.tags.problems.makeWritable': 'लिखने योग्य बनाकर लिखें',
  'library.tags.problems.skipAll': 'सब छोड़ें',
  'library.tags.problems.failedCopy':
    'लिखने के लिए इसके बगल में कॉपी नहीं बन सकी। फ़ाइल वैसी ही है। फिर से कोशिश करें; ड्राइव भरी या व्यस्त हो तो पहले उसे खाली करें।',
  'library.tags.problems.failedTags':
    'इसके टैग नहीं लिखे जा सके: फ़ाइल ख़राब या असामान्य हो सकती है। यह वैसी ही है। फिर कोशिश करें, या किसी दूसरे टैग एडिटर में खोलें।',
  'library.tags.problems.failedCheck':
    'जाँच में लिखी गई कॉपी उसी गाने के रूप में नहीं पढ़ी गई, इसलिए उसका इस्तेमाल नहीं हुआ। फ़ाइल वैसी ही है।',
  'library.tags.problems.failedUndo':
    'पहले जैसा करने के लिए ज़रूरी जानकारी नहीं रखी जा सकी, इसलिए कुछ नहीं लिखा गया। फ़ाइल वैसी ही है।',
  'library.tags.problems.failedPlace':
    'लिखी गई कॉपी फ़ाइल की जगह नहीं ले सकी। फ़ाइल वैसी ही है। अगर OneDrive जैसा सिंक ऐप उस पर काम कर रहा है, तो उसके ख़त्म होने पर फिर कोशिश करें।',
  'library.tags.problems.options': 'इस फ़ाइल के विकल्प',
  'library.tags.problems.openTags': 'इसके टैग देखें',
  'library.tags.problems.reveal': 'एक्सप्लोरर में दिखाएँ',
  'library.tags.problems.nothingToDo': 'कुछ करने की ज़रूरत नहीं।',
  'library.tags.problems.everythingElse': 'बाकी सब लिखा जा चुका है',
  'library.tags.problems.undoCovers': 'पूर्ववत करें इन पर भी लागू होता है',
  'library.tags.menu.fix': 'टैग अपने-आप ठीक करें…',
  'library.tags.menu.fixAlbum': 'यह एल्बम ठीक करें…',
  'library.tags.menu.fixShortcut': 'Ctrl+Shift+I',
  'library.tags.hero.fix': 'टैग ठीक करें',
  'library.tags.selection.fix': 'ठीक करें',
  'library.tags.fix.empty': 'खाली',
  'library.tags.fix.albums': '{count} एल्बम',
  'library.tags.fix.albumChanges': '{count} बदलाव',
  'library.tags.fix.albumChangesOne': '1 बदलाव',
  'library.tags.fix.nothingFound':
    'FluidEQ को इन गानों में ठीक करने लायक कुछ नहीं मिला।',
  'library.tags.fix.noPicture': 'एल्बम फ़ोल्डर की तस्वीर इस्तेमाल नहीं हो सकी।',
  'library.tags.fix.filled':
    'FluidEQ ने जो कमी थी उसे भर दिया। बदला हुआ रंग में है, पुराना मान बगल में कटा हुआ: जाँचें और सहेजें, या छोड़ दें।',
  'library.tags.fix.fixAlbum': 'ठीक करें',
  'library.tags.fix.openAlbum': 'खोलें',
  'library.tags.fix.editByHand': 'सब हाथ से बदलें',
  'library.tags.folders.eyebrow': 'बड़ा फ़ोल्डर',
  'library.tags.folders.count': 'गानों वाले {count} फ़ोल्डर',
  'library.tags.folders.lead':
    'एक साथ बदलने के लिए गाने बहुत ज़्यादा हैं। एक फ़ोल्डर चुनें: वह अकेला एडिटर में खुलेगा, और वापस या सहेजें आपको यहीं लौटाएगा, फ़ोल्डर पर निशान के साथ।',
  'library.tags.folders.saved': 'सहेजा गया',
  'library.tags.folders.edit': 'बदलें',
  'library.tags.set.cancelReading': 'रद्द करें',
  'library.tags.fix.albumComplete': 'पूरा',
  'library.tags.changes.title': 'बदलाव',
  'library.tags.changes.none':
    'अभी कोई बदलाव नहीं। आप जो भी बदलेंगे, सहेजने से पहले यहाँ दिखेगा।',
  'library.tags.changes.album': 'पूरे एल्बम के लिए',
  'library.tags.changes.songs': 'गाना दर गाना',
  'library.tags.changes.removed': 'हटाया जाएगा',
  'library.tags.changes.cover': 'कवर',
  'library.tags.changes.coverNew': 'नई तस्वीर',
  'library.tags.changes.coverRemoved': 'हटाया जाएगा',
  'library.tags.cover.useOne': 'एक को सभी गानों के लिए इस्तेमाल करें',
  'library.tags.cover.useThis': 'यह कवर सभी गानों के लिए इस्तेमाल करें',
  'library.tags.cover.searchWeb': 'इंटरनेट पर कवर खोजें…',
  'library.tags.cover.searchHint':
    'ब्राउज़र में अपनी पसंद की तस्वीर कॉपी करें और चिपकाएँ चुनें, या उसे कवर पर खींचकर छोड़ें।',
  'library.tags.set.searchWeb': 'इंटरनेट पर एल्बम खोजें',
  'library.tags.set.searchWebNote':
    'आपके ब्राउज़र में MusicBrainz पर एल्बम खोलता है। FluidEQ कुछ भी डाउनलोड नहीं करता।',
  'library.tags.write.undoAsk': '{count} फ़ाइलों के पुराने टैग वापस लाएँ?',
  'library.tags.write.undoAskOne': '1 फ़ाइल के पुराने टैग वापस लाएँ?',
  'library.tags.write.undoKeep': 'नहीं',
  'library.tags.write.undoConfirm': 'पहले जैसा करें',
};

export default libraryTags;
