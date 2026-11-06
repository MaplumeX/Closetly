#!/usr/bin/env bash
# 生成某个版本的 Release Notes：列出与上一个正式版之间的提交。
# 用法：scripts/release-notes.sh v0.2.0
set -euo pipefail

tag="${1:?用法：$0 <tag>}"
repo="${GITHUB_REPOSITORY:-MaplumeX/Closetly}"
image="ghcr.io/${repo,,}"
version="${tag#v}"

# 上一个正式版（跳过 rc 等预发布版本）
prev="$(git tag --list 'v*.*.*' --sort=-v:refname --merged "$tag^" | grep -v -- - | head -n1 || true)"
range="${prev:+$prev..}$tag"

migrations=false
if [ -n "$prev" ] && ! git diff --quiet "$prev" "$tag" -- backend/src/closetly/migrations/versions; then
  migrations=true
fi

if $migrations; then
  cat <<MD
> [!IMPORTANT]
> 本版本包含数据库迁移。启动时会自动把旧数据库备份到 \`data/backups/\`；迁移只能向前执行，回退到旧版本时需要用这份备份替换 \`data/closetly.db\`。

MD
fi

cat <<MD
## 更新内容

$(git log --no-merges --pretty='- %s (%h)' "$range")

## 升级

\`\`\`bash
# .env 中设置 CLOSETLY_VERSION=${version}，或保持 latest
docker compose pull && docker compose up -d
\`\`\`

镜像：\`${image}:${version}\`（linux/amd64、linux/arm64）
MD

if [ -n "$prev" ]; then
  echo
  echo "**完整改动**：https://github.com/${repo}/compare/${prev}...${tag}"
fi
