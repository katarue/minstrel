# Minstrel スケジューラー起動スクリプト
# タスクスケジューラから呼び出される。ログは logs/ に保存。

$Root    = Split-Path -Parent $MyInvocation.MyCommand.Path
$LogDir  = Join-Path $Root "logs"
$Python  = Join-Path $Root ".venv\Scripts\python.exe"
$Script  = Join-Path $Root "run_scheduler.py"

if (-not (Test-Path $LogDir)) { New-Item -ItemType Directory -Path $LogDir | Out-Null }

$LogFile = Join-Path $LogDir ("scheduler_" + (Get-Date -Format "yyyyMMdd") + ".log")

"[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] Scheduler starting..." | Add-Content $LogFile

Set-Location $Root
& $Python $Script "--serve-all" *>> $LogFile
