/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

export default {
  'dsp.dynamics.appliedGain': 'लागू गेन',
  'dsp.dynamics.graphHint':
    'Dynamics से पहले और बाद का संगीत। बढ़ाने पर गेन कर्व ऊपर और दबाने पर नीचे जाता है।',
  'dsp.dynamics.engineLiveOld':
    'Dynamics की लाइव हलचल देखने के लिए इंजन अपडेट करें। ध्वनि पहले से प्रोसेस हो रही है।',
  'dsp.dynamics.title': 'डायनेमिक्स',
  'dsp.dynamics.description':
    'धीमी आवाज़ को उठाता है और तेज़ आवाज़ को थामता है, तीन बैंड में, ताकि एक फुसफुसाहट और एक धमाका बीच में मिलें। यह कोई देरी नहीं जोड़ता।',
  'dsp.dynamics.engineOld':
    'डायनेमिक्स को सबसे नया FluidEQ Engine चाहिए। रैक का बाकी हिस्सा चल रहा है; इंजन अपडेट होते ही यह फ़िल्टर शुरू होगा।',
  'dsp.dynamics.graphLabel': 'हर बैंड अपने स्तर के साथ क्या करता है',
  'dsp.dynamics.band.low': 'लो',
  'dsp.dynamics.band.lowHint': '150 Hz से नीचे: धमाके की गूंज, किक, इंजन।',
  'dsp.dynamics.band.mid': 'मिड',
  'dsp.dynamics.band.midHint':
    '150 Hz से 4 kHz: आवाज़ें, क़दम और ज़्यादातर ध्वनि।',
  'dsp.dynamics.band.high': 'हाई',
  'dsp.dynamics.band.highHint': '4 kHz से ऊपर: बारीकी, हवा, क़दम की धार।',
  'dsp.dynamics.lift': 'उठाना',
  'dsp.dynamics.hold': 'थामना',
  'dsp.dynamics.upThreshold': 'इससे नीचे',
  'dsp.dynamics.upRatio': 'अनुपात',
  'dsp.dynamics.upMax': 'अधिकतम',
  'dsp.dynamics.downThreshold': 'इससे ऊपर',
  'dsp.dynamics.downRatio': 'अनुपात',
  'dsp.dynamics.timing': 'समय और स्तर',
  'dsp.dynamics.timingHint':
    'थामना कितनी जल्दी आता है और उठाना कितनी जल्दी लौटता है, और नतीजा कितना तेज़ है।',
  'dsp.dynamics.attack': 'अटैक',
  'dsp.dynamics.release': 'रिलीज़',
  'dsp.dynamics.makeup': 'मेकअप',
  'dsp.dynamics.mix': 'मिक्स',
  'dsp.dynamicsPreset.gentle': 'हल्का संतुलन',
  'dsp.dynamicsPreset.speech': 'बोलचाल',
  'dsp.gamingPreset.quietLift': 'धीमी आवाज़ उठाएँ',
  'dsp.gamingPreset.blastGuard': 'धमाकों से बचाव',
  'dsp.gamingPreset.longSession': 'लंबा सेशन',
  'dsp.gamingPreset.competitiveLight': 'हल्का कॉम्पिटिटिव',
};
