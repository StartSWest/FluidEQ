param([string]$SetDefaultDeviceId = '')

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
        public string AsString() { return valueType == 31 ? Marshal.PtrToStringUni(pointerValue) : ""; }
    }

    public class Device
    {
        public string id { get; set; }
        public string name { get; set; }
        public string guid { get; set; }
        public bool isDefault { get; set; }
        public bool isActive { get; set; }
        public Nullable<bool> isEqualizerApoAttached { get; set; }
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
                @"SOFTWARE\Microsoft\Windows\CurrentVersion\MMDevices\Audio\Render\" +
                deviceGuid + @"\FxProperties"))
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
            result.Add(new Device {
                id = id,
                name = friendlyName.Trim(),
                guid = guid,
                isDefault = String.Equals(id, defaultId, StringComparison.OrdinalIgnoreCase),
                isActive = (state & 1) == 1,
                isEqualizerApoAttached = IsEqualizerApoAttached(guid)
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

Add-Type -TypeDefinition $source -Language CSharp
if ($SetDefaultDeviceId) {
    [AquaAudioDevices]::SetDefaultRenderDevice($SetDefaultDeviceId)
    exit 0
}
[AquaAudioDevices]::GetRenderDevices() | ConvertTo-Json -Compress
