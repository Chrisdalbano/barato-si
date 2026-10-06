# barato.si — local collector run. Scheduled on the owner's PC because
# techbargains.com (Cloudflare) challenges GitHub's runner IPs but not this one.
# Pulls, collects, commits the data and pushes; the Pages workflow then deploys
# and, finding Techbargains blocked, carries these offers over (see NOTES.md).
$ErrorActionPreference = 'Stop'
Set-Location "$PSScriptRoot\.."
$log = Join-Path $PSScriptRoot '..\data\local-refresh.log'
"=== $(Get-Date -Format o)" | Out-File -Append -Encoding utf8 $log
try {
  git pull --rebase origin main 2>&1 | Out-File -Append -Encoding utf8 $log
  npm.cmd run deals 2>&1 | Out-File -Append -Encoding utf8 $log
  git add public data/classify-cache.json
  git diff --cached --quiet
  if ($LASTEXITCODE -ne 0) {
    git commit -q -m 'chore: refresh deals (local run)' 2>&1 | Out-File -Append -Encoding utf8 $log
    git push origin main 2>&1 | Out-File -Append -Encoding utf8 $log
  }
  "ok" | Out-File -Append -Encoding utf8 $log
} catch {
  "FAILED: $_" | Out-File -Append -Encoding utf8 $log
}
