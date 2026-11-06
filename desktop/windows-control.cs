// Compatibility helper for the first upgrade from a legacy GUI. No termination.
using System;
using System.IO;
using System.Text;
using System.Diagnostics;
using System.Collections.Generic;
using System.Runtime.InteropServices;
class OporaControl {
  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)] struct Entry {
    public uint size,usage,pid; public UIntPtr heap; public uint module,threads,parent; public int priority; public uint flags;
    [MarshalAs(UnmanagedType.ByValTStr,SizeConst=260)] public string name;
  }
  [DllImport("kernel32.dll",SetLastError=true)] static extern IntPtr CreateToolhelp32Snapshot(uint flags,uint pid);
  [DllImport("kernel32.dll",CharSet=CharSet.Unicode)] static extern bool Process32FirstW(IntPtr handle,ref Entry entry);
  [DllImport("kernel32.dll",CharSet=CharSet.Unicode)] static extern bool Process32NextW(IntPtr handle,ref Entry entry);
  [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr handle);
  [DllImport("kernel32.dll",CharSet=CharSet.Unicode)] static extern uint GetLongPathName(string input,StringBuilder output,uint size);
  static string Normal(string value) { var full=Path.GetFullPath(value); var buffer=new StringBuilder(32768); return GetLongPathName(full,buffer,32768)>0?buffer.ToString():full; }
  static bool HasTerminal(uint root) {
    var parents=new Dictionary<uint,uint>(); var names=new Dictionary<uint,string>();
    var handle=CreateToolhelp32Snapshot(2,0); if(handle==new IntPtr(-1)) return true;
    try { var entry=new Entry(); entry.size=(uint)Marshal.SizeOf(typeof(Entry));
      if(Process32FirstW(handle,ref entry))do{parents[entry.pid]=entry.parent;names[entry.pid]=entry.name;}while(Process32NextW(handle,ref entry));
    } finally { CloseHandle(handle); }
    foreach(var pair in names) {
      var name=pair.Value.ToLowerInvariant(); if(name!="node.exe"&&name!="openconsole.exe"&&!name.Contains("claude"))continue;
      uint pid=pair.Key;var seen=new HashSet<uint>();
      while(parents.ContainsKey(pid)&&seen.Add(pid)){pid=parents[pid];if(pid==root)return true;}
    }
    return false;
  }
  static int Main(string[] args) {
    if(args.Length<3)return 2;
    string target=Normal(args[0]);bool close=args[1]=="close",protect=args[2]=="1";
    foreach(var process in Process.GetProcessesByName("Opora"))using(process){
      try {
        if(process.MainWindowHandle==IntPtr.Zero)continue;
        string actual;try{actual=Normal(process.MainModule.FileName);}catch{Console.WriteLine("UNKNOWN:"+process.Id);continue;}
        if(!String.Equals(actual,target,StringComparison.OrdinalIgnoreCase))continue;
        if(protect&&HasTerminal((uint)process.Id)){Console.WriteLine("PROTECTED:"+process.Id);continue;}
        Console.WriteLine("GUI:"+process.Id);
        if(close)Console.WriteLine("CLOSE:"+process.Id+":"+process.CloseMainWindow());
      }catch(InvalidOperationException){}catch(System.ComponentModel.Win32Exception){}
    }
    return 0;
  }
}
