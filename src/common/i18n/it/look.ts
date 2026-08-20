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

/** The Look Designer, the support panel, the creature and its game. */
import { Dictionary } from '../en';

const look: Partial<Dictionary> = {
  'look.edit': 'Modifica aspetto',
  'look.create': 'Crea aspetto',
  'look.new': 'Nuovo aspetto',
  'look.close': 'Chiudi l’editor dell’aspetto',
  'look.closeHint': 'Chiudi senza salvare (Esc)',
  'look.pickForm': 'Scegli la forma dal selettore sopra o premi Spazio.',
  'look.colourBy': 'Colora per',
  'look.palette.cycle': 'Colorazione',
  'look.palette.flat': 'Uniforme',
  'look.palette.flatHint': 'Un colore per tutta la figura',
  'look.palette.frequency': 'Frequenza',
  'look.palette.frequencyHint':
    'Il colore percorre l’asse e indica la posizione di ogni barra.',
  'look.palette.level': 'Livello',
  'look.palette.levelHint':
    'Il colore sale lungo l’asse e indica l’intensità di ogni barra.',
  'look.palette.heat': 'Calore',
  'look.palette.heatHint': 'Il colore segue il volume, dal freddo al rosso.',
  'look.colours': 'Colori',
  'look.colourValue': 'Colore {number}: {colour}',
  'look.removeColour': 'Rimuovi colore {number}',
  'look.custom': 'Personalizzato',
  'look.customColour': 'Qualsiasi altro colore',
  'look.reset': 'Ripristina',
  'look.addColour': 'Aggiungi colore',
  'look.addColourHint': 'Aggiungi un colore alla fine della sfumatura',
  'look.pieces': 'Elementi',
  'look.gap': 'Spaziatura',
  'look.continuous': 'Questa forma viene disegnata come figura continua',
  'look.attack': 'Attacco',
  'look.release': 'Rilascio',
  'look.releaseHint': 'Quanto resta un picco prima di scendere',
  'look.drawnAs': 'Disegno',
  'look.filled': 'Riempito',
  'look.stroked': 'Contorno',
  'look.fill': 'Riempimento',
  'look.weight': 'Spessore',
  'look.rainbow': 'Arcobaleno',
  'look.glow': 'Bagliore',
  'look.off': 'Disattivato',
  'look.glowHint': 'Quanto la figura cresce e si illumina a ritmo.',
  'look.glowNeedsRainbow':
    'Richiede la modalità Arcobaleno. Se è spenta, il bagliore non cambia il disegno.',
  'look.needsRainbow': 'Richiede la modalità Arcobaleno.',
  'look.rainbowBorder': 'Bordo arcobaleno',
  'look.rainbowBorderHint':
    'Circonda il grafico con un colore che percorre l’intero spettro.',
  'look.borderWeight': 'Spessore bordo',
  'look.litPeaks': 'Picchi luminosi',
  'look.litPeakWeight': 'Spessore del picco',
  'look.peakStyle': 'Segno',
  'look.peak.bead': 'Riquadro',
  'look.peak.cap': 'Cappuccio',
  'look.peak.ring': 'Anello',
  'look.peak.spark': 'Scintilla',
  'look.peak.chevron': 'Gallone',
  'look.peak.halo': 'Alone',
  'look.peak.pin': 'Spillo',
  'look.peak.crown': 'Corona',
  'look.peak.cross': 'Croce',
  'look.peak.wave': 'Onda',
  'look.noLitPeaks': 'Questa forma non ha punte luminose',
  'look.name': 'Nome',
  'look.resetAll': 'Ripristina tutte le impostazioni',
  'look.resetAllHint': 'Ripristina le impostazioni originali della forma',
  'look.export': 'Esporta questo aspetto in un file',
  'look.exportHint': 'Salva questo aspetto in un file condivisibile',
  'look.import': 'Importa un aspetto da un file',
  'look.delete': 'Elimina questo aspetto',
  'look.save': 'Salva',
  'look.saveHint': 'Salva e seleziona questo aspetto',
  'look.full': 'L’elenco è pieno — elimina un aspetto per fare spazio',
  'look.error.emptyFile': 'Nessun aspetto trovato in questo file.',
  'look.error.readFile':
    'FluidEQ non ha potuto leggere questo file di aspetto.',
  'support.eyebrow': 'DEL TUTTO FACOLTATIVO',
  'support.petHint': 'Premi spazio per farlo saltare',
  'support.game.hint': 'Premi a tempo quando il picco raggiunge la linea',
  'support.game.howTo':
    'Tocca la creatura o premi spazio a ogni battito. Continua così e a ×10 succede qualcosa.',
  'support.game.thanks':
    'Se qualcosa qui ti ha strappato un sorriso, idee e sostegno sono ciò che lo tiene vivo.',
  'support.game.noAudio': 'Metti della musica e il ritmo comparirà qui',
  'support.game.listening': 'Cerco il ritmo…',
  'support.game.share': 'Condividi',
  'support.game.shareEuphoria': "Condividi l'arcobaleno",
  'support.game.shareTitle': 'Condividi il tuo punteggio',
  'support.game.shareUnlock':
    'Arriva a ×10 e questa scheda diventa modalità arcobaleno, spettro incluso.',
  'support.game.shareNote':
    "Salva la scheda e allegala al post: nessuna di queste reti può ricavare un'immagine da un link.",
  'support.game.shareSave': 'Salva scheda',
  'support.game.shareCopyCard': 'Copia scheda',
  'support.game.shareCardCopied': 'Copiata — incollala',
  'support.game.shareCopy': 'Copia testo',
  'support.game.shareCopied': 'Copiato',
  'support.game.shareLinkOnly':
    'Condivide solo il link: incolla il testo tu stesso',
  'support.game.euphoria': 'Modalità arcobaleno',
  'support.game.euphoriaToggle': 'Attiva o disattiva la modalità arcobaleno',
  'support.game.perfect': 'Perfetto',
  'support.game.great': 'Ottimo',
  'support.game.good': 'Bene',
  'support.game.miss': 'Mancato',
  'support.title': 'Sostieni il lavoro',
  'support.close': 'Chiudi',
  'support.pitch':
    'FluidEQ è libero e open source, e resterà così: il codice è pubblico, puoi sempre compilarlo da solo gratuitamente, e non viene mai tracciato niente. Ciò che si vende è la build firmata, pronta all’uso. Se si è guadagnato un posto nel tuo impianto, un contributo finanzia il tempo che lo tiene in vita e le prossime idee che escono dalla stessa bottega.',
  'support.craft':
    'Questo è il lavoro di una persona sola, fatto con tantissimo amore e una cura per i dettagli poco ragionevole. Ogni pannello è disegnato a mano e discusso: come si legge la curva a colpo d’occhio, come si apre un menu, cosa fa una manopola quando la giri piano, quali parole finiscono su un pulsante. Qui non c’è nessun componente preconfezionato con sopra un tema.',
  'support.card': 'Carta o wallet',
  'support.card.hint':
    'Pagamento sicuro ospitato da Stripe. Si apre nel browser: l’app non vede mai i dati della tua carta.',
  'support.coffee': 'Offrimi un caffè',
  'support.coffee.hint':
    'Una mancia una tantum, senza account. Clicca per aprirlo nel browser oppure scansiona il codice col telefono.',
  'support.verify': 'Verifica l’indirizzo prima di inviare.',
  'support.copy': 'Copia l’indirizzo',
  'support.copied': 'Copiato',
  'support.openWallet': 'Apri nel wallet',
  'support.contributed': 'Ho contribuito — sblocca la stella e il ballo',
  'support.thanks':
    'Grazie — il tuo animaletto ha la sua stella, e adesso balla.',
  'support.releaseNotes': 'Guarda le novità di questa versione',
  'support.footerBefore':
    'Preferisci contribuire con il tempo? Issue e pull request sono altrettanto benvenute su',
};

export default look;
