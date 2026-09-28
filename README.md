# 盈盈错题库（yycuotiku · Electron 桌面版）

把错题照片快速整理为一张可打印的 A4 图片。新版本基于 Electron 43、Vue 3、TypeScript 和 Sharp。

## 功能

- 多图导入、图片拖拽、滚轮缩放和适合窗口
- 左右 90° 旋转及 -45°～+45° 微调旋转
- 连续框选错题，支持移动选框和八方向调整大小
- 纸张预览与框选实时同步
- 记录年级与科目（语文/数学/英语），错题可一键加入错题集回顾
- 错题集以本地目录存储（图片 + SQLite 数据库 cuotiku.db，默认 home 目录隐藏文件夹 `.cuotiku`，可在设置中修改），左右分栏：左侧筛选/多选错题，右侧组卷打印区自动同步排版（默认 A4、自动换页）并直接打印
- 多道错题合成后调用一次腾讯云试卷手写擦除接口
- 自动、单列或双列排版，错题尽量保持原尺寸、靠左排列并自动换页，300 DPI 保存和系统打印
- 排版、图像增强、腾讯云凭据和外观设置

## 开发

需要 Node.js 22、Corepack 和 pnpm 11。

```bash
pnpm install
pnpm dev
```

质量检查与打包：

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm package
```

## 发布与自动升级

- 修改 `package.json` 版本号并提交；打标签推送触发 GitHub Actions：`git tag v1.0.0 && git push origin v1.0.0`。
- `.github/workflows/release.yml` 在 windows-latest 上构建 NSIS 安装包，并通过 electron-builder 发布 GitHub Release（含自动升级元数据 `latest.yml`）；标签带 `-beta` 等后缀时走 beta 通道。
- 应用内置 electron-updater（Windows/macOS）：启动后与「设置 → 高级」中可检查更新；下载完成后由用户选择重启安装。

## 架构

- `src/renderer`：Vue 工作台、Canvas 交互、Pinia 状态和设置页
- `src/preload`：窄接口 `window.desktopAPI`
- `src/shared`：IPC 通道、Zod 校验和共享类型
- `src/main`：本地文件、Sharp 高清处理、腾讯云接口、保存与打印

渲染进程不直接访问 Node.js、Electron、文件路径或应用密钥。图片原路径和腾讯云请求均保留在主进程。

腾讯云接口文档：[试卷手写擦除 API](https://cloud.tencent.com/document/product/866/133907)。
# cuotiku
