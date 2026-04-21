[CmdletBinding(SupportsShouldProcess = $true)]
param(
    [Parameter(Mandatory = $true)]
    [string]$Task,
    [string]$Domain = "",
    [string]$BaseBranch = "main"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Normalize-Slug([string]$Value) {
    $slug = $Value.ToLowerInvariant().Trim()
    $slug = [regex]::Replace($slug, "[^a-z0-9]+", "-")
    $slug = $slug.Trim("-")
    if ([string]::IsNullOrWhiteSpace($slug)) {
        throw "Value '$Value' produced an empty slug. Use letters or numbers."
    }
    return $slug
}

$taskSlug = Normalize-Slug $Task
$domainSlug = if ([string]::IsNullOrWhiteSpace($Domain)) { "" } else { Normalize-Slug $Domain }
$branchName = if ($domainSlug) { "feature/$domainSlug-$taskSlug" } else { "feature/$taskSlug" }
$worktreeName = if ($domainSlug) { "wt-$domainSlug-$taskSlug" } else { "wt-$taskSlug" }

$repoRoot = (Resolve-Path ".").Path
$parentDir = Split-Path -Parent $repoRoot
$worktreePath = Join-Path $parentDir $worktreeName

if (-not (Test-Path (Join-Path $repoRoot ".git"))) {
    throw "Run this script from the repository root."
}

$existingBranch = git show-ref --verify --quiet "refs/heads/$branchName"
if ($LASTEXITCODE -eq 0) {
    throw "Branch '$branchName' already exists locally."
}

if (Test-Path $worktreePath) {
    throw "Worktree path already exists: $worktreePath"
}

Write-Host "Creating branch: $branchName"
Write-Host "Creating worktree: $worktreePath"
$ranGitWorktreeAdd = $false
if ($PSCmdlet.ShouldProcess($worktreePath, "Create worktree and branch '$branchName' from '$BaseBranch'")) {
    git worktree add $worktreePath -b $branchName $BaseBranch
    $ranGitWorktreeAdd = $true
}

if ($ranGitWorktreeAdd -and $LASTEXITCODE -ne 0) {
    throw "git worktree add failed."
}

Write-Host ""
Write-Host "Done."
Write-Host "Branch: $branchName"
Write-Host "Path:   $worktreePath"
Write-Host "Next:   cd `"$worktreePath`""
