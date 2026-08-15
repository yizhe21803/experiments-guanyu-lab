# 观屿实验室 · 交互实验库

<div align="center">

# GUANYU LAB  
### Interactive Experiments

**在细节里，看见创造力**  
*Find Creativity in the Details*

观屿实验室用于沉淀实时交互、创意编程、动态界面与数字材质实验的统一公开仓库。

当前系列：

**MOTION SURFACE · 动态表面实验**

`MS-01 Jelly Motion` · `MS-02 Jelly Switch`

</div>

---

## 关于这个仓库

`experiments-guanyu-lab` 是 **观屿实验室 / GUANYU LAB** 的统一交互实验仓库。

这里不是传统意义上的业务产品仓库，也不是单纯的 Demo 合集。它用于持续记录、整理和发布观屿实验室在以下方向上的小型实验作品：

- 实时交互与动态界面
- Soft-body / Jelly Motion
- WebGL / WebGPU
- SDF / Ray Marching
- Spring / Verlet 等动态系统
- 交互材质与数字质感
- Creative Coding
- Motion UI
- Generative Interaction
- 实验性前端视觉

每个实验都应具备独立的作品编号、名称、版本、运行入口、技术说明、来源说明和冻结记录，并统一接入 GUANYU LAB 的作品注册表。

---

# 当前实验

## MOTION SURFACE

`MOTION SURFACE` 是观屿实验室当前建立的第一个实验系列。

它关注的不是“做一个普通控件”，而是研究：

> 当界面具有重量、弹性、惯性、材质和光感之后，数字界面还能产生什么样的触觉联想。

当前已发布两件实验。

### MS-01 · Jelly Motion

**Realtime Soft-body Slider**

一个具有果冻质感的实时交互滑块。

拖动过程中，滑块会发生拉伸、弯曲、压缩、卷曲和回弹，让普通 Slider 从二维控件变成具有动态形变的数字对象。

主要技术：

- WebGL2
- Signed Distance Field
- Verlet Dynamics
- Quadratic Bézier
- Temporal Accumulation
- Soft-body Interaction

当前状态：

```text
ID       MS-01
NAME     Jelly Motion
VERSION  1.0.0
STATUS   FROZEN
```

目录：

```text
experiments/motion-surface/ms-01-jelly-motion/
```

---

### MS-02 · Jelly Switch

**Realtime Soft-body Toggle**

一个具有压缩、滑动、碰撞、回弹和动态透光效果的果冻开关。

开关不再只是从 OFF 切换到 ON，而是通过弹簧运动、SDF 几何、折射、环境光与时间抗锯齿形成完整的动态反馈。

主要技术：

- WebGL2
- Signed Distance Field
- Spring Dynamics
- Ray Marching
- Refraction
- TAA
- Realtime Interaction

当前状态：

```text
ID       MS-02
NAME     Jelly Switch
VERSION  1.0.0
STATUS   FROZEN
```

目录：

```text
experiments/motion-surface/ms-02-jelly-switch/
```

---

# 仓库结构

当前正式仓库结构如下：

```text
experiments-guanyu-lab/
│
├── README.md
├── ARCHITECTURE.md
├── FROZEN_COMMIT.txt
│
├── registry/
│   ├── experiments.json
│   ├── series.json
│   └── repository-contract.json
│
├── experiments/
│   └── motion-surface/
│       │
│       ├── ms-01-jelly-motion/
│       │   ├── README.md
│       │   ├── CHANGELOG.md
│       │   ├── SOURCE.md
│       │   ├── FREEZE_MANIFEST.json
│       │   ├── experiment.json
│       │   ├── index.html
│       │   ├── styles.css
│       │   ├── app.js
│       │   ├── reference-track.js
│       │   ├── workbench.js
│       │   ├── server.mjs
│       │   ├── start.command
│       │   └── package.json
│       │
│       └── ms-02-jelly-switch/
│           ├── README.md
│           ├── CHANGELOG.md
│           ├── SOURCE.md
│           ├── FREEZE_MANIFEST.json
│           ├── experiment.json
│           ├── index.html
│           ├── styles.css
│           ├── app.js
│           ├── server.mjs
│           ├── start.command
│           └── package.json
│
├── packages/
│   ├── design-tokens/
│   │   └── tokens.css
│   │
│   ├── lab-shell/
│   │   └── README.md
│   │
│   └── experiment-runtime/
│       └── README.md
│
├── docs/
│   ├── legal/
│   │   ├── SOURCE_ATTRIBUTION.md
│   │   └── TypeGPU-MIT.txt
│   │
│   └── standards/
│       └── REPOSITORY_STANDARD.md
│
├── scripts/
│   ├── validate-registry.mjs
│   ├── validate-repository-contract.mjs
│   └── validate-freeze.mjs
│
└── .github/
    └── workflows/
        └── validate.yml
```

---

# GUANYU LAB 仓库识别规则

观屿实验室已经建立统一的 GitHub 项目发现规则。

所有需要被其它 App、官网、作品库或自动同步程序识别为 **GUANYU LAB 项目** 的仓库，必须使用以下命名格式：

```text
<project-slug>-guanyu-lab
```

例如：

```text
experiments-guanyu-lab
nebula-capsules-guanyu-lab
Agent-Token-guanyu-lab
```

核心判断逻辑：

```js
const isGuanyuLabRepository = (repo) =>
  repo.name.toLowerCase().endsWith('-guanyu-lab');
```

`-guanyu-lab` 是机器可读的 **Hard Gate**，不是普通品牌后缀。

也就是说：

```text
存在 -guanyu-lab 后缀
        ↓
允许进入 GUANYU LAB 自动发现流程
        ↓
读取仓库 Registry / Metadata
        ↓
进入官网 / App / 作品库
```

没有该后缀的仓库，默认不得被自动识别为观屿实验室公开项目。

完整规则保存在：

```text
registry/repository-contract.json
```

---

# 作品注册表

仓库中的：

```text
registry/experiments.json
```

是当前实验作品的统一机器可读注册表。

每个实验至少包含：

```json
{
  "id": "MS-02",
  "slug": "jelly-switch",
  "series": "motion-surface",
  "sequence": 2,
  "name": "Jelly Switch",
  "nameZh": "果冻开关",
  "version": "1.0.0",
  "status": "released",
  "brand": "GUANYU LAB",
  "entry": "/experiments/motion-surface/ms-02-jelly-switch/"
}
```

未来以下产品都应优先读取同一份 Registry，而不是在各自项目中重复维护作品列表：

```text
GUANYU LAB 官网
观屿实验室作品页
微信小程序 About / 作品库
其它 GUANYU LAB App
GitHub Portfolio
未来统一品牌 API
```

最终目标是：

```text
Experiment
    ↓
experiment.json
    ↓
Registry
    ↓
GUANYU LAB Ecosystem
```

实现一次登记，多端同步。

---

# 实验项目规范

每个实验都是一个相对独立的作品单元。

推荐最小结构：

```text
ms-xx-project-name/
├── README.md
├── CHANGELOG.md
├── SOURCE.md
├── FREEZE_MANIFEST.json
├── experiment.json
├── index.html
├── styles.css
├── app.js
├── server.mjs
├── start.command
└── package.json
```

其中：

### `experiment.json`

实验的机器可读身份证。

用于记录：

- Experiment ID
- Series
- Sequence
- Name
- Version
- Status
- Technology
- Source
- Entry

### `SOURCE.md`

记录实验来源和二次实现关系。

凡使用、参考、移植或改造第三方代码、算法、Shader、设计或实验，都必须明确记录来源。

### `CHANGELOG.md`

只记录正式版本变化。

开发阶段大量 R1 / R2 / R3 等过程版本不再作为文件长期堆积在正式目录中，而交给 Git Commit 和 Tag 管理。

### `FREEZE_MANIFEST.json`

正式发布后的冻结清单。

记录当前 Release 中关键文件的 SHA-256。

例如：

```text
app.js      → SHA-256
index.html  → SHA-256
styles.css  → SHA-256
...
```

用于检查正式发布文件是否被意外修改。

---

# 文件冻结机制

当前：

```text
MS-01 · Jelly Motion  → 1.0.0 · FROZEN
MS-02 · Jelly Switch  → 1.0.0 · FROZEN
```

冻结意味着：

> 已发布版本不再直接承载下一轮开发。

需要修改时，应建立新版本，而不是直接把旧发布状态覆盖掉。

例如：

```text
MS-02 1.0.0  FROZEN
        ↓
开发修改
        ↓
MS-02 1.1.0
        ↓
验证
        ↓
FROZEN
```

CI 会运行：

```bash
node scripts/validate-freeze.mjs
```

对冻结文件进行哈希验证。

---

# Lab Shell

`packages/lab-shell` 定义 GUANYU LAB 交互实验的统一视觉外壳。

它负责建立系列作品之间的品牌连续性，包括：

```text
GUANYU LAB Brand
Interactive / Motion / Creative
EXPERIMENT
Series Number
Hero
Experiment Board
LIVE
Capability Cards
Spec Panel
Made by GUANYU LAB
Brand Slogan
Footer
```

核心原则：

> **One Lab, One Shell.**

不同实验可以拥有完全不同的 Renderer、Physics 和交互逻辑，但不应该每做一个新实验就重新设计一套实验室页面。

因此：

```text
MS-01
MS-02
MS-03
MS-04
...
```

应当首先被识别为同一个 GUANYU LAB 系列，然后才是不同实验。

---

# Design Tokens

统一品牌基础视觉变量位于：

```text
packages/design-tokens/tokens.css
```

主要负责：

- 奶油色
- 灰绿色
- 白色
- Ink / Muted 文本
- Border
- Radius
- Shadow
- Lab Shell 基础尺寸

实验自己的功能颜色，例如 Jelly Orange、Jelly Blue 等，不应写进品牌 Token。

品牌 Token 和实验 Material Color 必须保持分离。

---

# Experiment Runtime

`packages/experiment-runtime` 用于承载真正跨实验复用的交互基础能力，例如：

```text
Auto Demo
Manual Takeover
Palette Controller
Resize
Lifecycle
Version Metadata
```

它不能控制具体实验的视觉结果。

正确关系：

```text
GUANYU LAB Runtime
        ↓
发送交互输入
        ↓
Experiment Core
        ↓
Renderer / Physics
```

禁止：

```text
Auto Demo
   ↓
直接修改 Shader 明暗
直接篡改 Physics 参数
直接制造视觉结果
```

实验核心必须保持独立和可解释。

---

# Renderer 与 Physics 原则

目前不会为了“代码复用”而强行建立一个统一 Jelly Engine。

原因是不同实验拥有不同核心结构。

例如：

### Jelly Motion

```text
Verlet
Bezier
Slider topology
Curve deformation
SDF
```

### Jelly Switch

```text
Spring
Rounded-box SDF
Ray Marching
Refraction
TAA
```

因此现阶段原则是：

> **共享品牌与运行基础设施，不强行共享实验核心。**

只有当某项底层能力在至少多个实验中稳定重复之后，才考虑提取成共享 Package。

---

# 本地运行

两个当前实验均可独立运行。

## MS-01

```bash
cd experiments/motion-surface/ms-01-jelly-motion
npm run start
```

或者：

```bash
node server.mjs
```

macOS 也可执行：

```bash
./start.command
```

---

## MS-02

```bash
cd experiments/motion-surface/ms-02-jelly-switch
npm run start
```

或者：

```bash
node server.mjs
```

macOS：

```bash
./start.command
```

项目当前不依赖复杂构建流程，启动本地静态服务后即可运行。

---

# 仓库校验

仓库提供三类正式校验。

### Registry

```bash
node scripts/validate-registry.mjs
```

检查：

- Experiment ID
- Slug
- Series
- Version
- Entry
- 重复作品

### Repository Contract

```bash
node scripts/validate-repository-contract.mjs
```

检查 GUANYU LAB 仓库命名约束。

核心要求：

```text
repository name must end with -guanyu-lab
```

### Freeze

```bash
node scripts/validate-freeze.mjs
```

检查已冻结 Release 的文件 SHA-256。

GitHub Actions 会在 Push / Pull Request 时自动执行以上检查。

Workflow：

```text
.github/workflows/validate.yml
```

---

# Git 版本规范

## Branch

建议保持：

```text
main
dev

feature/ms-01-*
feature/ms-02-*
feature/ms-03-*

feature/lab-shell-*
feature/registry-*
```

其中：

```text
main
```

必须始终保持可展示、可验证的正式状态。

---

## Commit

建议使用：

```text
feat(ms-01): ...
fix(ms-02): ...
style(shell): ...
refactor(runtime): ...
chore(registry): ...
docs(source): ...
```

例如：

```text
feat(ms-03): add magnetic liquid button experiment
fix(ms-02): stabilize endpoint rebound
style(shell): refine experiment board spacing
chore(registry): register MS-03
```

---

## Tag

实验版本独立编号：

```text
ms01-v1.0.0
ms01-v1.1.0

ms02-v1.0.0
ms02-v1.1.0

ms03-v1.0.0
```

避免使用无法判断实验归属的：

```text
v1.0
v1.1
v2.0
```

---

# 实验生命周期

推荐统一采用：

```text
CONCEPT
   ↓
PROTOTYPE
   ↓
REVIEW
   ↓
RELEASED
   ↓
FROZEN
   ↓
ARCHIVED
```

公开作品库原则上只展示：

```text
RELEASED
FROZEN
```

未完成实验可进入未来独立的 Private Incubator，不直接进入公开作品仓库。

---

# 系列编号

当前系列：

```text
MOTION SURFACE
MS-01
MS-02
MS-03
...
```

未来可扩展新的实验系列，例如：

```text
MATERIAL STUDY
MT-01
MT-02

GENERATIVE FORM
GF-01
GF-02

SPATIAL INTERACTION
SI-01
SI-02

AI EXPERIMENT
AI-01
AI-02
```

Series ID、Experiment ID、Git 目录、宣传物料和官网展示应保持一致。

---

# 第三方来源与许可证

当前 Jelly Motion 与 Jelly Switch 均与 Software Mansion 的 TypeGPU 示例存在来源 / 改造关系。

相关上游：

```text
Software Mansion / TypeGPU
```

涉及示例：

```text
rendering/jelly-slider
rendering/jelly-switch
```

上游许可证：

```text
MIT License
```

详细来源说明位于：

```text
docs/legal/SOURCE_ATTRIBUTION.md
docs/legal/TypeGPU-MIT.txt
```

同时，每个实验目录拥有自己的：

```text
SOURCE.md
```

GUANYU LAB 对第三方来源采用明确原则：

> 可以学习、改造和重新实现，但必须保留真实来源关系，不把来源改造项目描述为完全原创的底层算法。

第三方代码及其实质性衍生部分继续遵循相应上游许可证。

本仓库不同内容可能具有不同来源关系，因此在没有单独声明前，不应把整个仓库简单视为由单一许可证覆盖。

---

# 不属于本仓库的内容

这个仓库只负责 **GUANYU LAB 交互实验作品**。

以下内容原则上继续使用自己的独立仓库：

```text
正式业务 App
微信小程序
中后台
服务器
数据库
独立 SaaS
大型独立产品
具有独立发布周期的项目
```

如果独立项目需要进入 GUANYU LAB 生态，应建立：

```text
<project-slug>-guanyu-lab
```

形式的独立仓库，而不是全部塞进 `experiments-guanyu-lab`。

---

# 新实验接入规则

从 MS-03 开始，一个新的实验正式进入 GUANYU LAB，至少需要完成：

```text
01  获得唯一 Experiment ID
02  建立规范目录
03  创建 experiment.json
04  创建 README.md
05  创建 SOURCE.md
06  接入统一 Lab Shell
07  注册到 experiments.json
08  完成本地运行验证
09  完成 Freeze Manifest
10  CI PASS
11  建立正式版本 Tag
```

核心规则：

> **New Experiment = New Registry Entry + Shared Lab Shell + Independent Experiment Core**

---

# 当前状态

```text
REPOSITORY
experiments-guanyu-lab

BRAND
观屿实验室 / GUANYU LAB

SERIES
MOTION SURFACE

RELEASED
MS-01 Jelly Motion
MS-02 Jelly Switch

MS-01
1.0.0 · FROZEN

MS-02
1.0.0 · FROZEN

DISCOVERY CONTRACT
*-guanyu-lab

CI
Registry Validation
Repository Contract Validation
Freeze Validation
```

---

<div align="center">

## GUANYU LAB

**Interactive · Motion · Creative**

在细节里，看见创造力  
*Find Creativity in the Details*

</div>
