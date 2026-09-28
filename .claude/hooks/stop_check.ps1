# Minstrel: Stop フック
# 「STATE.md 以外の変更（未コミット含む）または新しいコミットがある」のに
# 「STATE.md がセッション開始以降に更新されていない」場合、終了をブロックして
# STATE.md の「現在地」更新を促す。
# 無限ループ防止: stop_hook_active が true のときは何もしない。
# 判定に必要な情報が無い/エラーが起きた場合は、常に通す（fail-open）。

[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
[Console]::InputEncoding  = New-Object System.Text.UTF8Encoding($false)

try {
    $stdin = [Console]::In.ReadToEnd()
    $stdin = $stdin.TrimStart([char]0xFEFF)  # 先頭にBOM文字が付くケースへの防御
    $inputJson = $stdin | ConvertFrom-Json

    if ($inputJson.stop_hook_active -eq $true) {
        exit 0
    }

    $repoRoot = $env:CLAUDE_PROJECT_DIR
    if (-not $repoRoot) {
        $repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
    }

    if (-not $inputJson.session_id) {
        exit 0
    }
    $markerDir = Join-Path $env:TEMP "claude_minstrel_session_heads"
    $markerFile = Join-Path $markerDir ("$($inputJson.session_id).txt")
    if (-not (Test-Path $markerFile)) {
        # このセッション開始時点の記録が無い（機能導入前に始まったセッション等）→ 判定できないので通す
        exit 0
    }

    Push-Location $repoRoot
    try {
        $headAtStart = (Get-Content -Path $markerFile -Raw).Trim()

        git cat-file -e "$headAtStart^{commit}" 2>$null
        if ($LASTEXITCODE -ne 0) {
            exit 0  # 記録された HEAD が無効 → 判定できないので通す
        }

        $currentHead = (git rev-parse HEAD 2>$null).Trim()

        $workingTreeChanges = @(git diff --name-only HEAD 2>$null | Where-Object { $_ })
        $untracked          = @(git ls-files --others --exclude-standard 2>$null | Where-Object { $_ })
        $uncommitted = @($workingTreeChanges + $untracked | Select-Object -Unique)

        $otherUncommittedCount = @($uncommitted | Where-Object { $_ -ne "STATE.md" }).Count
        $stateMdUncommitted    = $uncommitted -contains "STATE.md"

        $newCommitCount = 0
        $stateMdInNewCommits = $false
        if ($headAtStart -ne $currentHead) {
            $countOutput = git rev-list "$headAtStart..$currentHead" --count 2>$null
            if ($countOutput) { $newCommitCount = [int]$countOutput }
            $changedInCommits = @(git diff --name-only $headAtStart $currentHead 2>$null | Where-Object { $_ })
            $stateMdInNewCommits = $changedInCommits -contains "STATE.md"
        }

        $hasOtherChange = ($otherUncommittedCount -gt 0) -or ($newCommitCount -gt 0)
        $stateMdUpdated = $stateMdUncommitted -or $stateMdInNewCommits

        if ($hasOtherChange -and -not $stateMdUpdated) {
            [Console]::Error.WriteLine("STATE.md の「現在地」セクションを更新してから終了してください。今回の作業で完了したこと・判明した事実・進行中・次のステップを反映し、同じコミットに含めてください。")
            exit 2
        }

        exit 0
    } finally {
        Pop-Location
    }
} catch {
    exit 0
}
