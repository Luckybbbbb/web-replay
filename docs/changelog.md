# 改动记录

<!-- OVERVIEW_START -->
## 概览

### 版本范围
- 7d2a623 (v0.1.0 初始实现) 至 50645f9 (插件安装支持)

### 变更模块
- 插件安装与依赖管理
- Hook 系统（SessionStart 依赖检查）
- README 文档完善

### 关键变更点
- 新增 /setup 命令用于首次依赖安装
- 新增 SessionStart hook 自动检查 Playwright 安装状态
- tsx/typescript 从 devDependencies 移至 dependencies（插件运行时需要）
- README 增加插件安装方式、/setup 命令说明、hooks 目录结构

### 核心流程
- 插件安装流程: /plugin install -> SessionStart hook 检查 -> /setup 安装依赖
- 依赖检查流程: check-deps.sh 检测 node_modules 和 playwright 可用性

### 与其他系统的交互
- Hook 系统: SessionStart 事件触发 check-deps.sh 脚本
- CLI 系统: /setup 命令调用 npm install + playwright install
<!-- OVERVIEW_END -->

---

## 版本索引

| 版本范围 | 日期 | 说明 |
|----------|------|------|
| 7d2a623..50645f9 | 2026-05-29 | 插件安装支持：/setup 命令、依赖检查 Hook |
| 653cf2b..7d2a623 | 2026-05-28 | v0.1.0 初始实现：录制、回放、采集核心功能 |

---

## 50645f9 — 插件安装支持

**日期**: 2026-05-29
**版本范围**: d69aa8f..50645f9
**提交信息**: feat: add plugin install support with setup command and dependency check

### 插件安装系统

- **新增** `commands/setup.md` — /setup 命令定义，引导用户安装 Playwright Chromium
- **新增** `hooks/hooks.json` — SessionStart hook 配置，绑定 check-deps.sh 脚本
- **新增** `hooks/scripts/check-deps.sh` — 依赖检查脚本，检测 node_modules 和 playwright 可用性

### 依赖管理调整

- **修改** `package.json`
  - 将 `tsx` (^4.22.3) 和 `typescript` (^6.0.3) 从 devDependencies 移至 dependencies
  - 新增 `setup` 脚本: `npm install && npx playwright install chromium`
  - 新增 `postinstall` 脚本: `npx playwright install chromium`

### 文档更新

- **修改** `README.md`
  - 增加插件 CLI 安装方式说明（/plugin marketplace add + /plugin install）
  - 增加 First-Time Setup 章节和 /setup 命令说明
  - 增加 hooks/ 目录结构到 Project Structure
  - 调整 Slash Commands 表格，新增 /setup 行
  - 将 CLI 命令移至"本地开发"子章节
  - 选择器策略增加 aria-label 优先级说明

---

## 7d2a623 — v0.1.0 初始实现

**日期**: 2026-05-28
**版本范围**: 653cf2b..7d2a623
**提交信息**: feat: implement chrome-debug-agent plugin v0.1.0

### 核心功能

- **新增** `src/index.ts` — CLI 入口，注册 record/play/list 命令
- **新增** `src/core/recorder.ts` — 交互式录制引擎，基于 Playwright Codegen API
- **新增** `src/core/player.ts` — 脚本回放引擎，逐步执行并截图
- **新增** `src/core/collector.ts` — 数据采集服务，网络拦截 + console 监听 + 埋点过滤
- **新增** `src/core/playwright-adapter.ts` — Playwright API 封装层
- **新增** `src/core/script-store.ts` — 录制脚本 CRUD 管理
- **新增** `src/types/index.ts` — 完整的 Zod Schema + TypeScript 类型定义

### 插件接口

- **新增** `commands/record.md` — /record 命令定义
- **新增** `commands/play.md` — /play 命令定义
- **新增** `commands/list.md` — /list 命令定义
- **新增** `commands/replay-bug.md` — /replay-bug 命令定义（组合流程）
- **新增** `skills/record/SKILL.md` — 录制 skill 自动触发
- **新增** `skills/play/SKILL.md` — 回放 skill 自动触发
- **新增** `skills/collect/SKILL.md` — 采集 skill 自动触发

### 配置与文档

- **新增** `package.json` — 项目配置和依赖声明
- **新增** `tsconfig.json` — TypeScript 编译配置
- **新增** `.claude-plugin/plugin.json` — Claude Code 插件声明

---

## d69aa8f — 文档与重命名

**日期**: 2026-05-28
**版本范围**: 653cf2b..d69aa8f
**提交信息**: docs: add README, marketplace.json, and rename to web-replay

### 文档

- **新增** `README.md` — 完整的项目说明文档
- **新增** `.claude-plugin/marketplace.json` — 插件市场信息

### 重命名

- 项目从 chrome-debug-agent 重命名为 web-replay
