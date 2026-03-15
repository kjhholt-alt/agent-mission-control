' Nexus Executor — Hidden launcher (no visible window)
' Double-click this file or add it to Task Scheduler to run the executor silently.
Set WshShell = CreateObject("WScript.Shell")
WshShell.Run "powershell.exe -ExecutionPolicy Bypass -WindowStyle Hidden -File ""C:\Users\Kruz\Desktop\Projects\agent-mission-control\scripts\start-executor.ps1""", 0, False
