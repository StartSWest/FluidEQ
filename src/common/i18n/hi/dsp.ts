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

const dsp = {
  'dsp.title': 'DSP',
  'dsp.scopeNotice':
    'यह केवल FluidEQ के भीतर चल रहे संगीत पर लागू होता है। Spotify, YouTube या दूसरे ऐप्स नहीं बदलते।',
  'dsp.idle':
    'जब आप लाइब्रेरी से कुछ चलाते हैं तब शुरू होता है। यह FluidEQ के अपने प्लेयर को प्रोसेस करता है, इसलिए ट्रैक लोड होने तक इसे कुछ नहीं करना।',
  'dsp.unavailable':
    'ऑडियो प्रोसेसिंग शुरू नहीं हो सकी। प्लेबैक पर कोई असर नहीं पड़ता।',
  'dsp.presets': 'प्रीसेट',
  'dsp.preset.flat': 'बंद',
  'dsp.preset.lossyRepair': 'संपीड़ित को सुधारें',
  'dsp.preset.loud': 'तेज़',
  'dsp.enabled': 'चालू',

  'dsp.eq.title': 'इक्वलाइज़र',
  'dsp.eq.description':
    'छह पैरामीट्रिक बैंड, जैसा फ़िल्टर वास्तव में प्रतिक्रिया देते हैं वैसा खींचा गया, न कि जैसा माँगा गया था।',
  'dsp.eq.shape': 'बैंड का प्रकार',
  'dsp.eq.bandOff': 'बंद',
  'dsp.eq.frequency': 'आवृत्ति',
  'dsp.eq.gain': 'गेन',
  'dsp.eq.quality': 'चौड़ाई',

  'dsp.exciter.title': 'एक्साइटर',
  'dsp.exciter.description':
    'लॉसी एनकोडर द्वारा हटाए गए ऊँचे हार्मोनिक्स बनाता है। यह उन्हें गढ़ता है, वापस नहीं लाता।',
  'dsp.exciter.crossover': 'इससे ऊपर',
  'dsp.exciter.drive': 'ड्राइव',
  'dsp.exciter.mix': 'मात्रा',

  'dsp.compressor.title': 'मल्टीबैंड कंप्रेसर',
  'dsp.compressor.description':
    'तीन फ़्रीक्वेंसी बैंड में अलग-अलग स्तर को बराबर करता है।',
  'dsp.compressor.band.low': 'लो',
  'dsp.compressor.band.mid': 'मिड',
  'dsp.compressor.band.high': 'हाई',
  'dsp.compressor.crossoverLow': 'लो / मिड विभाजन',
  'dsp.compressor.crossoverHigh': 'मिड / हाई विभाजन',
  'dsp.compressor.threshold': 'थ्रेशोल्ड',
  'dsp.compressor.ratio': 'अनुपात',
  'dsp.compressor.attack': 'अटैक',
  'dsp.compressor.release': 'रिलीज़',
  'dsp.compressor.makeup': 'मेकअप',

  'dsp.maximizer.title': 'मैक्सिमाइज़र',
  'dsp.maximizer.description':
    'शिखरों को सीमा से ऊपर जाने दिए बिना कुल स्तर बढ़ाता है।',
  'dsp.maximizer.ceiling': 'सीमा',
  'dsp.maximizer.lookAhead': 'लुक-अहेड',
  'dsp.maximizer.release': 'रिलीज़',
  'dsp.maximizer.headroomHint':
    'सीमा उन {gain} dB के लिए जगह छोड़ती है जो आपका आउटपुट प्रोफ़ाइल इसके बाद जोड़ता है।',

  'tabs.dsp': 'DSP',
};

export default dsp;
