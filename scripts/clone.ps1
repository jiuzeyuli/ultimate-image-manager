Param(
    [string]$repo = "https://github.com/OWNER/REPO.git",
    [string]$target = "."
)

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Error "Git 未安装或不可用，请先安装 Git: https://git-scm.com/downloads"
    exit 1
}

git clone $repo $target
if ($LASTEXITCODE -eq 0) {
    Write-Host "克隆完成： $target"
} else {
    Write-Error "git clone 失败，退出码 $LASTEXITCODE"
    exit $LASTEXITCODE
}
