# web-replay 项目架构大纲

<!-- OVERVIEW_START -->
## 概览

### 核心概念
- **录制 (Record)**: 通过 Playwright Codegen API 捕获用户浏览器交互（点击、输入、导航等），生成可复用的 JSON 脚本
- **回放 (Play)**: 读取录制的 JSON 脚本，在 Playwright 中逐步自动执行，每步截图并采集数据，生成回放报告
- **采集 (Collect)**: 在录制/回放过程中拦截网络请求、捕获 console 日志、过滤分析/埋点事件
- **插件体系**: 通过 Claude Code Plugin 提供 Slash Commands、Skills、Hooks 三种接口形式

### 关键数据结构
- **RecordingScript**: 录制脚本核心结构，包含 name、url、steps 数组、collectors 配置
- **RecordingStep**: 单步操作记录，包含 action 类型（navigate/click/fill/type/pressKey/hover/select/waitFor*）、selector、value 等
- **ReplayReport**: 回放报告，包含 scriptName、status（passed/failed/error）、steps 结果数组、collected 采集数据
- **CollectedData**: 采集数据，分为 network（NetworkEntry）、console（ConsoleEntry）、analytics（AnalyticsEntry）三类

### 核心流程
- **录制流程**: 用户操作 -> Playwright Codegen 捕获 -> 解析为 RecordingStep 数组 -> 存储 JSON 脚本
- **回放流程**: 加载脚本 -> 初始化 Playwright 浏览器 -> 启动 Collector -> 逐步执行 + 截图 -> 生成 ReplayReport
- **插件安装流程**: /plugin install -> SessionStart hook 检查依赖 -> /setup 安装 Playwright Chromium

### 与其他系统的交互
- **chrome-devtools-mcp**: 互补工具关系，chrome-devtools-mcp 用于实时调试，web-replay 用于录制/回放/采集；两者可共享同一 Chrome 实例（通过 CDP）
- **Claude Code Plugin 系统**: 通过 .claude-plugin/plugin.json 声明插件，提供 commands/、skills/、hooks/ 三种接口
- **Playwright 引擎**: 底层浏览器自动化引擎，提供 Codegen 录制、Browser Context、网络拦截等能力
<!-- OVERVIEW_END -->

---

## 1. 系统架构

```
web-replay Plugin
├── 接口层
│   ├── Slash Commands (commands/)  — /setup, /record, /play, /list, /replay-bug
│   ├── Skills (skills/)            — record, play, collect (关键词自动触发)
│   └── Hooks (hooks/)              — SessionStart: check-deps.sh
│
├── CLI 层
│   └── src/cli/                    — record.ts, play.ts, list.ts
│
├── 核心服务层
│   ├── Recorder Service            — 交互式录制引擎
│   ├── Player Service              — 脚本回放引擎
│   ├── Collector Service           — 网络/console/埋点采集
│   ├── Script Store                — 脚本文件 CRUD 管理
│   └── Playwright Adapter          — Playwright API 封装
│
├── 数据层
│   ├── recordings/                 — JSON 录制脚本存储
│   └── reports/                    — 回放报告 + 截图存储
│
└── 类型定义
    └── src/types/index.ts          — Zod Schema + TS 类型
```

## 2. 核心模块详解

### 2.1 Recorder Service (`src/core/recorder.ts`)

录制服务，基于 Playwright Codegen API 实现交互式录制。

**工作流程**:
1. 启动 Playwright Codegen 浏览器，用户直接操作
2. Playwright 实时捕获所有交互事件
3. 同时 Collector 采集网络请求和埋点数据
4. 用户停止录制后，将操作序列转换为 RecordingStep 数组
5. 保存为 JSON 文件到 `recordings/` 目录

**录制动作类型** (RecordingStepAction):
| 动作 | 说明 |
|------|------|
| navigate | 页面导航 |
| click | 点击元素 |
| fill | 填充输入框（覆盖式） |
| type | 键入文本（追加式） |
| pressKey | 按键操作 |
| hover | 鼠标悬停 |
| select | 下拉选择 |
| waitForSelector | 等待元素出现 |
| waitForTimeout | 等待固定时间 |

**选择器策略**（优先级从高到低）:
1. `data-testid` 属性
2. `aria-label` 属性
3. `name` 属性
4. `id` 属性
5. CSS path（兜底）

### 2.2 Player Service (`src/core/player.ts`)

回放服务，读取录制脚本并逐步自动执行。

**工作流程**:
1. 从 Script Store 加载录制的 JSON 脚本
2. 初始化 Playwright 浏览器实例（支持 headed/headless 模式）
3. 启动 Collector 进行数据采集
4. 按步骤逐步执行，每步执行前后截图
5. 记录每步执行状态（passed/failed/skipped）、耗时、错误信息
6. 执行完成后生成 ReplayReport 保存到 `reports/` 目录

**报告状态**:
- `passed` — 全部步骤通过
- `failed` — 某步骤执行失败
- `error` — 运行时错误

### 2.3 Collector Service (`src/core/collector.ts`)

数据采集服务，在录制和回放过程中采集三类数据。

**采集能力**:
| 类型 | 数据结构 | 采集方式 |
|------|----------|----------|
| 网络请求 | NetworkEntry | `page.on('request')` + `page.on('response')` |
| Console 日志 | ConsoleEntry | `page.on('console')` |
| 埋点/分析 | AnalyticsEntry | 过滤匹配 analytics.domains 的网络请求 |

**NetworkEntry 包含**:
- url, method, status
- requestBody, responseBody
- timing (dns, tcp, ssl, ttfb, download, total)
- headers

### 2.4 Playwright Adapter (`src/core/playwright-adapter.ts`)

Playwright API 的统一封装层，管理浏览器生命周期。

**职责**:
- 浏览器实例的创建和销毁
- Browser Context 管理
- Codegen API 调用封装
- 网络拦截注册
- HAR / Trace 录制（预留）

### 2.5 Script Store (`src/core/script-store.ts`)

录制脚本的文件系统 CRUD 管理。

**存储格式**: JSON 文件，存放在 `recordings/` 目录下

**操作**:
- 创建/保存脚本
- 读取脚本
- 列出所有脚本
- 删除脚本

## 3. 插件接口体系

### 3.1 Slash Commands (`commands/`)

| 命令 | 文件 | 说明 |
|------|------|------|
| /setup | setup.md | 首次安装依赖（npm install + Playwright Chromium） |
| /record | record.md | 启动交互式录制 |
| /play | play.md | 回放录制的脚本 |
| /list | list.md | 列出所有录制脚本 |
| /replay-bug | replay-bug.md | Bug 验证组合流程（回放 + 断言 + 报告） |

### 3.2 Skills (`skills/`)

| Skill | 触发关键词 | 说明 |
|-------|-----------|------|
| record | "record", "录制", "capture browser", "记录操作" | 录制浏览器操作 |
| play | "replay", "回放", "重放", "run test", "verify fix" | 回放录制脚本 |
| collect | "collect network", "采集网络", "捕获埋点", "monitor requests" | 网络数据采集 |

### 3.3 Hooks (`hooks/`)

| 事件 | 脚本 | 说明 |
|------|------|------|
| SessionStart | check-deps.sh | 检查 node_modules 和 Playwright 是否已安装，未安装则提示运行 /setup |

## 4. 依赖关系

```
dependencies:
  playwright    — 浏览器自动化引擎（含浏览器二进制安装）
  commander     — CLI 命令框架
  zod           — 运行时类型验证
  chalk         — 终端彩色输出
  tsx           — TypeScript 运行时（插件运行需要）
  typescript    — TypeScript 编译器（插件运行需要）

devDependencies:
  @types/node   — Node.js 类型定义
```

**注意**: tsx 和 typescript 被放在 dependencies 而非 devDependencies 中，因为作为 Claude Code 插件运行时需要它们来执行 TypeScript 源码。

## 5. 与 chrome-devtools-mcp 的协作

| 场景 | 工具 |
|------|------|
| 探索/调试页面 | chrome-devtools-mcp |
| 录制复现步骤 | web-replay |
| 自动化回放和数据采集 | web-replay |
| 埋点验证 | web-replay |

两个工具可以通过 CDP 连接共享同一个 Chrome 实例。

## 6. 典型工作流

1. **发现 bug** — 使用 chrome-devtools-mcp 调试页面
2. **录制复现步骤** — `/record` 录制操作流程
3. **验证可复现** — `/play` 回放确认 bug 稳定复现
4. **修复代码** — 开发者修改代码
5. **回归测试** — `/replay-bug` 验证修复有效
