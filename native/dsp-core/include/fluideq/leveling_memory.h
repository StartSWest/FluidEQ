/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/
/*
 * What live leveling knows about the programme, kept outside any one chain.
 *
 * Windows locks and unlocks an output's effect whenever a stream starts, stops
 * or changes format — eight times in thirteen minutes of ordinary listening on
 * the machine this was written for — and every lock builds a new chain. A
 * leveler that lived only inside its chain relearned from unity each time, so
 * the volume jumped back up in the middle of a song it had already settled.
 * The memory outlives the chains: each one adopts what the last one learned
 * and publishes what it learns in turn.
 *
 * It is also how the song reaches the audio thread. The host announces a song
 * by an identity it chose (the app hashes the player, title and artist) and,
 * when the song has been heard before, the level it was measured at, so a
 * known song is levelled from its first second instead of after its loudest
 * passage has already gone by too loud.
 *
 * Lock-free on the audio side: announcements are read and learned state is
 * published through sequence counters, never a lock.
 */
#ifndef FLUIDEQ_LEVELING_MEMORY_H
#define FLUIDEQ_LEVELING_MEMORY_H
#include <stdint.h>
#ifdef __cplusplus
extern "C" {
#endif
typedef struct FeqLevelingMemory FeqLevelingMemory;
typedef struct FeqSongLevel {
  uint64_t song_id;          /* 0 when the programme had no song identity */
  double level_lufs;         /* loudest settled short-term loudness heard */
  double peak_db;            /* loudest true peak heard */
  double foreground_seconds; /* seconds of music the level was learned from */
} FeqSongLevel;
FeqLevelingMemory* feq_leveling_memory_create(void);
/* Only once no chain the memory was attached to can process again. */
void feq_leveling_memory_destroy(FeqLevelingMemory* memory);
/*
 * Control thread. Announce the programme now playing: a song identity, or 0
 * for a source that has none. `known_level_lufs` and `known_peak_db` are what
 * an earlier play measured, or anything below -100 when it has not been heard.
 * Returns 1 when this differs from the song last announced, 0 when the same
 * song was announced again (every instance on an output reads the same file).
 */
int feq_leveling_memory_begin_song(FeqLevelingMemory* memory, uint64_t song_id,
                                   double known_level_lufs, double known_peak_db);
/*
 * Any thread. What the leveler has learned about the song it is on, settled a
 * couple of seconds behind the audio so the first moments of the next song do
 * not count towards the last one. Returns 0 when nothing has been learned.
 */
int feq_leveling_memory_read_song(const FeqLevelingMemory* memory, FeqSongLevel* out);
#ifdef __cplusplus
}
#endif
#endif
