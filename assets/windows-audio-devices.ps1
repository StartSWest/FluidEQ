param([string]$SetDefaultDeviceId = '', [string]$AssemblyPath = '')

$source = @'
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using Microsoft.Win32;

public static class AquaAudioDevices
{
    private static readonly string[] EqualizerApoClsids = {
        "{EACD2258-FCAC-4FF4-B36D-419E924A6D79}",
        "{EC1CC9CE-FAED-4822-828A-82A81A6F018F}"
    };

    // The FluidEQ Engine's own APO CLSID (see src/common/audioEngine.ts's
    // FLUID_ENGINE_CLSID, which this must be kept equal to).
    private const string FluidEngineClsid = "{B7E2C4D1-5A8F-4C3E-9D2B-6F1A0C8E7D34}";

    // FxProperties stores the effect registrations under value names shaped
    // like "{format-guid},pid" rather than a plain name. The engine can sit
    // in any of eight: the three composite lists — PKEY_FX_EndpointEffectClsid
    // (,15), PKEY_FX_ModeEffectClsid (,14), PKEY_FX_StreamEffectClsid (,13) —
    // the same three as one class id each (,7 ,6 ,5), and the two pre-8.1
    // single values, GFX (,2) and LFX (,1). Everything below the lists is
    // where the helper's slot ladder puts it on an output whose driver reads
    // an older generation (`plan_attach` in
    // native/system-apo/setup/fx_list.cpp). A probe that read only ,15 and
    // ,14 called such an output "not attached" after every move, and the
    // panel enabled it again on every launch; ,7 ,6 and ,5 joined the list
    // when a Bluetooth headset turned out to be read from exactly those.
    private static readonly string[] EngineSlotValues = new string[] {
        "{d04e05a6-594b-4fb6-a80d-01af5eed7d1d},15",
        "{d04e05a6-594b-4fb6-a80d-01af5eed7d1d},14",
        "{d04e05a6-594b-4fb6-a80d-01af5eed7d1d},13",
        "{d04e05a6-594b-4fb6-a80d-01af5eed7d1d},7",
        "{d04e05a6-594b-4fb6-a80d-01af5eed7d1d},6",
        "{d04e05a6-594b-4fb6-a80d-01af5eed7d1d},5",
        "{d04e05a6-594b-4fb6-a80d-01af5eed7d1d},2",
        "{d04e05a6-594b-4fb6-a80d-01af5eed7d1d},1",
    };

    // Where Windows keeps each output that audio effects can run on, and the
    // only place either engine attaches: the helper looks nowhere else, and
    // neither does Equalizer APO's Device Selector. Remote Desktop's audio is
    // enumerated as an output like any other, but its key is under
    // RemoteRender instead, with no FxProperties at all.
    private const string RenderEndpointsKey =
        @"SOFTWARE\Microsoft\Windows\CurrentVersion\MMDevices\Audio\Render\";

    [ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")]
    private class MMDeviceEnumeratorComObject { }

    [ComImport, Guid("870AF99C-171D-4F9E-AF0D-E63DF40C2BC9")]
    private class PolicyConfigClient { }

    [ComImport, Guid("F8679F50-850A-41CF-9C72-430F290290C8"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    private interface IPolicyConfig
    {
        [PreserveSig] int GetMixFormat();
        [PreserveSig] int GetDeviceFormat();
        [PreserveSig] int ResetDeviceFormat();
        [PreserveSig] int SetDeviceFormat();
        [PreserveSig] int GetProcessingPeriod();
        [PreserveSig] int SetProcessingPeriod();
        [PreserveSig] int GetShareMode();
        [PreserveSig] int SetShareMode();
        [PreserveSig] int GetPropertyValue();
        [PreserveSig] int SetPropertyValue();
        [PreserveSig]
        int SetDefaultEndpoint(
            [MarshalAs(UnmanagedType.LPWStr)] string deviceId,
            int role);
        [PreserveSig] int SetEndpointVisibility();
    }

    [ComImport, Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    private interface IMMDeviceEnumerator
    {
        [PreserveSig]
        int EnumAudioEndpoints(int dataFlow, uint stateMask, out IMMDeviceCollection devices);
        [PreserveSig]
        int GetDefaultAudioEndpoint(int dataFlow, int role, out IMMDevice endpoint);
        [PreserveSig]
        int GetDevice([MarshalAs(UnmanagedType.LPWStr)] string id, out IMMDevice device);
        [PreserveSig]
        int RegisterEndpointNotificationCallback(IntPtr client);
        [PreserveSig]
        int UnregisterEndpointNotificationCallback(IntPtr client);
    }

    [ComImport, Guid("0BD7A1BE-7A1A-44DB-8397-CC5392387B5E"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    private interface IMMDeviceCollection
    {
        [PreserveSig]
        int GetCount(out uint count);
        [PreserveSig]
        int Item(uint index, out IMMDevice device);
    }

    [ComImport, Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    private interface IMMDevice
    {
        [PreserveSig]
        int Activate(ref Guid iid, uint context, IntPtr activationParams, out IntPtr instance);
        [PreserveSig]
        int OpenPropertyStore(uint access, out IPropertyStore properties);
        [PreserveSig]
        int GetId([MarshalAs(UnmanagedType.LPWStr)] out string id);
        [PreserveSig]
        int GetState(out uint state);
    }

    [ComImport, Guid("886D8EEB-8CF2-4446-8D02-CDBA1DBDCF99"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    private interface IPropertyStore
    {
        [PreserveSig]
        int GetCount(out uint count);
        [PreserveSig]
        int GetAt(uint index, out PROPERTYKEY key);
        [PreserveSig]
        int GetValue(ref PROPERTYKEY key, out PROPVARIANT value);
        [PreserveSig]
        int SetValue(ref PROPERTYKEY key, ref PROPVARIANT value);
        [PreserveSig]
        int Commit();
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct PROPERTYKEY
    {
        public Guid formatId;
        public uint propertyId;
    }

    [StructLayout(LayoutKind.Explicit, Size = 24)]
    private struct PROPVARIANT
    {
        [FieldOffset(0)] public ushort valueType;
        [FieldOffset(8)] public IntPtr pointerValue;
        // VT_BLOB: a byte count, then a pointer on its own 8-byte boundary.
        [FieldOffset(8)] public uint blobSize;
        // VT_UI4 / VT_I4: the number itself, in the same first eight bytes.
        [FieldOffset(8)] public uint uint32Value;
        [FieldOffset(16)] public IntPtr blobData;
        public string AsString() { return valueType == 31 ? Marshal.PtrToStringUni(pointerValue) : ""; }
    }

    [DllImport("ole32.dll")]
    private static extern int PropVariantClear(ref PROPVARIANT value);

    // PKEY_AudioEngine_DeviceFormat: the WAVEFORMATEX the audio engine runs
    // this output at in shared mode, i.e. the "Default Format" in Sound
    // settings. nSamplesPerSec sits four bytes in.
    private static readonly PROPERTYKEY DeviceFormatKey = new PROPERTYKEY {
        formatId = new Guid("F19F064D-082C-4E27-BC73-6882A1BB8E4C"),
        propertyId = 0
    };

    // PKEY_AudioEndpoint_Disable_SysFx: Windows' own "Audio enhancements"
    // switch for one output — Off in Sound settings, "Disable all
    // enhancements" in the old panel. While it is set, Windows loads no
    // system effect on that output at all, so an engine that is installed,
    // attached, healthy and correct is still never heard, with nothing
    // anywhere to say why. This is the question the app could not ask.
    private static readonly PROPERTYKEY DisableSysFxKey = new PROPERTYKEY {
        formatId = new Guid("1DA5D803-D492-4EDD-8C23-E0C0FFEE7F0E"),
        propertyId = 5
    };

    private static Nullable<bool> ReadEffectsEnabled(IPropertyStore store)
    {
        var key = DisableSysFxKey;
        PROPVARIANT value;
        if (store.GetValue(ref key, out value) != 0)
            return null;
        try
        {
            // VT_EMPTY is the normal case on a machine nobody has switched
            // this on: never written means never disabled.
            if (value.valueType == 0)
                return true;
            // VT_UI4 and VT_I4 are the two ways Windows has written it.
            if (value.valueType != 19 && value.valueType != 3)
                return null;
            return value.uint32Value == 0;
        }
        finally
        {
            PropVariantClear(ref value);
        }
    }

    // nChannels sits two bytes in: how many channels Windows mixes this
    // output to, which is what a game's or a film's surround reaches only
    // when it is six or eight.
    private static Nullable<int> ReadChannels(IPropertyStore store)
    {
        var key = DeviceFormatKey;
        PROPVARIANT value;
        if (store.GetValue(ref key, out value) != 0)
            return null;
        try
        {
            if (value.valueType != 65 || value.blobSize < 4 ||
                value.blobData == IntPtr.Zero)
                return null;
            var channels = Marshal.ReadInt16(value.blobData, 2);
            return channels > 0 ? (Nullable<int>)channels : null;
        }
        finally
        {
            PropVariantClear(ref value);
        }
    }

    private static Nullable<int> ReadSampleRate(IPropertyStore store)
    {
        var key = DeviceFormatKey;
        PROPVARIANT value;
        if (store.GetValue(ref key, out value) != 0)
            return null;
        try
        {
            // VT_BLOB, and long enough to hold the rate: anything else is a
            // format this probe does not understand, not a rate of zero.
            if (value.valueType != 65 || value.blobSize < 8 ||
                value.blobData == IntPtr.Zero)
                return null;
            var rate = Marshal.ReadInt32(value.blobData, 4);
            return rate > 0 ? (Nullable<int>)rate : null;
        }
        finally
        {
            PropVariantClear(ref value);
        }
    }

    // PKEY_Device_ContainerId on the endpoint's own store: the physical device
    // an output belongs to. A Bluetooth headset's outputs and the Bluetooth
    // device node that carries its battery share one, which is how Windows'
    // own Bluetooth page puts the two together.
    private static readonly PROPERTYKEY ContainerIdKey = new PROPERTYKEY {
        formatId = new Guid("8C7ED206-3F8A-4827-B3AB-AE9E1FAEFC6C"),
        propertyId = 2
    };

    // Never throws: an output whose container cannot be read is listed with
    // no battery, never dropped, and never takes the list down with it.
    private static Nullable<Guid> ReadContainerId(IPropertyStore store)
    {
        try
        {
            var key = ContainerIdKey;
            PROPVARIANT value;
            if (store.GetValue(ref key, out value) != 0)
                return null;
            try
            {
                // VT_CLSID: a pointer to the GUID.
                if (value.valueType != 72 || value.pointerValue == IntPtr.Zero)
                    return null;
                return (Guid)Marshal.PtrToStructure(value.pointerValue, typeof(Guid));
            }
            finally
            {
                PropVariantClear(ref value);
            }
        }
        catch
        {
            return null;
        }
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct DEVPROPKEY
    {
        public Guid formatId;
        public uint propertyId;
    }

    [DllImport("CfgMgr32.dll", CharSet = CharSet.Unicode)]
    private static extern int CM_Get_Device_ID_List_SizeW(out uint length, string filter, uint flags);

    [DllImport("CfgMgr32.dll", CharSet = CharSet.Unicode)]
    private static extern int CM_Get_Device_ID_ListW(string filter, char[] buffer, uint length, uint flags);

    [DllImport("CfgMgr32.dll", CharSet = CharSet.Unicode)]
    private static extern int CM_Locate_DevNodeW(out uint devInst, string deviceId, uint flags);

    [DllImport("CfgMgr32.dll", CharSet = CharSet.Unicode)]
    private static extern int CM_Get_DevNode_PropertyW(uint devInst, ref DEVPROPKEY key, out uint type, byte[] buffer, ref uint size, uint flags);

    // DEVPKEY_Bluetooth_Battery: the percentage a Bluetooth device reports to
    // Windows, the number on Windows' own Bluetooth page. A headset that never
    // reports one has none, and a 2.4 GHz dongle is not a Bluetooth device at
    // all: its battery stays between the headset and its maker's software.
    private static readonly DEVPROPKEY BluetoothBatteryKey = new DEVPROPKEY {
        formatId = new Guid("104EA319-6EE2-4701-BD47-8DDBF425BBE5"),
        propertyId = 2
    };

    private static readonly DEVPROPKEY DeviceContainerKey = new DEVPROPKEY {
        formatId = new Guid("8C7ED206-3F8A-4827-B3AB-AE9E1FAEFC6C"),
        propertyId = 2
    };

    // Where Windows enumerates Bluetooth device nodes: classic profiles,
    // Low Energy devices and their services, and hands-free audio.
    private static readonly string[] BluetoothEnumerators = {
        "BTHENUM", "BTHLE", "BTHLEDEVICE", "BTHHFENUM"
    };

    private static byte[] ReadDevNodeProperty(uint devInst, DEVPROPKEY key, uint wantedType)
    {
        uint type;
        uint size = 0;
        CM_Get_DevNode_PropertyW(devInst, ref key, out type, null, ref size, 0);
        if (size == 0)
            return null;
        var buffer = new byte[size];
        if (CM_Get_DevNode_PropertyW(devInst, ref key, out type, buffer, ref size, 0) != 0 ||
            type != wantedType)
            return null;
        return buffer;
    }

    // Each present Bluetooth device's battery, by the container its outputs
    // share. Read once per listing; every call here is a local property read,
    // no radio traffic, so a few milliseconds in all.
    private static Dictionary<Guid, int> BatteryByContainer()
    {
        var result = new Dictionary<Guid, int>();
        try
        {
            foreach (var enumerator in BluetoothEnumerators)
            {
                // CM_GETIDLIST_FILTER_ENUMERATOR | CM_GETIDLIST_FILTER_PRESENT:
                // a device paired and away keeps the last level it sent.
                const uint flags = 0x1 | 0x100;
                uint length;
                if (CM_Get_Device_ID_List_SizeW(out length, enumerator, flags) != 0 || length == 0)
                    continue;
                var buffer = new char[length];
                if (CM_Get_Device_ID_ListW(enumerator, buffer, length, flags) != 0)
                    continue;
                foreach (var deviceId in new string(buffer).Split(new[] { '\0' }, StringSplitOptions.RemoveEmptyEntries))
                {
                    uint devInst;
                    if (CM_Locate_DevNodeW(out devInst, deviceId, 0) != 0)
                        continue;
                    // DEVPROP_TYPE_BYTE, then DEVPROP_TYPE_GUID.
                    var battery = ReadDevNodeProperty(devInst, BluetoothBatteryKey, 0x3);
                    if (battery == null || battery.Length < 1 || battery[0] > 100)
                        continue;
                    var container = ReadDevNodeProperty(devInst, DeviceContainerKey, 0xD);
                    if (container == null || container.Length != 16)
                        continue;
                    result[new Guid(container)] = battery[0];
                }
            }
        }
        catch
        {
            // No level is the answer for anything this could not read: a
            // battery is something the panel shows, never something it needs.
        }
        return result;
    }

    public class Device
    {
        public string id { get; set; }
        public string name { get; set; }
        public string guid { get; set; }
        public bool isDefault { get; set; }
        public bool isActive { get; set; }
        public Nullable<bool> isEqualizerApoAttached { get; set; }
        public Nullable<bool> isFluidEngineAttached { get; set; }
        public Nullable<bool> canHostEffects { get; set; }
        public Nullable<bool> effectsEnabled { get; set; }
        public Nullable<int> sampleRate { get; set; }
        public Nullable<int> channels { get; set; }
        public Nullable<int> batteryPercent { get; set; }
    }

    // The two probes below answer "not attached" for an output with no key
    // under Render at all, which is true and useless: it offered a repair —
    // attach the engine, open the Device Selector — that can never work on
    // an output Windows runs no effects on. This is the question underneath.
    private static Nullable<bool> CanHostEffects(string deviceGuid)
    {
        try
        {
            using (var machine = RegistryKey.OpenBaseKey(
                RegistryHive.LocalMachine,
                RegistryView.Registry64))
            using (var endpoint = machine.OpenSubKey(RenderEndpointsKey + deviceGuid))
            {
                return endpoint != null;
            }
        }
        catch
        {
            // Unknown, as in the probes below: a locked registry must not
            // declare a real output unfixable.
            return null;
        }
    }

    private static bool ContainsEqualizerApoClsid(object rawValue)
    {
        var values = rawValue as string[];
        if (values != null)
        {
            foreach (var value in values)
                if (ContainsEqualizerApoClsid(value))
                    return true;
            return false;
        }

        var text = rawValue as string;
        if (String.IsNullOrWhiteSpace(text))
            return false;
        foreach (var clsid in EqualizerApoClsids)
            if (text.IndexOf(clsid, StringComparison.OrdinalIgnoreCase) >= 0)
                return true;
        return false;
    }

    private static Nullable<bool> IsEqualizerApoAttached(string deviceGuid)
    {
        try
        {
            using (var machine = RegistryKey.OpenBaseKey(
                RegistryHive.LocalMachine,
                RegistryView.Registry64))
            using (var properties = machine.OpenSubKey(
                RenderEndpointsKey + deviceGuid + @"\FxProperties"))
            {
                if (properties == null)
                    return false;
                foreach (var valueName in properties.GetValueNames())
                    if (ContainsEqualizerApoClsid(
                        properties.GetValue(
                            valueName,
                            null,
                            RegistryValueOptions.DoNotExpandEnvironmentNames)))
                        return true;
                return false;
            }
        }
        catch
        {
            // Unknown is deliberately distinct from "not attached". A locked
            // registry must not produce a confident warning in the UI.
            return null;
        }
    }

    private static bool ContainsClsid(object rawValue, string clsid)
    {
        var values = rawValue as string[];
        if (values != null)
        {
            foreach (var value in values)
                if (!String.IsNullOrWhiteSpace(value) &&
                    value.IndexOf(clsid, StringComparison.OrdinalIgnoreCase) >= 0)
                    return true;
            return false;
        }

        // REG_SZ fallback, matching ContainsEqualizerApoClsid: some drivers
        // write the composite effects value as a single string rather than
        // REG_MULTI_SZ, and that must still be searched, not treated as absent.
        var text = rawValue as string;
        if (String.IsNullOrWhiteSpace(text))
            return false;
        return text.IndexOf(clsid, StringComparison.OrdinalIgnoreCase) >= 0;
    }

    // Reads the five values the engine can be registered in rather than
    // every FxProperties value: the class id is only ever placed in one of
    // those, never under an arbitrary name.
    private static Nullable<bool> IsFluidEngineAttached(string deviceGuid)
    {
        try
        {
            using (var machine = RegistryKey.OpenBaseKey(
                RegistryHive.LocalMachine,
                RegistryView.Registry64))
            using (var properties = machine.OpenSubKey(
                RenderEndpointsKey + deviceGuid + @"\FxProperties"))
            {
                if (properties == null)
                    return false;
                foreach (var valueName in EngineSlotValues)
                {
                    var effects = properties.GetValue(
                        valueName,
                        null,
                        RegistryValueOptions.DoNotExpandEnvironmentNames);
                    if (ContainsClsid(effects, FluidEngineClsid))
                        return true;
                }
                return false;
            }
        }
        catch
        {
            // Unknown is deliberately distinct from "not attached", same as
            // the APO probe above.
            return null;
        }
    }

    public static List<Device> GetRenderDevices()
    {
        var result = new List<Device>();
        var enumerator = (IMMDeviceEnumerator)new MMDeviceEnumeratorComObject();
        IMMDevice defaultDevice;
        string defaultId = "";
        if (enumerator.GetDefaultAudioEndpoint(0, 1, out defaultDevice) == 0 && defaultDevice != null)
            defaultDevice.GetId(out defaultId);

        IMMDeviceCollection collection;
        // DEVICE_STATE_ACTIVE only. This matches the normal Windows output
        // picker instead of returning disabled, unplugged and historical
        // endpoints from the registry.
        Marshal.ThrowExceptionForHR(enumerator.EnumAudioEndpoints(0, 0x1, out collection));
        uint count;
        collection.GetCount(out count);
        var friendlyNameKey = new PROPERTYKEY {
            formatId = new Guid("A45C254E-DF1C-4EFD-8020-67D146A850E0"),
            propertyId = 14
        };
        var batteries = BatteryByContainer();

        for (uint i = 0; i < count; i++)
        {
            IMMDevice endpoint;
            collection.Item(i, out endpoint);
            string id;
            uint state;
            endpoint.GetId(out id);
            endpoint.GetState(out state);
            IPropertyStore store;
            endpoint.OpenPropertyStore(0, out store);
            PROPVARIANT value;
            store.GetValue(ref friendlyNameKey, out value);
            var friendlyName = value.AsString();
            if (String.IsNullOrWhiteSpace(friendlyName))
                continue;
            var marker = id.LastIndexOf("{");
            var guid = marker >= 0 ? id.Substring(marker) : id;
            var container = ReadContainerId(store);
            int battery = 0;
            var hasBattery = container.HasValue &&
                batteries.TryGetValue(container.Value, out battery);
            result.Add(new Device {
                id = id,
                name = friendlyName.Trim(),
                guid = guid,
                isDefault = String.Equals(id, defaultId, StringComparison.OrdinalIgnoreCase),
                isActive = (state & 1) == 1,
                isEqualizerApoAttached = IsEqualizerApoAttached(guid),
                isFluidEngineAttached = IsFluidEngineAttached(guid),
                canHostEffects = CanHostEffects(guid),
                effectsEnabled = ReadEffectsEnabled(store),
                sampleRate = ReadSampleRate(store),
                channels = ReadChannels(store),
                batteryPercent = hasBattery ? (Nullable<int>)battery : null
            });
        }
        return result;
    }

    public static void SetDefaultRenderDevice(string deviceId)
    {
        var policyConfig = (IPolicyConfig)new PolicyConfigClient();
        // Keep the normal output picker, multimedia applications and
        // communications applications on the same endpoint.
        for (var role = 0; role <= 2; role++)
            Marshal.ThrowExceptionForHR(
                policyConfig.SetDefaultEndpoint(deviceId, role)
            );
    }
}
'@

# Compiling $source starts the C# compiler - csc.exe and its temp files - on
# every run, and the output list is read every few seconds while the window is
# open: the compile was most of each read. Main names a file for the compiled
# helper, stamped with this script's own hash, so each version of the script
# compiles once. Anything wrong with that file - missing, half written, locked,
# refused - ends in the in-memory compile every run used to do.
if ($AssemblyPath) {
    # Staging files a run could not move or remove - its compile still held
    # open - are no longer held by the time a later run looks.
    Get-ChildItem -LiteralPath (Split-Path -Parent $AssemblyPath) -Filter "$(Split-Path -Leaf $AssemblyPath).*.tmp" -ErrorAction SilentlyContinue |
        Remove-Item -Force -ErrorAction SilentlyContinue
    try {
        if (-not (Test-Path -LiteralPath $AssemblyPath)) {
            # Written beside the final name and moved into place, so a run
            # killed mid-compile never leaves a partial file under that name.
            $staging = "$AssemblyPath.$PID.tmp"
            Add-Type -TypeDefinition $source -Language CSharp -OutputAssembly $staging -OutputType Library -ErrorAction Stop
            Move-Item -LiteralPath $staging -Destination $AssemblyPath -Force -ErrorAction Stop
        }
        if (-not ('AquaAudioDevices' -as [type])) {
            Add-Type -LiteralPath $AssemblyPath -ErrorAction Stop
        }
    }
    catch {
        # Next run compiles it again rather than tripping over it forever.
        Remove-Item -LiteralPath $AssemblyPath -Force -ErrorAction SilentlyContinue
        if ($staging) {
            Remove-Item -LiteralPath $staging -Force -ErrorAction SilentlyContinue
        }
    }
}
if (-not ('AquaAudioDevices' -as [type])) {
    Add-Type -TypeDefinition $source -Language CSharp
}
if ($SetDefaultDeviceId) {
    [AquaAudioDevices]::SetDefaultRenderDevice($SetDefaultDeviceId)
    exit 0
}
[AquaAudioDevices]::GetRenderDevices() | ConvertTo-Json -Compress
