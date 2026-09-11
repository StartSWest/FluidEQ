const engineHealth = {
  'engineHealth.offTitle': 'FluidEQ इंजन {device} पर नहीं चल रहा',
  'engineHealth.offBody':
    'इस आउटपुट पर आवाज़ आपके EQ के बिना चल रही है। Windows ऑडियो फिर से चालू करने से आमतौर पर इंजन लौट आता है, और तब तक FluidEQ में बाकी सब काम करता रहता है।',
  'engineHealth.partlyOff': 'आंशिक रूप से बंद',
  'engineHealth.problemsTitle':
    'आपकी आवाज़ का कुछ हिस्सा {device} तक नहीं पहुँच रहा',
  'engineHealth.problem.convolution':
    'कन्वोल्यूशन बंद है: इंजन इम्पल्स रिस्पॉन्स लोड नहीं कर सका। कोई दूसरी फ़ाइल आज़माएँ।',
  'engineHealth.problem.graphic-eq':
    'ग्राफ़िक EQ बंद है: इंजन उसका कर्व नहीं बना सका।',
  'engineHealth.problem.dsp-rack':
    'DSP इफ़ेक्ट बंद हैं: इंजन उन्हें शुरू नहीं कर सका।',
  'engineHealth.problem.reload-failed':
    'आपका पिछला बदलाव लोड नहीं हुआ, इसलिए उससे पहले वाला अभी भी चल रहा है।',
  'engineHealth.problem.unwatched':
    'इस आउटपुट के लिए आप जो बदलाव करते हैं, वे इंजन को नहीं दिखते।',
  'engineHealth.problem.other': 'इंजन से कहा गया कोई और काम नहीं चल रहा।',
  'engineHealth.useApo': 'Equalizer APO इस्तेमाल करें…',
} as const;

export default engineHealth;
