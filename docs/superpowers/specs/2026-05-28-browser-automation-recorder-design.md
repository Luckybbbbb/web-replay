# Chrome Debug Agent — 浏览器自动化录制/回放插件设计

## 概述

chrome-debug-agent 是一个 Claude Code 插件，提供浏览器操作的录制、回放和全链路数据采集能力。基于 Playwright 作为底层引擎，以 Claude Code 插件形式存在，包含 CLI 工具、Skill 使用方法和 Hook 关键节点注入。

### 核心目标

- **录制**：捕获用户浏览器操作（点击、输入、导航、等待），生成可复用脚本
- **回放**：一键执行录制脚本，自动截图、采集网络请求、console 日志
- **埋点采集**：在录制和回放过程中，拦截并记录分析/追踪请求
- **断言验证**：回放时验证网络状态、埋点事件、console 输出

### 目标用户

开发/测试团队内部，用于重现 bug、回归测试、埋点验证。

---

## 技术选型

| 组件 | 技术 | 理由 |
|------|------|------|
| 底层引擎 | Playwright | 成熟的浏览器自动化框架，内置 Codegen 录制器、Trace Viewer、HAR 录制 |
| 运行时 | Node.js + TypeScript | 与 Playwright 和 Claude Code 插件生态一致 |
| 脚本存储 | 本地 JSON 文件 | 简单、可版本控制、可导出为 Playwright 测试 |
| Claude 集成 | Claude Code Plugin（.claude-plugin） | 原生支持 CLI、Skill、Hook 三种接口 |
| 网络拦截 | Playwright `page.on('request')` + HAR | Playwright 原生支持，零额外依赖 |

---

## 架构

```
┌─────────────────────────────────────────────────┐
│              Chrome Debug Agent Plugin           │
│          (Claude Code Plugin / npm package)      │
├─────────────────────────────────────────────────┤
│                                                   │
│  ┌─────────┐  ┌─────────┐  ┌──────────────────┐ │
│  │  CLI     │  │ Skill   │  │  Hook            │ │
│  │  Tools   │  │ Layer   │  │  Injectors       │ │
│  └────┬─────┘  └────┬────┘  └────────┬─────────┘ │
│       │              │                │           │
│  ┌────▼──────────────▼────────────────▼─────────┐│
│  │           Core Engine (TypeScript)            ││
│  │  ┌──────────┐ ┌──────────┐ ┌──────────────┐  ││
│  │  │ Recorder │ │  Player  │ │   Collector   │  ││
│  │  │ Service  │ │ Service  │ │   Service     │  ││
│  │  └────┬─────┘ └────┬─────┘ └──────┬───────┘  ││
│  │       │             │              │          ││
│  │  ┌────▼─────────────▼──────────────▼────────┐ ││
│  │  │         Playwright Adapter               │ ││
│  │  │  (codegen API + test runner + HAR/trace) │ ││
│  │  └──────────────────────────────────────────┘ ││
│  │                                               ││
│  │  ┌──────────────────────────────────────────┐ ││
│  │  │         Script Store (JSON/JS files)      │ ││
│  │  └──────────────────────────────────────────┘ ││
│  └───────────────────────────────────────────────┘│
└─────────────────────────────────────────────────┘
```

### 核心模块

1. **Recorder Service** — 录制服务，调用 Playwright Codegen API 录制浏览器操作
2. **Player Service** — 回放服务，执行录制的脚本，生成回放报告
3. **Collector Service** — 采集服务，拦截网络请求、捕获 console 日志、过滤埋点
4. **Script Store** — 脚本存储管理，支持 CRUD 和导出
5. **Playwright Adapter** — 对 Playwright API 的封装层

### 接口层

- **CLI Tools** — 命令行工具（`record`、`play`、`list`、`export`、`collect`）
- **Skill Layer** — Claude Code skill 接口（`/record`、`/play`、`/collect`、`/replay-bug`）
- **Hook Injectors** — 关键节点注入（页面加载、网络请求）

---

## 录制流程（Recorder Service）

### 录制模式 1：交互式录制

用户在 Playwright Codegen 打开的浏览器中直接操作，Playwright 实时捕获所有交互。

```
用户 → CLI/Skill → 启动 Playwright Codegen 浏览器
                           ↓
                     用户在浏览器中操作
                           ↓
                     Playwright 实时捕获操作
                           ↓
                     同时 Collector 采集网络/埋点
                           ↓
                     用户点击停止 / 按 Ctrl+C
                           ↓
                     生成录制脚本（JSON + 可选 JS）
```

### 录制模式 2：LLM 引导录制

LLM 根据用户描述的步骤，通过 chrome-devtools-mcp 逐步执行操作，同时记录工具调用序列。

```
用户 → 描述复现步骤 → LLM 调用 chrome-devtools-mcp 工具逐步执行
                              ↓
                     同时记录每步 MCP 工具调用序列
                              ↓
                     将 MCP 工具调用序列转换为 Playwright 脚本
                              ↓
                     生成可复用的录制脚本
```

### 脚本存储格式

录制脚本以 JSON 文件存储在 `recordings/` 目录下：

```json
{
  "name": "reproduce-login-bug",
  "description": "重现登录页面在输入特殊字符时的崩溃问题",
  "url": "https://example.com/login",
  "createdAt": "2026-05-28T10:30:00Z",
  "steps": [
    {
      "action": "navigate",
      "url": "https://example.com/login"
    },
    {
      "action": "fill",
      "selector": "#username",
      "value": "test<script>"
    },
    {
      "action": "click",
      "selector": "#login-btn"
    },
    {
      "action": "waitForSelector",
      "selector": ".error-msg",
      "timeout": 5000
    }
  ],
  "collectors": {
    "network": true,
    "console": true,
    "analytics": {
      "domains": ["google-analytics.com", "facebook.com"],
      "events": []
    }
  },
  "assertions": [
    {
      "type": "network",
      "matcher": "url contains '/api/login'",
      "expect": "status === 200"
    },
    {
      "type": "analytics",
      "matcher": "event equals 'login_click'",
      "expect": "fired"
    }
  ]
}
```

### 选择器策略

录制时使用多种选择器策略（Playwright 自动生成），按优先级：

1. `data-testid` 属性（最稳定）
2. `aria-*` 属性（语义化）
3. `id` 属性
4. CSS 选择器（最后备选）

---

## 回放流程（Player Service）

### 回放步骤

```
play 命令 → 加载录制脚本
                  ↓
           初始化 Playwright 浏览器（可选 headed/headless）
                  ↓
           启动 Collector（网络拦截、console 监听、埋点过滤）
                  ↓
           按步骤逐步执行（每步截图快照）
                  ↓
           执行完成 → 生成回放报告
```

### 回放报告

```json
{
  "scriptName": "reproduce-login-bug",
  "status": "passed | failed | error",
  "duration": 3240,
  "timestamp": "2026-05-28T10:35:00Z",
  "steps": [
    {
      "index": 0,
      "action": "navigate",
      "status": "passed",
      "duration": 450,
      "screenshot": "reports/login-bug-20260528/step-0.png"
    },
    {
      "index": 1,
      "action": "fill",
      "status": "passed",
      "duration": 120,
      "screenshot": "reports/login-bug-20260528/step-1.png"
    },
    {
      "index": 2,
      "action": "click",
      "status": "failed",
      "error": "Element not found: #login-btn",
      "duration": 5000,
      "screenshot": "reports/login-bug-20260528/step-2.png"
    }
  ],
  "collected": {
    "network": [
      {
        "url": "https://api.example.com/login",
        "method": "POST",
        "status": 500,
        "requestBody": "{\"username\":\"test<script>\"}",
        "responseBody": "{\"error\":\"Internal Server Error\"}",
        "timing": { "wait": 120, "receive": 45 }
      }
    ],
    "console": [
      {
        "type": "error",
        "text": "Uncaught TypeError: Cannot read property 'data' of undefined",
        "location": "app.js:142:15",
        "timestamp": "2026-05-28T10:35:02Z"
      }
    ],
    "analytics": [
      {
        "url": "https://google-analytics.com/collect",
        "params": {
          "t": "event",
          "ec": "login",
          "ea": "click",
          "el": "login-btn"
        },
        "timestamp": "2026-05-28T10:35:01Z"
      }
    ]
  },
  "assertionResults": [
    {
      "assertion": "network: url contains '/api/login' → status === 200",
      "result": "failed",
      "actual": "status === 500"
    },
    {
      "assertion": "analytics: event equals 'login_click' → fired",
      "result": "passed",
      "actual": "fired 1 time"
    }
  ]
}
```

---

## 采集服务（Collector Service）

### 网络拦截

通过 Playwright 的 `page.on('request')` 和 `page.on('response')` 拦截所有网络请求：

```typescript
page.on('request', (request) => {
  const url = request.url();
  if (isAnalyticsRequest(url, config.analytics.domains)) {
    collected.analytics.push({
      url,
      method: request.method(),
      params: parseAnalyticsParams(url, request),
      timestamp: Date.now()
    });
  }
  collected.network.push({
    url,
    method: request.method(),
    headers: request.headers(),
    postData: request.postData()
  });
});
```

### HAR 录制

通过 Playwright 的 `context.recordHar()` 完整录制所有 HTTP 请求/响应，保存为 HAR 文件。可独立用于网络分析或作为 mock 数据源。

### Trace 录制

通过 `context.tracing.start()` / `stop()` 录制完整执行轨迹，包含 DOM 快照、网络请求、console 日志。可用 `npx playwright show-trace` 查看。

### Console 监听

```typescript
page.on('console', (msg) => {
  collected.console.push({
    type: msg.type(),
    text: msg.text(),
    location: msg.location()
  });
});
```

---

## CLI 命令

### record — 录制

```bash
# 交互式录制（打开浏览器让用户操作）
chrome-debug-agent record --url <url> --name <name>

# 带埋点采集的录制
chrome-debug-agent record --url <url> --name <name> --collect-analytics --analytics-domains "ga.example.com,fb.example.com"

# 带网络录制的录制
chrome-debug-agent record --url <url> --name <name> --har --trace
```

### play — 回放

```bash
# 回放脚本（默认 headless）
chrome-debug-agent play <name>

# 有头模式（显示浏览器窗口）
chrome-debug-agent play <name> --headed

# 同时录制 trace 和 HAR
chrome-debug-agent play <name> --trace --har

# 指定环境变量
chrome-debug-agent play <name> --env BASE_URL=https://staging.example.com
```

### list — 列出

```bash
# 列出所有录制脚本
chrome-debug-agent list

# 以 JSON 格式输出
chrome-debug-agent list --json
```

### export — 导出

```bash
# 导出为 Playwright 测试脚本
chrome-debug-agent export <name> --format playwright

# 导出为 JSON
chrome-debug-agent export <name> --format json

# 导出为 Puppeteer 脚本
chrome-debug-agent export <name> --format puppeteer
```

### collect — 单独采集

```bash
# 在指定页面采集网络/埋点数据
chrome-debug-agent collect --url <url> --analytics-domains "ga.example.com"

# 采集指定时长
chrome-debug-agent collect --url <url> --duration 30
```

---

## Skill 设计

| Skill 名称 | 触发方式 | 说明 |
|---|---|---|
| `record` | `/record` | 启动交互式录制。LLM 引导用户描述复现步骤，或打开浏览器让用户操作 |
| `play` | `/play` | 回放指定录制脚本。LLM 解读回放报告，判断是否成功复现 |
| `collect` | `/collect` | 在指定页面采集网络/埋点数据。LLM 分析采集结果 |
| `replay-bug` | `/replay-bug` | 组合流程：回放 + 断言 + 生成报告。用于验证 bug 修复 |

---

## Hook 注入设计

### on-page-load Hook

页面加载完成后自动触发：
- 捕获页面基本信息（URL、title、viewport）
- 启动 console 监听
- 如果配置了 analytics domains，启动埋点过滤
- 可配置在加载时自动截图

### on-network-request Hook

网络请求发出时触发：
- 过滤匹配 analytics domains 的请求
- 记录请求参数和时间戳
- 可配置只记录特定类型的请求（XHR/Fetch）

---

## 与 chrome-devtools-mcp 的协作

### 双引擎模式

chrome-devtools-mcp 和 chrome-debug-agent 是互补关系：

| 场景 | 工具 | 用途 |
|------|------|------|
| 探索/调试 | chrome-devtools-mcp | 实时交互、查看 DOM、检查 console |
| 录制复现步骤 | chrome-debug-agent | 录制用户操作、生成脚本 |
| 自动化回放 | chrome-debug-agent | 一键回放、采集数据、生成报告 |
| 埋点验证 | chrome-debug-agent | 采集分析请求、验证埋点是否正确 |

### 共享 Chrome 实例

两个工具可连接同一个 Chrome 实例，避免浏览器冲突：

- chrome-devtools-mcp 通过 `browserURL` 连接（如 `http://127.0.0.1:9222`）
- chrome-debug-agent 的 Playwright 通过 `connectOverCDP` 连接同一实例

### 典型工作流

1. **发现 bug** — 用 chrome-devtools-mcp 调试页面，发现问题
2. **录制复现步骤** — 切换到 chrome-debug-agent 录制模式，复现问题
3. **验证可复现** — 回放录制脚本，确认 bug 可稳定复现
4. **修复后回归** — 代码修复后回放同一脚本，验证 bug 已修复

---

## 文件结构

```
chrome-debug-agent/
├── package.json
├── tsconfig.json
├── .claude-plugin/
│   └── plugin.json                  # Claude Code 插件声明
├── src/
│   ├── index.ts                      # 主入口（CLI 注册）
│   ├── cli/
│   │   ├── record.ts                 # record 命令
│   │   ├── play.ts                   # play 命令
│   │   ├── list.ts                   # list 命令
│   │   ├── export.ts                 # export 命令
│   │   └── collect.ts                # collect 命令
│   ├── core/
│   │   ├── recorder.ts               # 录制服务
│   │   ├── player.ts                 # 回放服务
│   │   ├── collector.ts              # 采集服务
│   │   ├── script-store.ts           # 脚本存储管理
│   │   ├── playwright-adapter.ts     # Playwright 封装层
│   │   └── reporter.ts              # 回放报告生成
│   └── types/
│       └── index.ts                  # 类型定义
├── skills/
│   ├── record.md                     # /record skill
│   ├── play.md                       # /play skill
│   ├── collect.md                    # /collect skill
│   └── replay-bug.md                 # /replay-bug skill
├── hooks/
│   ├── on-page-load.md               # 页面加载 hook
│   └── on-network-request.md         # 网络请求 hook
├── recordings/                       # 录制脚本存储目录
│   └── .gitkeep
└── reports/                          # 回放报告存储目录
    └── .gitkeep
```

---

## 依赖

- `playwright` — 浏览器自动化引擎
- `playwright-core` — Playwright 核心库
- `commander` — CLI 框架
- `zod` — 参数验证
- `chalk` — 终端彩色输出

---

## MVP 范围

第一版只实现核心流程：

1. **CLI record** — 交互式录制，保存为 JSON
2. **CLI play** — 回放录制脚本，生成报告
3. **CLI list** — 列出录制脚本
4. **Collector 基础版** — 网络拦截 + console 监听
5. **Skill: record + play** — Claude Code skill 触发

暂不实现：
- LLM 引导录制（模式 2）
- HAR/Trace 录制
- 断言验证
- 导出为 Playwright 测试
- Hook 注入
- 埋点域名自动检测
