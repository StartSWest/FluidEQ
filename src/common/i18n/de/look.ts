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
  'look.edit': 'Darstellung bearbeiten',
  'look.create': 'Darstellung erstellen',
  'look.new': 'Neue Darstellung',
  'look.close': 'Darstellungseditor schließen',
  'look.closeHint': 'Ohne Speichern schließen (Esc)',
  'look.pickForm': 'Oben eine Form wählen oder die Leertaste drücken.',
  'look.colourBy': 'Einfärben nach',
  'look.palette.cycle': 'Färbung',
  'look.palette.flat': 'Einheitlich',
  'look.palette.flatHint': 'Eine Farbe für die gesamte Form',
  'look.palette.frequency': 'Frequenz',
  'look.palette.frequencyHint':
    'Die Farbe läuft über die Achse und zeigt die Position jedes Balkens.',
  'look.palette.level': 'Pegel',
  'look.palette.levelHint':
    'Die Farbe läuft die Achse hinauf und zeigt die Lautstärke jedes Balkens.',
  'look.palette.heat': 'Hitze',
  'look.palette.heatHint': 'Die Farbe folgt der Lautstärke, von kühl bis rot.',
  'look.colours': 'Farben',
  'look.colourValue': 'Farbe {number}: {colour}',
  'look.removeColour': 'Farbe {number} entfernen',
  'look.custom': 'Benutzerdefiniert',
  'look.customColour': 'Eine andere Farbe',
  'look.reset': 'Zurücksetzen',
  'look.addColour': 'Farbe hinzufügen',
  'look.addColourHint': 'Eine Farbe am Ende des Verlaufs hinzufügen',
  'look.pieces': 'Teile',
  'look.continuous': 'Diese Form wird als durchgehende Figur gezeichnet',
  'look.attack': 'Attack',
  'look.release': 'Release',
  'look.releaseHint': 'Wie lange eine Spitze stehen bleibt, bevor sie abfällt',
  'look.drawnAs': 'Zeichenart',
  'look.filled': 'Gefüllt',
  'look.stroked': 'Kontur',
  'look.fill': 'Füllung',
  'look.weight': 'Stärke',
  'look.rainbow': 'Regenbogen',
  'look.glow': 'Leuchten',
  'look.off': 'Aus',
  'look.glowHint': 'Wie stark die Form im Takt wächst und aufleuchtet.',
  'look.glowNeedsRainbow':
    'Benötigt den Regenbogenmodus. Ohne ihn verändert Leuchten die Zeichnung nicht.',
  'look.needsRainbow': 'Benötigt den Regenbogenmodus.',
  'look.rainbowBorder': 'Regenbogenrand',
  'look.rainbowBorderHint':
    'Umrahmt das Diagramm mit einer Farbe, die das ganze Spektrum durchläuft.',
  'look.borderWeight': 'Randstärke',
  'look.litPeaks': 'Leuchtende Spitzen',
  'look.litPeakWeight': 'Spitzenstärke',
  'look.noLitPeaks': 'Diese Form hat keine leuchtenden Spitzen',
  'look.name': 'Name',
  'look.resetAll': 'Alle Einstellungen zurücksetzen',
  'look.resetAllHint': 'Alle Einstellungen auf die Vorgaben zurücksetzen',
  'look.export': 'Diese Darstellung in eine Datei exportieren',
  'look.exportHint': 'Diese Darstellung als teilbare Datei speichern',
  'look.import': 'Darstellung aus einer Datei importieren',
  'look.delete': 'Diese Darstellung löschen',
  'look.save': 'Speichern',
  'look.saveHint': 'Diese Darstellung speichern und auswählen',
  'look.full':
    'Die Liste ist voll — eine Darstellung löschen, um Platz zu schaffen',
  'look.error.emptyFile':
    'In dieser Datei wurden keine Darstellungen gefunden.',
  'look.error.readFile': 'FluidEQ konnte diese Darstellungsdatei nicht lesen.',
  'support.eyebrow': 'VÖLLIG FREIWILLIG',
  'support.petHint': 'Drücke die Leertaste, damit es hüpft',
  'support.game.hint': 'Im Takt drücken, wenn die Spitze die Linie erreicht',
  'support.game.howTo':
    'Tippe das Wesen an oder drücke bei jedem Beat die Leertaste. Bleib dran — bei ×10 passiert etwas.',
  'support.game.thanks':
    'Wenn dich davon etwas zum Lächeln gebracht hat: Ideen und Unterstützung halten das hier am Leben.',
  'support.game.noAudio': 'Spiel etwas ab, dann erscheint der Takt hier',
  'support.game.listening': 'Takt wird gesucht…',
  'support.game.share': 'Teilen',
  'support.game.shareEuphoria': 'Regenbogen teilen',
  'support.game.shareTitle': 'Teile dein Ergebnis',
  'support.game.shareUnlock':
    'Erreiche ×10 und diese Karte wird zum Regenbogenmodus – mit dem ganzen Farbspektrum.',
  'support.game.shareNote':
    'Speichere die Karte und hänge sie an deinen Beitrag an – keines dieser Netzwerke kann ein Bild aus einem Link ziehen.',
  'support.game.shareSave': 'Karte speichern',
  'support.game.shareCopyCard': 'Karte kopieren',
  'support.game.shareCardCopied': 'Kopiert — einfach einfügen',
  'support.game.shareCopy': 'Text kopieren',
  'support.game.shareCopied': 'Kopiert',
  'support.game.shareLinkOnly':
    'Teilt nur den Link – den Text fügst du selbst ein',
  'support.game.euphoria': 'Regenbogenmodus',
  'support.game.euphoriaToggle': 'Regenbogenmodus ein- oder ausschalten',
  'support.game.perfect': 'Perfekt',
  'support.game.great': 'Super',
  'support.game.good': 'Gut',
  'support.game.miss': 'Daneben',
  'support.title': 'Die Arbeit unterstützen',
  'support.close': 'Schließen',
  'support.pitch':
    'FluidEQ ist frei und quelloffen und bleibt es auch — der Quelltext ist öffentlich, Sie können ihn jederzeit kostenlos selbst bauen, und es wird nie etwas mitgeschnitten. Verkauft wird der signierte, sofort lauffähige Build. Wenn es sich einen Platz in Ihrem Setup verdient hat, finanziert ein Beitrag die Zeit, die es am Leben hält, und die nächsten Ideen aus derselben Werkstatt.',
  'support.craft':
    'Das hier ist die Arbeit eines Einzelnen, gebaut mit sehr viel Liebe und einer unvernünftigen Menge Sorgfalt im Detail. Jedes Panel ist von Hand gezeichnet und durchdiskutiert: wie sich die Kurve auf einen Blick liest, wie ein Menü aufklappt, was ein Regler tut, wenn man langsam zieht, welche Wörter auf einem Knopf stehen. Nichts davon ist eine Standardkomponente mit Anstrich.',
  'support.card': 'Karte oder Wallet',
  'support.card.hint':
    'Sichere Zahlung über Stripe. Öffnet sich im Browser — die App sieht Ihre Kartendaten nie.',
  'support.coffee': 'Spendier mir einen Kaffee',
  'support.coffee.hint':
    'Ein einmaliges Trinkgeld, ohne Konto. Klicken, um es im Browser zu öffnen, oder den Code mit dem Handy scannen.',
  'support.verify': 'Prüfen Sie die Adresse vor dem Senden.',
  'support.copy': 'Adresse kopieren',
  'support.copied': 'Kopiert',
  'support.openWallet': 'In der Wallet öffnen',
  'support.contributed': 'Ich habe beigetragen — Stern und Tanz freischalten',
  'support.thanks':
    'Danke — Ihr Begleiter hat seinen Stern, und jetzt tanzt er.',
  'support.releaseNotes': 'Sehen, was in dieser Version neu ist',
  'support.footerBefore':
    'Lieber Zeit beitragen? Issues und Pull Requests sind genauso willkommen auf',
};

export default look;
