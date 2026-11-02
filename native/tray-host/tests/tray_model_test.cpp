/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

// What the tray reads and what it does on disk: main's words, the names of
// the files a quit takes away, and the quit recipe carried out in a folder
// of its own, beside files it must leave alone.

#include <cstdio>
#include <string>
#include <vector>

#include "tray_host.h"
#include "tray_model.h"

namespace {

namespace json = feq::share::json;
namespace tray = feq::tray;

int failures = 0;

void check(bool ok, const std::string& what) {
  if (!ok) {
    std::printf("FAIL: %s\n", what.c_str());
    ++failures;
  }
}

constexpr char kGuid[] = "0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d";

// --- what main tells the tray ---------------------------------------------

void reads_state() {
  const auto message = json::parse(
      R"({"type":"state","tooltip":"FluidEQ — ñ","icon":"C:\\a\\icon.ico",)"
      R"("menu":[{"id":"open","label":"Abrir FluidEQ","icon":"C:\\a\\icon.ico",)"
      R"("separatorAfter":true},{"id":"","label":"no id"},{"label":"none"},)"
      R"({"id":"quit","label":"Salir"}]})");
  const auto state = message ? tray::parse_state(*message) : std::nullopt;
  check(state.has_value(), "a state message is read");
  if (!state) {
    return;
  }
  check(state->tooltip == L"FluidEQ \u2014 \u00f1", "the tooltip arrives as UTF-16");
  check(state->icon == L"C:\\a\\icon.ico", "the icon's path is kept");
  check(state->menu.size() == 2 && state->menu[0].id == "open" &&
            state->menu[0].separator_after && state->menu[1].id == "quit" &&
            !state->menu[1].separator_after && state->menu[1].icon.empty(),
        "items with an id are kept in order, with their separators");
  const auto other = json::parse(R"({"type":"leaving"})");
  check(!tray::parse_state(*other) && !tray::parse_recipe(*other),
        "another message is neither a state nor a recipe");
}

void reads_recipe() {
  const auto message = json::parse(
      R"({"type":"recipe","recipe":{"configDir":"C:\\cfg","rootName":"fluideq.txt",)"
      R"("rootText":"# off\r\n","removeNames":["fluideq-dsp.txt",4],)"
      R"("removePrefixes":["fluideq-dsp-"]}})");
  const auto read = message ? tray::parse_recipe(*message) : std::nullopt;
  check(read && read->recipe && read->recipe->config_dir == L"C:\\cfg" &&
            read->recipe->root_name == L"fluideq.txt" &&
            read->recipe->root_text == "# off\r\n" &&
            read->recipe->remove_names.size() == 1 &&
            read->recipe->remove_prefixes.size() == 1,
        "the recipe is read, and a name that is not a string dropped");
  check(!tray::parse_state(*message), "a recipe is not a state");

  const auto none = json::parse(R"({"type":"recipe"})");
  const auto taken_back = tray::parse_recipe(*none);
  check(taken_back && !taken_back->recipe, "a recipe message with none says so");
  const auto no_folder =
      json::parse(R"({"type":"recipe","recipe":{"rootName":"fluideq.txt"}})");
  check(!tray::parse_recipe(*no_folder)->recipe, "a recipe with no folder is none");
  const auto no_root =
      json::parse(R"({"type":"recipe","recipe":{"configDir":"C:\\cfg"}})");
  check(!tray::parse_recipe(*no_root)->recipe, "a recipe with no root is none");
}

void names_output_files() {
  const std::vector<std::wstring> prefixes{L"fluideq-dsp-", L"fluideq-room-head-"};
  const std::wstring guid(kGuid, kGuid + 36);
  check(tray::is_output_file(L"fluideq-dsp-" + guid + L".txt", prefixes),
        "a prefix and a canonical endpoint id");
  check(tray::is_output_file(L"FLUIDEQ-ROOM-HEAD-0A1B2C3D-4E5F-4A6B-8C7D-9E0F1A2B3C4D.TXT",
                             prefixes),
        "in any case, as Windows names it");
  check(!tray::is_output_file(L"fluideq-dsp-" + guid.substr(1) + L".txt", prefixes),
        "one character short is not an endpoint");
  check(!tray::is_output_file(L"fluideq-dsp-" + guid + L"0.txt", prefixes),
        "one character long is not an endpoint");
  check(!tray::is_output_file(L"fluideq-dsp-0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4g.txt",
                              prefixes),
        "a letter past f is not hexadecimal");
  check(!tray::is_output_file(L"fluideq-dsp-0a1b2c3d04e5f-4a6b-8c7d-9e0f1a2b3c4d.txt",
                              prefixes),
        "a dash where a dash belongs");
  check(!tray::is_output_file(L"fluideq-dsp-" + guid + L".bak", prefixes),
        "only text files");
  check(!tray::is_output_file(L"fluideq-eq-phase-" + guid + L".txt", prefixes),
        "only the recipe's prefixes");
  check(!tray::is_output_file(L"fluideq-dsp.txt", prefixes), "not the shared file");
}

// --- the quit recipe, on disk ---------------------------------------------

std::wstring fresh_folder() {
  wchar_t base[MAX_PATH + 1]{};
  GetTempPathW(MAX_PATH, base);
  const std::wstring folder =
      std::wstring(base) + L"fluideq-tray-test-" + std::to_wstring(GetCurrentProcessId());
  CreateDirectoryW(folder.c_str(), nullptr);
  return folder;
}

void put(const std::wstring& path, const std::string& text) {
  const HANDLE file = CreateFileW(path.c_str(), GENERIC_WRITE, 0, nullptr,
                                  CREATE_ALWAYS, FILE_ATTRIBUTE_NORMAL, nullptr);
  DWORD written = 0;
  WriteFile(file, text.data(), static_cast<DWORD>(text.size()), &written, nullptr);
  CloseHandle(file);
}

bool exists(const std::wstring& path) {
  return GetFileAttributesW(path.c_str()) != INVALID_FILE_ATTRIBUTES;
}

std::string text_of(const std::wstring& path) {
  const HANDLE file = CreateFileW(path.c_str(), GENERIC_READ, FILE_SHARE_READ,
                                  nullptr, OPEN_EXISTING, 0, nullptr);
  if (file == INVALID_HANDLE_VALUE) {
    return "<missing>";
  }
  std::string text(4096, '\0');
  DWORD read = 0;
  ReadFile(file, text.data(), static_cast<DWORD>(text.size()), &read, nullptr);
  CloseHandle(file);
  text.resize(read);
  return text;
}

std::vector<std::wstring> names_in(const std::wstring& folder) {
  std::vector<std::wstring> names;
  WIN32_FIND_DATAW found{};
  const HANDLE search = FindFirstFileW((folder + L"\\*").c_str(), &found);
  if (search == INVALID_HANDLE_VALUE) {
    return names;
  }
  do {
    const std::wstring name = found.cFileName;
    if (name != L"." && name != L"..") {
      names.push_back(name);
    }
  } while (FindNextFileW(search, &found) != FALSE);
  FindClose(search);
  return names;
}

void remove_folder(const std::wstring& folder) {
  for (const auto& name : names_in(folder)) {
    const std::wstring path = folder + L"\\" + name;
    if ((GetFileAttributesW(path.c_str()) & FILE_ATTRIBUTE_DIRECTORY) != 0) {
      RemoveDirectoryW(path.c_str());
    } else {
      DeleteFileW(path.c_str());
    }
  }
  RemoveDirectoryW(folder.c_str());
}

void carries_out_the_recipe() {
  const std::wstring folder = fresh_folder();
  const std::wstring guid(kGuid, kGuid + 36);
  const auto at = [&folder](const std::wstring& name) { return folder + L"\\" + name; };
  put(at(L"fluideq.txt"), "Device: all\r\nInclude: fluideq-eq.txt\r\n");
  put(at(L"fluideq-dsp.txt"), "rack");
  put(at(L"fluideq-dsp-" + guid + L".txt"), "rack");
  put(at(L"FLUIDEQ-ROOM-HEAD-0A1B2C3D-4E5F-4A6B-8C7D-9E0F1A2B3C4D.TXT"), "head");
  put(at(L"fluideq-dsp-notaguid.txt"), "kept");
  put(at(L"fluideq-owner.txt"), "kept");
  put(at(L"config.txt"), "kept");
  CreateDirectoryW(at(L"fluideq-dsp-" + guid.substr(0, 35) + L"e.txt").c_str(), nullptr);

  tray::QuitRecipe recipe;
  recipe.config_dir = folder;
  recipe.root_name = L"fluideq.txt";
  recipe.root_text = "# FluidEQ is not running.\r\n";
  recipe.remove_names = {L"fluideq-dsp.txt", L"fluideq-split.txt"};
  recipe.remove_prefixes = {L"fluideq-dsp-", L"fluideq-room-head-"};

  std::vector<std::string> failed;
  check(tray::apply_recipe(recipe, &failed) && failed.empty(),
        "the recipe succeeds, and a named file already gone is no failure");
  check(text_of(at(L"fluideq.txt")) == recipe.root_text,
        "the root says nothing to do, byte for byte");
  check(!exists(at(L"fluideq-dsp.txt")), "a named file is taken away");
  check(!exists(at(L"fluideq-dsp-" + guid + L".txt")), "an output's file is taken away");
  check(!exists(at(L"FLUIDEQ-ROOM-HEAD-0A1B2C3D-4E5F-4A6B-8C7D-9E0F1A2B3C4D.TXT")),
        "an output's file in capitals is taken away");
  check(exists(at(L"fluideq-dsp-notaguid.txt")) && exists(at(L"fluideq-owner.txt")) &&
            exists(at(L"config.txt")),
        "every other file stays");
  check(exists(at(L"fluideq-dsp-" + guid.substr(0, 35) + L"e.txt")),
        "a folder named like an output's file stays");
  bool temporary = false;
  for (const auto& name : names_in(folder)) {
    temporary = temporary || name.ends_with(L".tmp");
  }
  check(!temporary, "nothing is left half-written beside the root");

  // A file something holds open without sharing its deletion: reported, and
  // the rest of the recipe still done.
  put(at(L"fluideq-dsp.txt"), "rack");
  put(at(L"fluideq-dsp-" + guid + L".txt"), "rack");
  const HANDLE held = CreateFileW(at(L"fluideq-dsp.txt").c_str(), GENERIC_READ,
                                  FILE_SHARE_READ, nullptr, OPEN_EXISTING, 0, nullptr);
  failed.clear();
  check(!tray::apply_recipe(recipe, &failed) && failed.size() == 1 &&
            failed[0].find("fluideq-dsp.txt") != std::string::npos,
        "a file that cannot go is reported by name");
  check(!exists(at(L"fluideq-dsp-" + guid + L".txt")), "and the rest still goes");
  CloseHandle(held);

  check(tray::write_atomically(at(L"missing\\fluideq.txt"), "x") != 0,
        "a root that cannot be written says why");
  // Written, and then not renamed over what is there: nothing is left.
  CreateDirectoryW(at(L"taken.txt").c_str(), nullptr);
  check(tray::write_atomically(at(L"taken.txt"), "x") != 0,
        "a root that cannot replace what is there says why");
  temporary = false;
  for (const auto& name : names_in(folder)) {
    temporary = temporary || name.ends_with(L".tmp");
  }
  check(!temporary, "and leaves no temporary behind");
  remove_folder(folder);
}

void no_recipe_no_files() {
  tray::QuitDuty duty;
  int applied = 0;
  duty.carry_out([&applied](const tray::QuitRecipe&) { applied += 1; });
  duty.set(tray::QuitRecipe{L"C:\\cfg", L"fluideq.txt", "x", {}, {}});
  duty.carry_out([&applied](const tray::QuitRecipe&) { applied += 1; });
  check(applied == 0, "a tray that ends before any recipe arrived touches nothing, "
                      "and is done");
  tray::QuitDuty later;
  later.set(std::nullopt);
  later.set(tray::QuitRecipe{L"C:\\cfg", L"fluideq.txt", "x", {}, {}});
  later.carry_out([&applied](const tray::QuitRecipe&) { applied += 1; });
  later.carry_out([&applied](const tray::QuitRecipe&) { applied += 1; });
  check(applied == 1, "the newest recipe, once");
}

}  // namespace

int main() {
  reads_state();
  reads_recipe();
  names_output_files();
  carries_out_the_recipe();
  no_recipe_no_files();
  if (failures != 0) {
    std::printf("%d failure(s)\n", failures);
    return 1;
  }
  std::printf("tray model: main's word read, the recipe on disk\n");
  return 0;
}
