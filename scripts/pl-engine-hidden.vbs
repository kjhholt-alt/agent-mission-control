Set WshShell = CreateObject("WScript.Shell")
WshShell.Run "cmd /c cd /d C:\Users\Kruz\Desktop\Projects\pl-engine && C:\nvm4w\nodejs\claude.cmd -p ""/improve"" --dangerously-skip-permissions >> C:\Users\Kruz\Desktop\Projects\pl-engine\scripts\auto-improve.log 2>&1", 0, True
