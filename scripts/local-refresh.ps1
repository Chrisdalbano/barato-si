# barato.si — local collector run. Scheduled on the owner's PC because
# techbargains.com (Cloudflare) challenges GitHub's runner IPs but not this one.
# Pulls, collects, commits the data and pushes; the Pages workflow then deploys
# and, finding Techbargains blocked, carries these offers over (see NOTES.md).
# Git writes progress to stderr, which PowerShell 5.1 would treat as an error,
# so every command runs through cmd.exe and is judged by its exit code only.
$ErrorActionPreference = 'Continue'
$repo = Resolve-Path "$PSScriptRoot\.."
Set-Location $repo
$log = Join-Path $repo 'data\local-refresh.log'
function Step($label, $cmd) {
  "--- $label" | Out-File -Append -Encoding utf8 $log
  $out = cmd /c "$cmd 2>&1"
  $out | Out-File -Append -Encoding utf8 $log
  if ($LASTEXITCODE -ne 0) { throw "$label failed ($LASTEXITCODE)" }
}
"=== $(Get-Date -Format o)" | Out-File -Append -Encoding utf8 $log
try {
  # Generated files are committed by this task AND by CI, so a rebase can
  # conflict on them. The run that is about to happen regenerates them anyway:
  # keep whichever side and move on.
  cmd /c 'git pull --rebase --autostash origin main 2>&1' | Out-File -Append -Encoding utf8 $log
  if ($LASTEXITCODE -ne 0) {
    cmd /c 'git checkout --theirs -- public data 2>&1' | Out-File -Append -Encoding utf8 $log
    cmd /c 'git add public data 2>&1' | Out-File -Append -Encoding utf8 $log
    $env:GIT_EDITOR = 'true'
    Step 'rebase-continue' 'git rebase --continue'
  }
  Step 'deals' 'npm.cmd run deals'
  Step 'stage' 'git add public data/classify-cache.json'
  cmd /c 'git diff --cached --quiet' | Out-Null
  if ($LASTEXITCODE -ne 0) {
    Step 'commit' 'git commit -q -m "chore: refresh deals (local run)"'
    Step 'push' 'git push origin main'
  } else { "nothing to commit" | Out-File -Append -Encoding utf8 $log }
  "ok" | Out-File -Append -Encoding utf8 $log
} catch {
  "FAILED: $_" | Out-File -Append -Encoding utf8 $log
  exit 1
}
