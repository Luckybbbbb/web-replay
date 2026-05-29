# 经验总结

<!-- OVERVIEW_START -->
## 概览

### 问题分类
- **依赖管理**: 插件运行时依赖 vs 开发依赖的区分
- **用户体验**: 首次安装引导和依赖检查机制

### 关键经验
- Claude Code 插件的运行时依赖（如 tsx、typescript）必须放在 dependencies 而非 devDependencies
- 插件首次安装后需要提供依赖安装机制（/setup 命令 + SessionStart hook 提醒）
- postinstall 脚本在插件安装时自动触发 Playwright 浏览器安装

### 预防建议
- 新增运行时依赖时，区分"开发时需要"和"插件运行时需要"两类
- 为新增的必要依赖设计对应的检查和安装机制
<!-- OVERVIEW_END -->

---

## 依赖管理

### 1. tsx/typescript 应作为 runtime dependencies

**问题描述**: 在 v0.1.0 初始实现中，tsx 和 typescript 被放在 devDependencies 中。当用户通过 Claude Code 插件方式安装时，插件运行时需要 tsx 来直接执行 TypeScript 源码，但 devDependencies 在生产安装（`npm install --production`）时不会被安装。

**根本原因**: Claude Code 插件的工作方式是直接执行源码（通过 tsx），而不是先编译再运行。因此 tsx 和 typescript 不是开发工具，而是运行时必需的依赖。

**解决方案**: 将 tsx (^4.22.3) 和 typescript (^6.0.3) 从 devDependencies 移至 dependencies。

**预防建议**: 对于以插件形式分发且需要运行时执行 TypeScript 的项目，ts 和 typescript 应放在 dependencies 中。判断标准：如果最终用户（而非开发者）的机器上需要执行它，就是 runtime dependency。

---

### 2. 插件首次安装需要依赖检查机制

**问题描述**: 用户安装插件后，直接使用 /record 等命令会因为缺少 Playwright 浏览器二进制文件而报错，用户体验差。

**根本原因**: Playwright 的 npm 包和浏览器二进制文件是分开安装的。`npm install playwright` 只安装 Node.js 绑定，需要额外运行 `npx playwright install chromium` 来下载浏览器。

**解决方案**:
1. 添加 `/setup` 命令 (commands/setup.md) 引导用户安装依赖
2. 添加 SessionStart hook (hooks/hooks.json + check-deps.sh) 在每次会话启动时检查依赖状态
3. 如果依赖缺失，输出友好提示"Run /setup to install"
4. 在 package.json 中添加 `postinstall` 脚本自动安装 Playwright Chromium

**预防建议**: 对于依赖大型二进制文件的 npm 包，始终提供显式的安装/检查机制，不要假设 npm install 就够了。

---

### 3. Hook 脚本需要容错处理

**问题描述**: check-deps.sh 在检查依赖时可能因为环境差异导致误报。

**解决方案**:
- 使用 `PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-.}"` 提供默认值
- 检查 node_modules 目录是否存在而非检查单个包
- 使用 `node -e "require('playwright')"` 而非检查文件路径
- 脚本失败时输出提示信息而非退出错误码，避免阻塞 Claude Code 启动

**预防建议**: Hook 脚本应遵循"只提示不阻塞"原则，失败时给出友好提示而不是报错退出。
