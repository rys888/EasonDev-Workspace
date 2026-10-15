# Eason's Room

> 「房间就是网站」——一个可交互的个人作品集：**2D 手绘场景 + 伪 3D 景深视差 + 环境动效 + 物品交互**，用房间里的物件代替传统的页面跳转。

Eason's Room 是 Eason（Java 后端 / 软件工程）的个人数字房间：Java、江南水乡、音乐与日常。
访客不再在导航栏之间切换，而是通过**点击场景里的物品**进入不同区块——关于我、项目、博客、研究、知识图谱。

本项目为**个人作品集**，不是通用模板；文章与图片多为个人创作，其使用条件见「素材与许可」。

## 截图

| 桌面端 | 移动端 |
| --- | --- |
| ![Eason's Room — desktop](./public/assets/eason-room-hero-desktop-v2.webp) | ![Eason's Room — mobile](./public/assets/eason-room-hero-mobile-v2.webp) |

## 技术栈

- **React 19** + **TypeScript** + **Vite 8**
- **@paper-design/shaders-react** —— 场景着色器
- **GSAP** —— 场景过渡与动效
- **react-markdown** + remark / rehype（KaTeX 公式、代码高亮）—— 博客渲染
- 自研景深层：`src/hooks/useDepthRenderer.ts`、`src/scene/*`

> 说明：本项目**没有使用** Three.js / React-Three-Fiber。所谓「伪 3D」是用多层贴图 + 着色器位移 + 鼠标视差模拟景深，而非真实三维场景。

## 环境要求

- **Node.js** `^20.19.0 || >=22.12.0`（由 Vite 8 要求；本项目在 Node 22 上开发）

## 快速开始

```bash
npm install
npm run dev        # 启动本地开发服务器（Vite）
```

打开终端里输出的地址（默认 http://localhost:5173）。

构建与预览：

```bash
npm run build            # 先同步博客内容（会访问远程仓库，见下）→ tsc -b → vite build
npm run build:offline    # 用仓库内已生成的内容构建，不联网
npm run preview          # 预览构建产物
npm run lint             # ESLint
```

## 目录结构

```
.
├── index.html
├── public/
│   ├── assets/            # 运行时素材（图片、音频目录）
│   ├── blog-content/      # 博客内容与配图（由 scripts/sync-blog-notes.mjs 生成）
│   └── favicon.ico
├── scripts/
│   ├── sync-blog-notes.mjs          # 从笔记仓库同步博客内容
│   └── generate-source-snapshots.mjs
├── src/
│   ├── components/        # 场景与各区块组件（Room / About / Blog / Projects / Research / Knowledge）
│   ├── data/              # 数据源（博客、项目、源码快照）
│   ├── hooks/             # useDepthRenderer / usePointerParallax / useSceneTransition
│   ├── scene/             # 着色器与景深层
│   ├── App.tsx
│   ├── main.tsx
│   └── styles.css
├── vite.config.ts
├── tsconfig*.json
└── eslint.config.js
```

## 博客内容同步

`npm run build` 会执行 `notes:sync`，默认**访问远程仓库** `https://github.com/rys888/Java-Backend-Learning` 拉取笔记，并重新生成 `public/blog-content/` 与 `src/data/blogContent.generated.json`。

作为**贡献者**或只想本地跑起来，请优先使用离线模式，避免拉取/覆盖内容：

```bash
npm run build:offline      # 构建时用仓库内已提交的内容
npm run notes:generate     # 只重新生成内容（不构建）
```

如你确实要同步，也可用环境变量覆盖来源仓库与分支：

```bash
BLOG_NOTES_REPOSITORY=<你的仓库地址> BLOG_NOTES_REF=main npm run notes:sync
```

## 浏览器自动播放说明

场景中的背景音乐使用 `<audio>` 元素播放。受**浏览器自动播放策略**限制，音频通常需要**用户先有一次交互**（点击 / 触摸页面）后才能播放。

> 出于**版权原因**，本项目**未随仓库分发原始背景音乐文件**。详见 [`public/assets/audio/README.md`](./public/assets/audio/README.md)。该文件缺失时播放器会静默降级，不影响其余功能。

## 素材与许可

- **源代码**：**MIT**，见 [`LICENSE`](./LICENSE)。
- **图片 / 文章 / 其他内容**：**不在 MIT 覆盖范围内**，逐类权利与再分发条件见 [`ASSETS_LICENSE.md`](./ASSETS_LICENSE.md)。
- **第三方依赖**及其许可证见 [`NOTICE`](./NOTICE)（注意：**GSAP 不是 MIT**）。

## 贡献

这是个人作品集项目，欢迎通过 Issue 反馈问题或建议。
若提交 PR，请保持改动聚焦、在描述里说明动机，并确保 `npm run lint` 与 `npm run build:offline` 通过。

## 许可证

源代码以 [MIT](./LICENSE) 授权。内容与素材的权利边界见 [ASSETS_LICENSE.md](./ASSETS_LICENSE.md)。
