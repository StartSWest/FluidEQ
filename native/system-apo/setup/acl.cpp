/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "acl.h"

#define WIN32_LEAN_AND_MEAN
#include <windows.h>

#include <aclapi.h>

#include <string>
#include <vector>

#include "fs.h"

namespace fluideq_engine::setup {

namespace {

/** A well-known SID in a caller-owned buffer, so nothing has to be freed. */
class WellKnownSid {
 public:
  bool make(WELL_KNOWN_SID_TYPE type) {
    buffer_.assign(SECURITY_MAX_SID_SIZE, 0);
    DWORD size = static_cast<DWORD>(buffer_.size());
    if (CreateWellKnownSid(type, nullptr, buffer_.data(), &size) == 0) {
      return false;
    }
    buffer_.resize(size);
    return true;
  }
  PSID get() noexcept { return buffer_.data(); }

 private:
  std::vector<BYTE> buffer_;
};

void fill_entry(EXPLICIT_ACCESS_W& entry, PSID who, DWORD rights) {
  entry.grfAccessPermissions = rights;
  entry.grfAccessMode = SET_ACCESS;
  // Both flags: the configuration files live directly in a subdirectory, and
  // the subdirectories themselves have to carry the same permissions down to
  // whatever the app writes next.
  entry.grfInheritance = CONTAINER_INHERIT_ACE | OBJECT_INHERIT_ACE;
  entry.Trustee.pMultipleTrustee = nullptr;
  entry.Trustee.MultipleTrusteeOperation = NO_MULTIPLE_TRUSTEE;
  entry.Trustee.TrusteeForm = TRUSTEE_IS_SID;
  entry.Trustee.TrusteeType = TRUSTEE_IS_WELL_KNOWN_GROUP;
  entry.Trustee.ptstrName = static_cast<LPWSTR>(who);
}

}  // namespace

bool apply_engine_acl(const std::wstring& directory, std::wstring& error) {
  WellKnownSid system;
  WellKnownSid administrators;
  WellKnownSid users;
  if (!system.make(WinLocalSystemSid) ||
      !administrators.make(WinBuiltinAdministratorsSid) ||
      !users.make(WinBuiltinUsersSid)) {
    error = L"could not build the security identifiers: " +
            describe_error(GetLastError());
    return false;
  }

  EXPLICIT_ACCESS_W entries[3] = {};
  fill_entry(entries[0], system.get(), FILE_ALL_ACCESS);
  fill_entry(entries[1], administrators.get(), FILE_ALL_ACCESS);
  // Modify, which is read, write, execute and delete — and deliberately not
  // full control: an ordinary user has no reason to be able to rewrite the
  // permissions on a directory the audio engine reads.
  fill_entry(entries[2], users.get(),
             FILE_GENERIC_READ | FILE_GENERIC_WRITE | FILE_GENERIC_EXECUTE |
                 DELETE);

  PACL list = nullptr;
  const DWORD built = SetEntriesInAclW(3, entries, nullptr, &list);
  if (built != ERROR_SUCCESS || list == nullptr) {
    error = L"could not build the permissions: " + describe_error(built);
    return false;
  }

  // A mutable copy: `SetNamedSecurityInfoW` takes a writable string even
  // though it does not change it.
  std::wstring path = directory;
  const DWORD applied = SetNamedSecurityInfoW(
      path.data(), SE_FILE_OBJECT,
      DACL_SECURITY_INFORMATION | PROTECTED_DACL_SECURITY_INFORMATION,
      nullptr, nullptr, list, nullptr);
  LocalFree(list);
  if (applied != ERROR_SUCCESS) {
    error = L"could not set the permissions on " + directory + L": " +
            describe_error(applied);
    return false;
  }
  return true;
}

}  // namespace fluideq_engine::setup
