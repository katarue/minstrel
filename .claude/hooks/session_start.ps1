# Minstrel: SessionStart フック
# STATE.md の「現在地」セクションを Claude のコンテキストに自動投入し、
# セッション開始時点の git HEAD をリポジトリ外の一時ファイルに記録する
# （Stop フック側で「セッション中に何が変わったか」を判定するために使う）。
# 失敗してもセッション開始を止めない（fail-open）。

[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
[Console]::InputEncoding  = New-Object System.Text.UTF8Encoding($false)

try {
    $stdin = [Console]::In.ReadToEnd()
    $stdin = $stdin.TrimStart([char]0xFEFF)  # 先頭にBOM文字が付くケースへの防御
    $inputJson = $stdin | ConvertFrom-Json

    $repoRoot = $env:CLAUDE_PROJECT_DIR
    if (-not $repoRoot) {
        $repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
    }

    # セッション開始時点の HEAD を記録
    if ($inputJson.session_id) {
        $markerDir = Join-Path $env:TEMP "claude_minstrel_session_heads"
        if (-not (Test-Path $markerDir)) {
            New-Item -ItemType Directory -Path $markerDir -Force | Out-Null
        }
        Push-Location $repoRoot
        try {
            $head = (git rev-parse HEAD 2>$null)
            if ($LASTEXITCODE -eq 0 -and $head) {
                $markerFile = Join-Path $markerDir ("$($inputJson.session_id).txt")
                Set-Content -Path $markerFile -Value $head.Trim() -Encoding utf8 -NoNewline
            }
        } finally {
            Pop-Location
        }
    }

    # STATE.md の「現在地」セクションを抽出して additionalContext に渡す
    $stateMdPath = Join-Path $repoRoot "STATE.md"
    $section = $null
    if (Test-Path $stateMdPath) {
        $content = Get-Content -Path $stateMdPath -Raw -Encoding UTF8
        if ($content -match '(?ms)^## 現在地.*?(?=^## |\z)') {
            $section = $Matches[0].TrimEnd()
        }
    }

    if ($section) {
        $payload = @{
            hookSpecificOutput = @{
                hookEventName     = "SessionStart"
                additionalContext = "STATE.md の現在地（自動読込・SessionStartフック）:`n`n$section"
            }
        }
        $json = $payload | ConvertTo-Json -Depth 6 -Compress
        [Console]::Out.Write($json)
    }

    exit 0
} catch {
    exit 0
}
