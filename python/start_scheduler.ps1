# Minstrel スケジューラー起動スクリプト
# タスクスケジューラから呼び出される。ログは logs/ に保存。
# 動画パイプラインの Prefect サーバー（port 4200）を共用する。

$Root    = Split-Path -Parent $MyInvocation.MyCommand.Path
$LogDir  = Join-Path $Root "logs"
$Python  = Join-Path $Root ".venv\Scripts\python.exe"
$Script  = Join-Path $Root "run_scheduler.py"

if (-not (Test-Path $LogDir)) { New-Item -ItemType Directory -Path $LogDir | Out-Null }

$LogFile = Join-Path $LogDir ("scheduler_" + (Get-Date -Format "yyyyMMdd") + ".log")
"[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] Scheduler starting..." | Add-Content $LogFile

# Prefect サーバー（port 4200）の応答を最大 60 秒待つ
$ready = $false
for ($i = 1; $i -le 60; $i++) {
    try {
        $r = Invoke-WebRequest -Uri "http://127.0.0.1:4200/api/health" -UseBasicParsing -TimeoutSec 2 -EA Stop
        if ($r.StatusCode -lt 500) { $ready = $true; break }
    } catch {}
    Start-Sleep -Seconds 1
}
if (-not $ready) {
    "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] WARNING: Prefect server not responding on port 4200" | Add-Content $LogFile
}

$env:PREFECT_API_URL = "http://127.0.0.1:4200/api"
Set-Location $Root

# collect_flow と collect_x_flow（いずれも毎日 01:00 JST）を別プロセスで起動
# PS 5.1 では stdout と stderr に同一ファイルを指定できないため別ファイルに分ける
$logCollectOut   = Join-Path $LogDir ("collect_" + (Get-Date -Format "yyyyMMdd") + ".log")
$logCollectErr   = Join-Path $LogDir ("collect_err_" + (Get-Date -Format "yyyyMMdd") + ".log")
$logXOut         = Join-Path $LogDir ("collect_x_" + (Get-Date -Format "yyyyMMdd") + ".log")
$logXErr         = Join-Path $LogDir ("collect_x_err_" + (Get-Date -Format "yyyyMMdd") + ".log")
$logPostSchedOut = Join-Path $LogDir ("post_scheduled_" + (Get-Date -Format "yyyyMMdd") + ".log")
$logPostSchedErr = Join-Path $LogDir ("post_scheduled_err_" + (Get-Date -Format "yyyyMMdd") + ".log")
$logPostMondayOut = Join-Path $LogDir ("post_monday_" + (Get-Date -Format "yyyyMMdd") + ".log")
$logPostMondayErr = Join-Path $LogDir ("post_monday_err_" + (Get-Date -Format "yyyyMMdd") + ".log")
$logPostFridayOut = Join-Path $LogDir ("post_friday_" + (Get-Date -Format "yyyyMMdd") + ".log")
$logPostFridayErr = Join-Path $LogDir ("post_friday_err_" + (Get-Date -Format "yyyyMMdd") + ".log")

function Start-ServeIfNotRunning {
    param($Arg, $OutLog, $ErrLog)
    $running = Get-WmiObject Win32_Process | Where-Object {
        $_.CommandLine -like "*run_scheduler*" -and $_.CommandLine -like "*$Arg*" -and $_.CommandLine -like "*.venv*"
    }
    if ($running) {
        "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] SKIP: $Arg already running (PID $($running.ProcessId))" | Add-Content $LogFile
    } else {
        Start-Process -FilePath $Python `
            -ArgumentList "$Script $Arg" `
            -WorkingDirectory $Root `
            -WindowStyle Hidden `
            -RedirectStandardOutput $OutLog `
            -RedirectStandardError  $ErrLog
        "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] STARTED: $Arg" | Add-Content $LogFile
    }
}

Start-ServeIfNotRunning "--serve-scheduled"       $logCollectOut    $logCollectErr
Start-ServeIfNotRunning "--serve-x"               $logXOut          $logXErr
Start-ServeIfNotRunning "--serve-post-scheduled"  $logPostSchedOut  $logPostSchedErr
Start-ServeIfNotRunning "--serve-post-monday"     $logPostMondayOut $logPostMondayErr
Start-ServeIfNotRunning "--serve-post-friday"     $logPostFridayOut $logPostFridayErr

"[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] All serve processes checked." | Add-Content $LogFile
