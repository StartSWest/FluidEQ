const lyricsHandoff = {
  'library.lyrics.karaoke.open': 'कराओके में खोलें',
  'library.lyrics.karaoke.opening': 'खुल रहा है…',
  'library.lyrics.karaoke.hintTimed':
    'इन टाइम किए गए बोलों से कराओके शुरू करें और मेकर में उनकी टाइमिंग ठीक करें',
  'library.lyrics.karaoke.hintPlain':
    'इन बोलों से कराओके शुरू करें और मेकर में उन्हें टाइम करें',
  'library.lyrics.karaoke.failed': 'यह गाना कराओके में नहीं खोला जा सका।',
  'library.lyrics.remove.button': 'बोल हटाएँ',
  'library.lyrics.remove.askFile':
    '{name} हटाएँ? गाने के पास वाली बोल फ़ाइल मिटा दी जाएगी।',
  'library.lyrics.remove.askKept':
    'इन बोलों की वह कॉपी हटाएँ जो FluidEQ इस गाने के लिए रखता है?',
  'library.lyrics.remove.busy': 'बोल हटाए जा रहे हैं…',
  'library.lyrics.remove.confirm': 'हटाएँ',
  'library.lyrics.remove.keep': 'रखें',
  'library.lyrics.remove.inSong':
    'ये बोल गाने की अपनी फ़ाइल के अंदर हैं। FluidEQ आपके गानों को कभी नहीं बदलता, इसलिए इन्हें यहाँ से हटाया नहीं जा सकता।',
  'library.lyrics.remove.failed': 'बोल हटाए नहीं जा सके।',
  'library.lyrics.remove.understood': 'ठीक है',

  'karaoke.maker.song.save': 'लाइब्रेरी में सहेजें',
  'karaoke.maker.song.saveHint':
    'इस टाइमिंग को लाइब्रेरी में गाने के बोल के रूप में सहेजें',
  'karaoke.maker.song.openedTimed':
    'लाइब्रेरी से गाने के टाइम किए गए बोलों के साथ खोला गया।',
  'karaoke.maker.song.keptTimed':
    'आप इस गाने का कराओके पहले से बना रहे थे, इसलिए यह वैसे ही खुला जैसे आपने छोड़ा था। “मूल पुनर्स्थापित करें” गाने के बोलों से फिर से शुरू करता है।',
  'karaoke.maker.song.keptPlain':
    'आप इस गाने का कराओके पहले से बना रहे थे, इसलिए यह वैसे ही खुला जैसे आपने छोड़ा था। अगर आप गाने के बोल इस्तेमाल करना चाहें, तो वे एडिटर में हैं।',
  'karaoke.maker.song.savedBeside': 'गाने के पास {name} के रूप में सहेजा गया।',
  'karaoke.maker.song.savedKept':
    'FluidEQ के बोल फ़ोल्डर में सहेजा गया: गाने के फ़ोल्डर में लिखा नहीं जा सकता।',
  'karaoke.maker.song.untimedLeftOut':
    'बिना टाइमिंग वाली पंक्तियाँ छोड़ दी गईं ({lines})।',
  'karaoke.maker.song.tagsFirst':
    'गाने के अपने टैग में भी टाइम किए गए बोल हैं, और लाइब्रेरी पहले वही दिखाती है।',
  'karaoke.maker.song.nothingTimed':
    'अभी सहेजने को कुछ नहीं: किसी पंक्ति का समय तय नहीं है।',
  'karaoke.maker.song.failed': 'बोल गाने में सहेजे नहीं जा सके।',
  'karaoke.maker.song.gone': 'यह गाना अब लाइब्रेरी में नहीं है।',
  'karaoke.maker.song.replaceTitle': '{name} बदलें?',
  'karaoke.maker.song.replaceKeptTitle': 'FluidEQ की कॉपी बदलें?',
  'karaoke.maker.song.replaceBody':
    'गाने के बोल पहले से {name} में हैं। उन्हें मेकर की टाइमिंग से बदल दिया जाएगा।',
  'karaoke.maker.song.replaceKeptBody':
    'FluidEQ इस गाने के लिए पहले से बोल रखता है। उन्हें मेकर की टाइमिंग से बदल दिया जाएगा।',
  'karaoke.maker.song.replace': 'बदलें',
} as const;

export default lyricsHandoff;
