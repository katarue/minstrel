# .githooks/pre-commit.ps1
# Pre-commit hook: R-DIR-01 violation detector (directory naming rules)
# Adapted from AI News Pipeline for Minstrel
# Note: ASCII-only output to avoid encoding issues when called from bash

$stagedFiles = git diff --cached --name-only
if (-not $stagedFiles) { exit 0 }

$violations = @()

# Check 1: R-DIR-01 - forbidden state-suffix in staged file paths
$forbiddenPathPatterns = @(
    '\.NEW[/\\]', '\.NEW$',
    '\.OLD[/\\]', '\.OLD$',
    '_v\d+[/\\]', '_v\d+$',
    '_temp[/\\]', '_temp$',
    '_backup[/\\]', '_backup$',
    '_old[/\\]', '_old$',
    '_new[/\\]', '_new$'
)
foreach ($file in $stagedFiles) {
    foreach ($pat in $forbiddenPathPatterns) {
        if ($file -match $pat) {
            $violations += "[R-DIR-01] Forbidden suffix in path: $file"
            break
        }
    }
}

if ($violations.Count -eq 0) { exit 0 }

Write-Host ""
Write-Host "============================================"
Write-Host "  COMMIT BLOCKED: R-DIR-01 violation"
Write-Host "============================================"
Write-Host ""
foreach ($v in $violations) {
    Write-Host "  [FAIL] $v"
}
Write-Host ""
Write-Host "  See: docs/memory_bank/rules.md (R-DIR-01 to R-DIR-07)"
Write-Host "  Emergency bypass: git commit --no-verify"
Write-Host "  (Record the reason in memory-bank if bypassing)"
Write-Host ""
exit 1
