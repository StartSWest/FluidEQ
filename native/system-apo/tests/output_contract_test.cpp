/* FluidEQ — GPL-3.0-or-later */

#include <cstdio>
#include <optional>
#include <string>

#include "../src/source_analysis.h"
#include "graph_test_support.h"

using namespace fluideq_engine;
using namespace fluideq_engine_test;

namespace {

const Endpoint kMain{L"{AAAAAAAA-1111-2222-3333-444455556666}", L"Main"};
const Endpoint kReceiver{L"{BBBBBBBB-1111-2222-3333-444455556666}", L"Receiver"};
const Endpoint kOther{L"{CCCCCCCC-1111-2222-3333-444455556666}", L"Other"};
const std::wstring kMainSuffix = L"-aaaaaaaa-1111-2222-3333-444455556666.txt";
const std::wstring kReceiverSuffix = L"-bbbbbbbb-1111-2222-3333-444455556666.txt";
const std::string kSource =
    "version=1\nkind=library\nowner=engine\nsource=0123456789abcdef\n"
    "epoch=4\nrevision=7\nendpoint={aaaaaaaa-1111-2222-3333-444455556666}\n"
    "level=-20\npeak=-3\nvoice=unavailable\n";

void output_files_never_borrow_another_outputs_settings() {
  std::printf("each endpoint reads only its own DSP, phase and treble files\n");
  Files files;
  files[L"C:\\cfg\\config.txt"] = "Preamp: -1 dB\n";
  files[L"C:\\cfg\\fluideq-dsp" + kMainSuffix] = "1 2 3\n";
  files[L"C:\\cfg\\fluideq-dsp" + kReceiverSuffix] = "4 5 6\n";
  files[L"C:\\cfg\\fluideq-eq-phase" + kMainSuffix] = "A\n";
  files[L"C:\\cfg\\fluideq-curve-phase" + kReceiverSuffix] = "A\n";
  files[L"C:\\cfg\\fluideq-eq-treble" + kMainSuffix] = "classic\n";
  files[L"C:\\cfg\\fluideq-curve-treble" + kReceiverSuffix] = "classic\n";
  // Stale global files cannot override a missing endpoint file after migration.
  files[L"C:\\cfg\\fluideq-dsp.txt"] = "9 9 9\n";
  files[L"C:\\cfg\\fluideq-eq-phase.txt"] = "A\n";
  files[L"C:\\cfg\\fluideq-curve-phase.txt"] = "A\n";
  files[L"C:\\cfg\\fluideq-eq-treble.txt"] = "classic\n";
  files[L"C:\\cfg\\fluideq-curve-treble.txt"] = "classic\n";
  const auto main = resolve_chain(L"C:\\cfg", kMain, provider(files));
  const auto receiver = resolve_chain(L"C:\\cfg", kReceiver, provider(files));
  const auto other = resolve_chain(L"C:\\cfg", kOther, provider(files));
  CHECK(main.dsp_values == std::vector<double>({1, 2, 3}));
  CHECK(receiver.dsp_values == std::vector<double>({4, 5, 6}));
  CHECK(other.dsp_values.empty());
  CHECK(!main.minimum_eq_phase && main.minimum_curve_phase);
  CHECK(receiver.minimum_eq_phase && !receiver.minimum_curve_phase);
  CHECK(other.minimum_eq_phase && other.minimum_curve_phase);
  CHECK(main.classic_eq_treble && !main.classic_curve_treble);
  CHECK(!receiver.classic_eq_treble && receiver.classic_curve_treble);
  CHECK(!other.classic_eq_treble && !other.classic_curve_treble);
}

void only_canonical_endpoint_ids_can_name_sidecars() {
  std::printf("sidecar paths accept canonical GUIDs and refuse path fragments\n");
  const auto named = endpoint_config_name(L"fluideq-room-head", kMain);
  CHECK(named && *named == L"fluideq-room-head" + kMainSuffix);
  CHECK(endpoint_config_name(L"fluideq-room-head",
      Endpoint{L"aaaaaaaa-1111-2222-3333-444455556666", {}}) == named);
  for (const auto* invalid : {L"", L"{AAAA}", L"..\\config", L"C:\\file",
      L"aaaaaaaa/1111-2222-3333-444455556666",
      L"{aaaaaaaa-1111-2222-3333-444455556666}suffix"}) {
    CHECK(!endpoint_config_name(L"fluideq-dsp", Endpoint{invalid, {}}));
  }
}

void shared_facts_follow_only_the_direct_source() {
  std::printf("only the named source and its direct receivers use its scan\n");
  const auto facts = parse_source_analysis(kSource);
  CHECK(facts && facts->source == 0x0123456789abcdefULL && facts->epoch == 4);
  const auto main = source_for_endpoint(facts, kMain, {}, true);
  const auto receiver = source_for_endpoint(facts, kReceiver, kMain.guid, true);
  const auto other = source_for_endpoint(facts, kOther, kReceiver.guid, true);
  const auto call = source_for_endpoint(facts, kMain, {}, false);
  CHECK(main.library && receiver.library && receiver.level == -20);
  CHECK(!other.library && !other.has_level && !call.library);
  auto changed = facts;
  if (!changed) return;
  changed->epoch = 44;
  changed->revision = 70;
  changed->level = -10;
  const auto still_live = source_for_endpoint(changed, kOther, kReceiver.guid, true);
  CHECK(still_live.identity == other.identity);
  CHECK(still_live.processing_identity() == other.processing_identity());
}

void malformed_source_facts_are_refused_whole() {
  std::printf("source analysis refuses duplicate, incomplete and foreign facts\n");
  CHECK(parse_source_analysis(kSource).has_value());
  for (const auto* extra : {"owner=host\n", "revision=8\n", "unknown=1\n",
                            "voiceRuntime=C:/writable/runtime.dll\n"}) {
    CHECK(!parse_source_analysis(kSource + extra));
  }
  const auto change = [](const std::string& before, const std::string& after) {
    auto text = kSource;
    const auto at = text.find(before);
    CHECK(at != std::string::npos);
    if (at != std::string::npos) text.replace(at, before.size(), after);
    return parse_source_analysis(text);
  };
  CHECK(!change("version=1", "version=2"));
  CHECK(!change("source=0123456789abcdef", "source=0000000000000000"));
  CHECK(!change("peak=-3\n", ""));
  CHECK(!change("level=-20", "level=nan"));
  CHECK(!change("epoch=4", "epoch=9007199254740992"));
  CHECK(!change("voice=unavailable", "voice=available"));
  CHECK(!parse_source_analysis(kSource + "noise=1 2 3\n"));
  std::string noise = "noise=";
  for (int at = 0; at < 63; ++at) noise += "0 ";
  CHECK(parse_source_analysis(kSource + noise + "\n").has_value());
  CHECK(!parse_source_analysis(kSource + noise + "0\n"));
}

}  // namespace

int main() {
  output_files_never_borrow_another_outputs_settings();
  only_canonical_endpoint_ids_can_name_sidecars();
  shared_facts_follow_only_the_direct_source();
  malformed_source_facts_are_refused_whole();
  return report();
}
