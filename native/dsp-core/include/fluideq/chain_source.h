/* FluidEQ — GPL-3.0-or-later */
#ifndef FLUIDEQ_CHAIN_SOURCE_H
#define FLUIDEQ_CHAIN_SOURCE_H

#include "fluideq/chain.h"

#ifdef __cplusplus
extern "C" {
#endif

/* Source facts, never gains or controls copied from another output. Pointers
   are borrowed only for prepare_source_analysis, which copies/loads them. */
typedef struct FeqChainSourceAnalysis {
  uint32_t version;
  int library;
  uint64_t source_id;
  uint64_t epoch;
  uint64_t revision;
  int has_level;
  double integrated_lufs;
  double true_peak_dbtp;
  const FeqNoiseProfile* noise;
  const char* voice_model_path;
  const char* voice_runtime_path;
} FeqChainSourceAnalysis;

typedef struct FeqChainSourceStatus {
  int ready;
  int voice_ready;
} FeqChainSourceStatus;

/* CONTROL thread, on a fresh UNPUBLISHED chain after configure/room setup.
   May allocate, load the model and start its worker. Never on a playing rack.
   Derives the Library's linked gains from this chain's own settings; even an
   unanalysed Library source uses the Library path (unity until analysed), not
   a live leveler. Live sources keep independent endpoint leveling memory.
   A present model which cannot load returns 0: the caller must keep the old
   owner, not advertise an incomplete Library path as ready.
   The caller still calls feq_chain_wake_workers after each rendered period. */
int feq_chain_prepare_source_analysis(FeqChain* chain,
    const FeqChainSourceAnalysis* source, FeqLevelingMemory* live_memory,
    FeqChainSourceStatus* status);

#ifdef __cplusplus
}
#endif
#endif
