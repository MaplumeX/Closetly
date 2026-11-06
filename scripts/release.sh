#!/usr/bin/env bash
# 发布新版本：更新版本号 → 提交 → 打 tag → 推送（推送后 GitHub Actions 构建镜像并创建 Release）
# 用法：scripts/release.sh 0.2.0        正式版
#       scripts/release.sh 0.2.0-rc.1   预发布版（不会更新 latest 镜像）
set -euo pipefail

version="${1:?用法：$0 <版本号，如 0.2.0>}"
version="${version#v}"
tag="v$version"
cd "$(git rev-parse --show-toplevel)"

die() { echo "错误：$*" >&2; exit 1; }

[[ "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.]+)?$ ]] || die "版本号需要符合 SemVer，例如 0.2.0 或 0.2.0-rc.1"
[ "$(git branch --show-current)" = main ] || die "请在 main 分支上发版"
[ -z "$(git status --porcelain)" ] || die "工作区有未提交的改动"
git fetch --quiet origin main --tags
[ "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)" ] || die "本地 main 与 origin/main 不一致，请先 pull / push"
! git rev-parse -q --verify "refs/tags/$tag" >/dev/null || die "tag $tag 已存在"

(cd backend && uv version "$version" >/dev/null)   # 同时更新 pyproject.toml 和 uv.lock
if [ -n "$(git status --porcelain)" ]; then
  git commit --quiet -am "Release $tag"
fi
git tag -a "$tag" -m "$tag"

echo
git log --oneline -1
echo "已在本地创建 $tag。推送后将自动构建并发布 ghcr.io 镜像和 GitHub Release。"
read -rp "现在推送到 origin？[y/N] " ok
if [[ "$ok" =~ ^[Yy]$ ]]; then
  git push --atomic origin main "$tag"
else
  echo "未推送。稍后执行：git push --atomic origin main $tag"
  echo "放弃本次发版：git tag -d $tag && git reset --hard origin/main"
fi
