# Minstrel: SessionStart フック
# STATE.md の「現在地」セクションを Claude のコンテキストに自動投入し、
# セッション開始時点の git HEAD と未コミット変更のベースラインをリポジトリ外の
# 一時ファイルに記録する（Stop フック側で「セッション中に何が変わったか」を
# 判定するために使う。セッション開始前から存在した未コミット変更を
# 「今回の変更」と誤判定しないための基準点）。
# 失敗してもセッション開始を止めない（fail-open）。

[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
[Console]::InputEncoding  = New-Object System.Text.UTF8Encoding($false)

function Get-UncommittedSignatureLines {
    # 現在の未コミット変更（tracked の変更 + untracked）を
    # "ステータスコード|内容ハッシュ|パス" の行の配列として返す。
    # リポジトリルートで実行されること前提（呼び出し側で Push-Location 済み）。
    $lines = @()
    $statusLines = @(git status --porcelain=v1 --untracked-files=all 2>$null | Where-Object { $_ })
    foreach ($line in $statusLines) {
        $code = $line.Substring(0, 2)
        $path = $line.Substring(3)
        if ($path -match ' -> ') {
            $path = ($path -split ' -> ')[-1]
        }
        $hash = "DELETED"
        if (Test-Path -LiteralPath $path -PathType Leaf) {
            $h = git hash-object -- "$path" 2>$null
            if ($h) { $hash = $h.Trim() }
        }
        $lines += "$code|$hash|$path"
    }
    return $lines
}

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

                $baselineFile = Join-Path $markerDir ("$($inputJson.session_id).uncommitted.txt")
                $baselineLines = Get-UncommittedSignatureLines
                Set-Content -Path $baselineFile -Value $baselineLines -Encoding utf8
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
