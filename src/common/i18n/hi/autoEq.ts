/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/** Auto EQ on the EQ page: its button, its panel, Manage, and the note that
 * took the Output panel’s old switch’s place. */
export default {
  'autoEq.title': 'ऑटो EQ',
  'autoEq.aria': 'ऑटो EQ: हर गाने की आवाज़ क्या तय करता है',
  'autoEq.tagline': 'हर गाने की आवाज़, आपके लिए चुनी हुई',
  'autoEq.state.measuring': 'माप रहा है',
  'autoEq.state.paused': 'रुका हुआ',
  'autoEq.state.song': 'गाना',
  'autoEq.state.album': 'एल्बम',
  'autoEq.state.yours': 'आपकी',
  'autoEq.aside':
    'जब DSP बंद हो, कोई गेमिंग चेन चालू हो या कोई गेम अपनी आवाज़ बजाए, तब यह किनारे हट जाता है। फिर जैसा था वैसा लौट आता है।',
  'autoEq.now.nothing': 'कुछ नहीं बज रहा',
  'autoEq.now.yours': 'आपकी आवाज़',
  'autoEq.now.yoursWhy':
    'इस गाने के लिए कुछ सहेजा नहीं है: यह आपकी पिछली चुनी हुई आवाज़ बजाता है।',
  'autoEq.now.song': 'इस गाने की आवाज़',
  'autoEq.now.songWhy': 'हर बार यह गाना बजने पर लौट आती है।',
  'autoEq.now.album': '{album} की आवाज़',
  'autoEq.now.albumUnnamed': 'इसके एल्बम की आवाज़',
  'autoEq.now.albumWhy': 'पूरे एल्बम के लिए लाइब्रेरी में सेट की गई।',
  'autoEq.songs.title': 'गानों की आवाज़ें',
  'autoEq.songs.hint':
    'जिस गाने की आवाज़ सहेजी गई है, वह उसी से बजता है। बजते समय उसे बदलें, तो गाना वह बदलाव रखता है। बाकी गाने आपकी आवाज़ से बजते हैं।',
  'autoEq.songs.nothing': 'किसी गाने की आवाज़ सहेजने के लिए उसे चलाएँ',
  'autoEq.songs.saved': 'इस गाने के लिए सहेजा गया',
  'autoEq.songs.none': 'इस गाने के लिए कुछ सहेजा नहीं है',
  'autoEq.songs.save': 'इस गाने के लिए सहेजें',
  'autoEq.songs.forget': 'भुला दें',
  'autoEq.albums.title': 'एल्बमों की आवाज़ें',
  'autoEq.albums.hint':
    'सिर्फ़ लाइब्रेरी में। एल्बम का हर गाना इसी से बजता है, सिवाय उस गाने के जिसका अपना प्रीसेट हो।',
  'autoEq.albums.nothing':
    'किसी एल्बम की आवाज़ लाइब्रेरी में उसके पेज पर सेट करें',
  'autoEq.albums.libraryOnly': 'सिर्फ़ लाइब्रेरी: दूसरे प्लेयर के लिए नहीं',
  'autoEq.albums.set': '{album}: {preset}',
  'autoEq.albums.none': 'इस एल्बम की कोई आवाज़ सेट नहीं है',
  'autoEq.smart.title': 'स्मार्ट सुधार',
  'autoEq.smart.hint':
    'हर गाने को स्रोत से मापता है और उसका सुधार उसी गाने के लिए रखता है। किसी भी प्रीसेट के ऊपर।',
  'autoEq.smart.modes': 'यह कैसे सुधारता है',
  'autoEq.smart.waiting': 'गाने का इंतज़ार',
  'autoEq.smart.willSave': 'गाना खत्म होने पर इस गाने के लिए सहेजा जाएगा',
  'autoEq.smart.savesIn': '{remaining} में इस गाने के लिए सहेजा जाएगा',
  'autoEq.smart.onceHint': 'जो बज रहा है उसका एक माप, एक ही बार में लागू',
  'autoEq.smart.once': 'एक बार मापें',
  'autoEq.savedCount': 'सहेजे गए: {songs} · {albums}',
  'autoEq.manage': 'प्रबंधित करें',
  'autoEq.manage.title': 'सहेजी गई आवाज़ें',
  'autoEq.manage.back': 'ऑटो EQ पर वापस',
  'autoEq.manage.songs': 'गाने',
  'autoEq.manage.albums': 'एल्बम',
  'autoEq.manage.search': 'सहेजी गई आवाज़ें खोजें',
  'autoEq.manage.wholeSound': '{preset}, अपने टोन और EQ के साथ',
  'autoEq.manage.forget': 'भुला दें',
  'autoEq.manage.others': 'दूसरे प्लेयर के गाने: {count}',
  'autoEq.manage.othersHint':
    'Spotify, YouTube और ब्राउज़र। उनके नाम कभी नहीं रखे जाते।',
  'autoEq.manage.empty': 'अभी कुछ सहेजा नहीं गया',
  'autoEq.manage.noMatch': 'कुछ नहीं मिला',
  'autoEq.manage.resetKeeps':
    '“सभी सेटिंग रीसेट करें” इन्हें रखता है। सिर्फ़ “भुला दें” इन्हें हटाता है।',
  'autoEq.manage.forgetAll': 'सब भुला दें',
  'autoEq.manage.forgetAllConfirm': 'सब हमेशा के लिए भुला दें',
  'autoEq.moved.title': 'हर गाने की आवाज़ अब ऑटो EQ में है',
  'autoEq.moved.body':
    '“हर गाने की आवाज़ याद रखें” अब EQ पेज पर ऑटो EQ में है। आपके {count} सहेजे गए गाने भी साथ आ गए।',
  'autoEq.moved.bodyOne':
    '“हर गाने की आवाज़ याद रखें” अब EQ पेज पर ऑटो EQ में है। आपका सहेजा गया गाना भी साथ आ गया।',
  'autoEq.moved.open': 'ऑटो EQ खोलें',
  'autoEq.moved.dismiss': 'ठीक है',
};
