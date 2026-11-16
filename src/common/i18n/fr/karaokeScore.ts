/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/** Karaoke's singing score: the verdicts, the line rows and the end card. */
import { Dictionary } from '../en';

const karaokeScore: Partial<Dictionary> = {
  'karaoke.score.title': 'Score',
  'karaoke.score.verdictPerfect': 'Parfait',
  'karaoke.score.verdictGood': 'Bien',
  'karaoke.score.verdictLate': 'En retard',
  'karaoke.score.verdictLow': 'Trop bas',
  'karaoke.score.verdictHigh': 'Trop haut',
  'karaoke.score.verdictMissed': 'Manquée',
  'karaoke.score.verdictSkipped': 'Non notée',
  'karaoke.score.octaveMark': '{verdict} · 8ve',
  'karaoke.score.ratingExcellent': 'Excellent',
  'karaoke.score.ratingGreat': 'Très bien',
  'karaoke.score.ratingGood': 'Bien',
  'karaoke.score.ratingFair': 'Passable',
  'karaoke.score.ratingPractice': 'À retravailler',
  'karaoke.score.lineNumber': 'Ligne {number}',
  'karaoke.score.lineWithText': '{line}, « {text} »',
  'karaoke.score.practiseLine': '{line} : la rechanter',
  'karaoke.score.outOf': 'sur {max}',
  'karaoke.score.streak': 'Série',
  'karaoke.score.openReport': 'Voir les résultats',
  'karaoke.score.close': 'Fermer le résultat',
  'karaoke.score.recapTitle': 'Résumé',
  'karaoke.score.bestFirst': 'Votre premier score sur cette chanson',
  'karaoke.score.bestNew': 'Nouveau record · +{delta}',
  'karaoke.score.bestTied': 'Égal à votre record',
  'karaoke.score.bestBehind': 'À {delta} de votre record',
  'karaoke.score.inTune': 'Justesse',
  'karaoke.score.inTuneNote': 'du temps chanté dans la note',
  'karaoke.score.onTime': 'En rythme',
  'karaoke.score.onTimeNote': '{count} notes sur {total} entrées à temps',
  'karaoke.score.notes': 'Notes',
  'karaoke.score.notesNote': 'réussies',
  'karaoke.score.hardestTitle': 'Le plus difficile',
  'karaoke.score.hardestLow':
    '{line} : vous étiez environ {cents} cents trop bas.',
  'karaoke.score.hardestHigh':
    '{line} : vous étiez environ {cents} cents trop haut.',
  'karaoke.score.hardestLate':
    '{line} : vous êtes entré en retard sur ses notes.',
  'karaoke.score.hardestMissed':
    '{line} : certaines de ses notes n’ont pas été chantées.',
  'karaoke.score.hardestLowest': '{line} a obtenu le moins, avec {percent}.',
  'karaoke.score.tipTitle': 'Pour la prochaine fois',
  'karaoke.score.tipLow':
    'Pensez la note un peu plus haut avant de la chanter, et gardez votre souffle jusqu’au bout pour qu’elle ne retombe pas.',
  'karaoke.score.tipHigh':
    'Détendez la gorge et chantez un peu plus doucement : forcer pour chanter fort fait monter la note.',
  'karaoke.score.tipLate':
    'Respirez avant la ligne, pas sur son premier mot, pour que la première note parte dans le temps.',
  'karaoke.score.tipMissed':
    'Apprenez les paroles des lignes restées muettes et chantez-les doucement avec l’enregistrement avant de donner toute votre voix.',
  'karaoke.score.tipOctave':
    'Vous avez chanté une bonne partie à une octave d’écart, et cela compte. Pour rejoindre l’enregistrement, essayez quelques lignes dans son octave.',
  'karaoke.score.tipClean':
    'Un chant juste du début à la fin. Essayez une chanson plus difficile, ou celle-ci sans le son de la mélodie.',
  'karaoke.score.practisePassage': 'Travailler ce passage',
  'karaoke.score.singAgain': 'Rechanter',
  'karaoke.score.mapTitle': 'Carte de la chanson',
  'karaoke.score.mapSummary': '{points} points · {inTune} de justesse',
  'karaoke.score.mapCanvas':
    'Chaque note de la chanson dans la couleur de son verdict',
  'karaoke.score.deltaTitle': 'Par rapport à votre meilleure tentative',
  'karaoke.score.historyTitle': 'Vos dernières tentatives',
  'karaoke.score.historyNow': 'Maintenant',
  'karaoke.score.historyBest': 'Votre record',
  'karaoke.score.progressTitle': 'Vos progrès',
  'karaoke.score.progressFirst':
    'Votre premier passage sur cette chanson : voici le score à battre.',
  'karaoke.score.progressSame':
    'Chaque ligne est restée au niveau de votre meilleure tentative.',
  'karaoke.score.progressUp':
    '{line} a le plus progressé depuis votre meilleure tentative ({delta} points).',
  'karaoke.score.progressDown':
    '{line} a reculé par rapport à votre meilleure tentative ({delta}). Travaillez-la seule deux ou trois fois, puis rechantez toute la chanson.',
  'karaoke.score.progressUpDown':
    '{up} a le plus progressé depuis votre meilleure tentative ({delta} points). {down} a reculé : travaillez-la seule deux ou trois fois, puis rechantez toute la chanson.',
};

export default karaokeScore;
