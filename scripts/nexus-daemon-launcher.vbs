Set WshShell = CreateObject("WScript.Shell")
WshShell.Run "powershell.exe -ExecutionPolicy Bypass -WindowStyle Hidden -NoProfile -File ""C:\Users\Kruz\Desktop\Projects\nexus\scripts\start-daemon.ps1""", 0, False
