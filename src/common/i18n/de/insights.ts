/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

const insights = {
  'insights.tab': 'Favoriten',
  'insights.loading': 'Die Szenen, die Mitglieder ansehen, werden geladen',
  'insights.period': 'Zeitraum',
  'insights.period.week': '7 Tage',
  'insights.period.month': '30 Tage',
  'insights.period.quarter': '90 Tage',
  'insights.period.all': 'Gesamter Zeitraum',
  'insights.favourites.hint':
    'Jede Szene, die im Zeitraum abgespielt, hinzugefügt oder mit „Gefällt mir“ markiert wurde, sortiert danach, wie viele Personen sie abgespielt haben, dann nach der Zeit auf dem Bildschirm. Ihre eigenen Tests sind nicht enthalten.',
  'insights.favourites.summary': '{scenes} Szenen, abgespielt für {time}',
  'insights.favourites.empty':
    'In diesem Zeitraum wurde keine Szene abgespielt, hinzugefügt oder mit „Gefällt mir“ markiert.',
  'insights.favourites.kinds': 'Zeit auf dem Bildschirm nach Art',
  'insights.favourites.noPlays':
    'In diesem Zeitraum wurde noch nichts abgespielt.',
  'insights.favourites.advice':
    '{kind} hat {share} der gesamten Anzeigezeit, verteilt auf {count} Szenen. Mehr Szenen aus {kind} sind die sicherste Wahl.',
  'insights.col.rank': 'Rang',
  'insights.col.scene': 'Szene',
  'insights.col.people': 'Personen',
  'insights.col.time': 'Zeit',
  'insights.col.perPerson': 'Pro Person',
  'insights.col.adds': 'Hinzugefügt',
  'insights.col.likes': '„Gefällt mir“',
  'insights.account.title': 'Szenen',
  'insights.account.empty':
    'Noch keine Szene hinzugefügt, mit „Gefällt mir“ markiert oder abgespielt. Die Wiedergabezeit wird gezählt, sobald das Mitglied diese Version von FluidEQ verwendet und die aktualisierten Bedingungen gesehen hat.',
  'insights.account.played': 'Abgespielte Szenen',
  'insights.account.time': 'Auf dem Bildschirm',
  'insights.account.added': 'Hinzugefügt',
  'insights.account.liked': 'Mit „Gefällt mir“',
  'insights.account.kind': 'Lieblingsart',
  'insights.account.notPlayed': 'Nicht abgespielt',
  'insights.account.days': '{days} Tage · zuletzt am {date}',
  'insights.by': 'von {maker}',
  'insights.byFluidEQ': 'von FluidEQ',
  'insights.member': 'ein Mitglied',
  'insights.chip.added': 'Hinzugefügt am {date}',
  'insights.chip.liked': '„Gefällt mir“',
  'insights.kind.other': 'Keine Kategorie',
  'insights.time.hoursMinutes': '{hours} {minutes}',
  'insights.error.offline':
    'FluidEQ konnte seinen Server nicht erreichen. Prüfen Sie Ihre Verbindung und versuchen Sie es erneut.',
  'insights.error.signedOut': 'Melden Sie sich erneut an, um das zu sehen.',
  'insights.error.server':
    'Das konnte nicht geladen werden. Versuchen Sie es erneut.',
  'insights.error.forbidden': 'Nur der Admin von FluidEQ kann das sehen.',
  'insights.error.notDeployed':
    'Der Server hat das noch nicht. Es kommt mit dem Server-Update, das zu dieser Version von FluidEQ gehört.',
} as const;

export default insights;
