# web-replay 项目文档

## 项目简介

web-replay 是一个 Claude Code 插件，提供浏览器操作的录制、回放和全链路数据采集能力。基于 Playwright 引擎，支持交互式录制、自动回放、网络请求采集、console 日志捕获和埋点验证。

## 技术栈

- **语言**: TypeScript (Node.js 18+)
- **浏览器引擎**: Playwright
- **CLI 框架**: Commander.js
- **类型验证**: Zod
- **构建工具**: tsc
- **插件体系**: Claude Code Plugin (.claude-plugin)

## 核心模块

| 模块 | 路径 | 说明 |
|------|------|------|
| CLI 入口 | `src/index.ts` | 命令行入口，注册 record/play/list 命令 |
| 录制服务 | `src/core/recorder.ts` | 交互式录制引擎 |
| 回放服务 | `src/core/player.ts` | 脚本回放引擎，生成报告 |
| 采集服务 | `src/core/collector.ts` | 网络拦截、console 监听、埋点过滤 |
| Playwright 适配器 | `src/core/playwright-adapter.ts` | Playwright API 封装层 |
| 脚本存储 | `src/core/script-store.ts` | 录制脚本的 CRUD 管理 |
| 类型定义 | `src/types/index.ts` | Zod Schema + TypeScript 类型 |

## 插件接口

| 接口 | 路径 | 说明 |
|------|------|------|
| Slash Commands | `commands/*.md` | /setup, /record, /play, /list, /replay-bug |
| Skills | `skills/*/SKILL.md` | record, play, collect (自动触发) |
| Hooks | `hooks/hooks.json` | SessionStart 时检查依赖 |

## 文档版本追踪

- **上次文档更新版本**: 7d2a623 (初始版本 v0.1.0)
- **当前文档更新版本**: 50645f9
- **更新日期**: 2026-05-29

## 📋 项目文档索引

- [改动记录](docs/changelog.md) — 按版本记录代码变更历史
- [项目架构大纲](docs/architecture/overview.md) — 项目总览与系统架构
- [经验总结](docs/lessons-learned.md) — Bug修复经验与开发教训
