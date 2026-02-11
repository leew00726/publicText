# 内网可部署 Web 公文排版系统（MVP）

本项目实现了请示/纪要/函三类公文的内网排版 MVP，支持：
- DOCX 导入净化（剥离原红头）
- 在线编辑（结构化要素 + 富文本正文）
- 红头模板（单位级、多版本、可发布）
- 规范校验 AB（样式基础 + 标题层级/句末标点）
- 导出 DOCX（可继续编辑）
- DeepSeek Agent 润色（选中文本一键改写）
- 字体强制检测（缺字体阻断导出）

## 1. 技术栈
- 前端：React + TypeScript + Vite + Tiptap
- 后端：FastAPI + SQLAlchemy
- 存储：PostgreSQL（元数据）+ MinIO（导入源文件/导出文件）
- DOCX：`python-docx` 服务端解析/生成
- 部署：Docker Compose（frontend + backend + postgres + minio）

## 2. 目录结构

```text
.
├─ backend
│  ├─ app
│  │  ├─ routers
│  │  ├─ services
│  │  ├─ models.py
│  │  └─ main.py
│  └─ assets/fonts/font-pack.zip
├─ frontend
│  ├─ src/pages
│  ├─ src/components
│  └─ src/utils
└─ docker-compose.yml
```

## 3. 快速启动（内网）

### 3.1 Docker Compose（推荐）
要求：安装 Docker Desktop（或等价容器运行时）。

```bash
docker compose up -d --build
```

### 3.1.1 一键发布脚本（Windows PowerShell）

项目根目录已提供 `deploy.ps1`：

```powershell
cd "D:\桌面\publicText"
.\deploy.ps1 -Target frontend
```

常用参数：
- `-Target frontend`：只重建发布前端（默认）
- `-Target backend`：只重建发布后端
- `-Target all`：重建发布前后端
- `-NoCache`：无缓存重建
- `-ShowLogs`：发布后输出最近日志

示例：

```powershell
.\deploy.ps1 -Target all -NoCache -ShowLogs
```

若从 `cmd` 调用 PowerShell，建议加 `-NoProfile`（避免本机 profile 干扰）：

```cmd
powershell -NoProfile -ExecutionPolicy Bypass -File .\deploy.ps1 -Target frontend
```

访问：
- 前端：`http://localhost:5174`
- 后端：`http://localhost:8000`
- MinIO Console：`http://localhost:9001`（账号 `minioadmin/minioadmin`）

### 3.2 本地开发启动（无 Docker）

后端：
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

接入 DeepSeek（OpenAI 兼容接口）需配置 `backend/.env`：
```env
DEEPSEEK_API_KEY=你的密钥
DEEPSEEK_BASE_URL=https://api.deepseek.com/v1
DEEPSEEK_MODEL=deepseek-chat
DEEPSEEK_TIMEOUT_SEC=45
DEEPSEEK_TEMPERATURE=0.2
```

前端：
```bash
cd frontend
npm install
npm run dev
```

## 4. 字体强制要求与安装

系统硬性要求字体（缺任一即阻断导出）：
- 方正小标宋简
- 仿宋_GB2312
- 楷体_GB2312
- 黑体

### 4.1 检测机制
- 进入编辑页自动检测并显示状态条
- 点击“导出 DOCX”前强制复检
- 检测优先使用 `document.fonts.check`，并使用 Canvas 宽度对比法兜底
- 结果可缓存到 `localStorage`，导出前始终复检

### 4.2 安装入口
- 下载：`/assets/fonts/font-pack.zip`

> 注意：仓库内 `font-pack.zip` 仅含安装说明与占位文件，请在内网替换为已授权字体文件后分发。

### 4.3 安装步骤
- Windows：右键字体文件 -> 安装 / 为所有用户安装
- macOS：用 Font Book 安装

## 5. 红头模板（单位级可配置）

- 数据结构：JSON（page + elements）
- 作用域：仅首页（Different First Page）
- 元素类型：`text` / `line`
- 绑定字段：`unitName/docNo/signatory/copyNo/fixedText`
- 管理能力：列表、编辑、复制、发布、设默认、停用
- 预览能力：A4 画布 + 边距线 + 顶部安全区 + 元素高亮

### 发布前校验
阻断：
1. 溢出顶部安全区
2. `yCm < 0` 或 `yCm >= 3.7`
3. 缺少 `unitName` 文本元素

警告：
- `docNo` 与 `signatory` y 差值 > 0.05cm
- `unitName` 非 center anchor

## 6. 文档编辑能力

- 文档类型：请示/纪要/函
- 双模式：
  - 左侧结构化字段：title/mainTo/docNo/signatory/copyNo/date/attachments
  - 中间富文本：H1~H4、列表、表格
- 自动编号：`一、（一）1.（1）` 重排
- 智能粘贴：保留少量语义标签（标题/加粗/列表/表格），剥离脏样式
- 校验 AB：右侧面板显示问题并可定位
- 一键套版：正文缩进、标题标点规则、编号重排、文号括号归一 `〔〕`

## 7. DOCX 导入与导出

### 7.1 导入净化
- 服务端解析 DOCX 段落/标题/编号/表格
- 默认忽略原页眉复杂对象（剥离原红头）
- 标题识别：优先编号形态，其次字体特征辅助
- 生成导入报告：未识别标题、编号异常、表格异常
- 导入后轻量套版

### 7.2 导出 DOCX
- 页面：A4 + 边距 3.7/3.5/2.7/2.5 cm
- 正文：仿宋_GB2312 3号、固定行距 28pt、首行缩进两字
- 页码：页脚居中
- 红头：仅首页页眉（Different First Page）
- 红头实现：段落 + 制表位 + 段落边框（红线），不使用浮动文本框

## 8. API 一览

- Units
  - `GET /api/units`
- Redhead Templates
  - `GET /api/redheadTemplates?unitId=`
  - `GET /api/redheadTemplates/:id`
  - `POST /api/redheadTemplates`
  - `PUT /api/redheadTemplates/:id`
  - `POST /api/redheadTemplates/:id/clone`
  - `POST /api/redheadTemplates/:id/publish`
  - `POST /api/redheadTemplates/:id/disable`
  - `POST /api/redheadTemplates/:id/setDefault`
- Documents
  - `GET /api/docs`
  - `POST /api/docs`
  - `GET /api/docs/:id`
  - `PUT /api/docs/:id`
  - `POST /api/docs/:id/check`
  - `POST /api/docs/importDocx`
  - `POST /api/docs/:id/exportDocx`
- AI
  - `POST /api/ai/rewrite`

## 9. 内置示例数据
- 2 个单位
- 每单位 2 个红头模板（模板A/模板B）
- 3 个示例文档（请示/纪要/函）

## 10. 自测记录

已执行：
- `python -m compileall backend/app` 通过
- `npm run build`（frontend）通过
- 后端核心链路脚本验证：
  - 种子数据初始化成功（3 文档）
  - 文档校验执行成功
  - DOCX 导出成功（生成二进制）
  - DOCX 导入成功（返回导入报告）

未执行：
- `docker compose up`（当前环境无 `docker` 命令）

## 11. 许可证与字体合规
本项目代码不内置受版权约束的商用中文字库文件。请在单位已获授权前提下，将合法字体文件放入 `font-pack.zip` 后在内网发布。
