$source = @'
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;

public static class AquaAudioDevices
{
    [ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")]
    private class MMDeviceEnumeratorComObject { }

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
            result.Add(new Device {
                id = id,
                name = friendlyName.Trim(),
                guid = marker >= 0 ? id.Substring(marker) : id,
                isDefault = String.Equals(id, defaultId, StringComparison.OrdinalIgnoreCase),
                isActive = (state & 1) == 1
            });
        }
        return result;
    }
}
'@

Add-Type -TypeDefinition $source -Language CSharp
[AquaAudioDevices]::GetRenderDevices() | ConvertTo-Json -Compress
