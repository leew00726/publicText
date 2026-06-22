# 公文智能排版系统（青年创意大赛参赛版）

面向政企常见公文场景（纪要、通知、请示、函），本项目提供一套“训练即模板、编辑即排版、导出即成文”的 Web 化系统。

核心目标：
- 降低公文排版门槛，让非专业用户也能稳定产出规范文稿。
- 将“格式经验”沉淀为可复用模板，而不是依赖个人反复手工调整。
- 在智能辅助场景下保证可控性和可追溯性（先预览再替换、训练审计可查）。

## 1. 项目亮点（参赛价值）

- 模板可学习：上传历史 DOCX/PDF，系统自动推断正文、标题层级、边距、尾部固定块等规则，形成题材模板。
- 红头可复用：支持红头模板数据化表达（元素、坐标、字体、红线），导出时生成可编辑 DOCX。
- 智能辅助可控：接入 DeepSeek 进行改写/修订，但正文润色采用“预览栏 + 用户确认替换”，避免误改原文。
- 预览与导出一致：前端 A4 画布按模板规则渲染，后端导出按同一规则落地到 `python-docx`。
- 合规保障机制：强制字体检测、格式校验、一键排版、训练删除审计，兼顾效率与规范。
- 知识沉淀闭环：公司 -> 题材库 -> 文档库 -> 正文编辑，全流程可追踪、可迭代。
- 组织与文档统一治理：按公司同步部门和人员目录，并在公司公文库集中检索、上传和继续编辑公文。

## 2. 典型使用流程

1. 使用员工号登录，并从工作台进入“公文管理”。
2. 在公司选择页创建/选择公司，查看该公司的部门、人员统计和公文列表。
3. 在公司公文库上传 DOCX，系统解析正文并将文件归入当前公司；也可以直接打开已有公文继续编辑。
4. 进入题材库，新建题材（例如“周例会纪要”）。
5. 进入模板训练页，上传历史材料并分析。
6. 在训练草稿上通过指令（可选 DeepSeek）修订规则并确认模板。
7. 进入正文编辑入口，按模板新建文档并完成结构化填充、规范校验和一键排版。
8. 导出 DOCX 用于流转盖章，保留二次编辑能力。

## 3. 功能全景

### 3.1 公司、组织与题材管理
- 公司管理：创建、删除公司（删除时级联清理题材/文档/模板/对象存储）。
- 组织架构：按公司展示部门目录、部门排序、人员数量和登录账号关联状态。
- 人员目录：从 `backend/assets/employee_directory.json` 同步员工所属公司、部门与子部门信息。
- 题材管理：创建、删除题材。
- 页面流转：`公司选择 -> 部门与公司公文库 -> 题材库 -> 题材文档库 -> 正文编辑`。
- 全局返回按钮：按固定业务层级回退，避免跳转混乱。

### 3.2 模板训练与版本化
- 训练输入：支持 DOCX/PDF。
- 自动推断：
  - 正文样式（字体、字号、行距、首行缩进）
  - 标题层级样式（H1~H4）
  - 页边距
  - 固定前置/后置内容（含红线分隔符）
- 置信度报告：展示每类规则的置信度与样本数。
- 草稿版本：每次分析/修订生成新草稿版本。
- 模板确认：草稿确认后形成正式模板版本，并可切换生效版本。
- 模板删除：支持删除指定版本，自动处理“当前生效模板”的回退。

### 3.3 智能体修订（模板层）
- 本地规则补丁：对模板规则做确定性 patch。
- DeepSeek 对话修订：支持连续上下文对话修订模板草稿。
- 零留存策略：训练文件不落盘，仅保留删除审计元数据。

### 3.4 正文编辑（文档层）
- 三栏工作区：
  - 左侧：结构化要素（标题、主送、落款、日期、附件）。
  - 中间：A4 正文编辑与实时预览（含红头叠加、尾部要素）。
  - 右侧：规范校验与一键排版。
- 智能润色：针对选中文本调用 DeepSeek，先显示预览，再由用户点击“替换正文”。
- 导入 DOCX：抽取正文结构并输出导入报告。
- 导出 DOCX：保持红头、页码、边距、标题层级、尾部格式一致。

### 3.5 公司公文库与题材文档库
- 公司公文库：集中展示当前公司的全部公文，支持按标题、文号、题材、文种和状态搜索。
- 文件上传：支持单个 DOCX 文件（最大 20MB），保留原文格式并根据文件名识别常见文种；上传完成后自动刷新列表。
- 上传反馈：提供文件类型/大小校验、上传中状态、成功提示和后端错误提示。
- 题材文档库：每个题材保留独立文档列表，支持打开编辑与删除文档。
- 时间展示：公文更新时间统一按本地时区格式化。

### 3.6 规范与合规能力
- 规范校验：节点类型、标题层级、编号连续性、标题句末标点、正文缩进等。
- 一键排版：自动规范标题编号/标点、正文段落属性、附件格式等。
- 字体强检：缺少关键字体时阻断导出，避免“预览正常、导出错字”。

## 4. 技术架构与实现路径

### 4.1 总体架构

```text
React + TypeScript + Tiptap (frontend)
            |
            v
      FastAPI (backend)
      |        |        |
      |        |        +-- DeepSeek(OpenAI兼容接口)
      |        |
      |        +-- MinIO / 本地文件存储（导入源、导出产物）
      |
      +-- PostgreSQL（公司/题材/模板/文档/审计元数据）
```

### 4.2 前端实现
- 路由：React Router，关键页面包括公司选择、部门与公司公文库、题材库、题材文档库、训练页、正文编辑页。
- 编辑器：Tiptap + 自定义扩展（段落/标题样式属性、后置名单标签装饰）。
- 预览渲染：
  - 使用 CSS 变量承载模板规则（正文、H1~H4、后置标签）。
  - A4 画布 + 红头叠加层 + 前置/后置固定内容层。
- 用户交互：
  - 智能润色预览面板（可编辑、可取消）。
  - 全局返回按钮按业务层级回退。

### 4.3 后端实现
- 框架：FastAPI + SQLAlchemy + Pydantic。
- 数据模型：`Unit`、`Department`、`Personnel`、`Topic`、`TopicTemplateDraft`、`TopicTemplate`、`Document`、`DeletionAuditEvent` 等。
- 关键服务：
  - `topic_inference.py`：训练材料样式抽取、模板规则推断、置信度计算。
  - `ai_agent.py`：DeepSeek 调用封装（文本改写、模板修订）。
  - `docx_import.py`：DOCX 解析与净化导入。
  - `docx_export.py`：模板规则到 Word 排版的确定性映射。
  - `checker.py`：格式规范校验。
  - `storage.py`：MinIO / 本地双模式存储。

### 4.4 一致性保障机制（重点）
- 同一套模板规则同时驱动前端预览与后端导出。
- 后置名单（主持/参加/记录/发送等）通过规则归一为正文样式，避免局部黑体残留。
- 红色分割线作为显式节点属性（`dividerRed`）在预览和导出两端同步处理。

## 5. 关键创新点（大赛陈述建议）

- 从“文档编辑器”升级为“格式知识引擎”：把经验型格式固化为数据化规则。
- 训练零留存 + 删除审计：兼顾敏感文档场景下的隐私和可监管。
- 智能体不越权：所有 AI 改动均可见、可回退、可人工确认。
- 技术落地导向：不依赖重模型训练，使用规则推断 + 可解释置信度，部署成本低、迭代快。

## 6. 项目结构

```text
.
├─ backend
│  ├─ app
│  │  ├─ routers          # API 路由（公司/题材/训练/文档/AI）
│  │  ├─ services         # 推断、导入导出、校验、存储、AI
│  │  ├─ models.py        # 数据模型
│  │  ├─ schemas.py       # 请求/响应模型
│  │  └─ main.py          # 应用入口
│  └─ assets/fonts        # 字体安装包入口
├─ frontend
│  ├─ src/pages           # 业务页面（含 DepartmentManagementPage 公司公文库）
│  ├─ src/components      # 编辑器、校验、回退按钮等
│  ├─ src/utils           # 一键排版、字体检测、时间格式化
│  └─ src/api             # API 客户端与类型
├─ docker-compose.yml
└─ deploy.ps1
```

## 7. 快速启动

### 7.1 Docker Compose（推荐）

前置条件：已安装并启动 Docker Desktop。

在项目根目录（有 `docker-compose.yml` 的目录）执行：

```bash
docker compose up -d --build
```

访问地址：
- 前端：`http://localhost:5174`
- 后端：`http://localhost:8000`
- 健康检查：`http://localhost:8000/api/health`
- MinIO 控制台：`http://localhost:9001`

仅重建前后端：

```bash
docker compose up -d --build backend frontend
```

### 7.2 DeepSeek 配置

在项目根目录创建 `.env`（供 `docker compose` 读取）：

```env
DEEPSEEK_API_KEY=你的密钥
DEEPSEEK_BASE_URL=http://10.211.49.42:8124/v1/models
DEEPSEEK_MODEL=deepseek-chat
DEEPSEEK_TIMEOUT_SEC=45
DEEPSEEK_TEMPERATURE=0.2
TEMPLATE_INFERENCE_ENGINE=hybrid
TEMPLATE_INFERENCE_AI_MAX_PARAGRAPHS=80
```

说明：
- 若不配置 `DEEPSEEK_API_KEY`，智能润色/智能修订会失败，其他功能可正常运行。
- `TEMPLATE_INFERENCE_ENGINE` 控制文件训练模板的识别方式：`rules` 为现有规则版，`hybrid` 为 DeepSeek 辅助判断段落角色并失败回退，`deepseek` 为强制使用 DeepSeek。
- 若 DeepSeek 辅助识别效果不理想，将 `TEMPLATE_INFERENCE_ENGINE` 改回 `rules` 并重启后端即可回滚。
- 更新 `.env` 后请重建 `backend` 容器使配置生效。

### 7.3 Windows 一键发布脚本

```powershell
.\deploy.ps1 -Target all -NoCache -ShowLogs
```

常用参数：
- `-Target frontend|backend|all`
- `-NoCache`
- `-ShowLogs`

### 7.4 内网服务器部署（本地存储版）

如果要部署到公司内网服务器，并且希望：
- 保持当前前端界面不变
- 员工默认密码仍为 `000000`
- PostgreSQL 和导入/导出文件都直接落在服务器本地磁盘

请使用：

```powershell
Copy-Item .env.server.example .env.server
.\deploy-server.ps1
```

详细步骤见：[docs/server-deployment.md](docs/server-deployment.md)

## 8. 本地开发（无 Docker）

### 8.1 后端

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

后端读取环境变量时会加载当前工作目录的 `.env`。

### 8.2 前端

```bash
cd frontend
npm install
npm run dev
```

如需指定后端地址，可在前端环境变量中设置 `VITE_API_BASE`。

### 8.3 Gitea 推送注意事项

当前 Gitea 远端：

```bash
origin https://gitea-ycjfdev.ycfin.net/liziyuan/Yunju-Document-Management.git
```

正常推送命令：

```bash
git push origin main:main
```

注意：
- 仓库 owner 是 `liziyuan`，但 HTTPS 推送用户名使用 `lzy`。
- Gitea Access Token 用作 HTTPS Git 的密码，令牌权限需要包含 `write:repository`。
- 不要把真实 token 写入 README、`.env`、git remote URL 或其他可提交文件。
- 如果截图显示 token “今天使用过”，仍然不能直接说明当前 Git 凭据链路正确。

如果普通推送出现：

```text
remote: Repository cannot be accessed. You cannot push or open issues/pull-requests.
fatal: unable to access 'https://gitea-ycjfdev.ycfin.net/liziyuan/Yunju-Document-Management.git/': The requested URL returned error: 403
```

优先检查 Git Credential Manager 是否缓存了旧账号或旧 token：

```powershell
cmdkey /list | findstr /i "gitea ycfin"
cmdkey /delete:git:https://gitea-ycjfdev.ycfin.net
```

如果清理后仍然 403，不要立刻判定 token 无效。可以绕过 Git Credential Manager，用一次性 HTTP Basic header 推送；这不会修改 `origin`，也不会把 token 写入仓库文件：

```powershell
$secureToken = Read-Host "Gitea Access Token" -AsSecureString
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureToken)

try {
  $token = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
  $basic = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("lzy:$token"))
  $header = "Authorization: Basic $basic"

  git -c credential.helper= `
      -c "http.https://gitea-ycjfdev.ycfin.net/.extraHeader=$header" `
      push origin main:main
}
finally {
  if ($bstr -ne [IntPtr]::Zero) {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
  }
  Remove-Variable secureToken, token, basic, header -ErrorAction SilentlyContinue
}
```

本次实际经验：
- `git push origin main:main` 通过 GCM 返回 403。
- Gitea API 用 token 验证也返回 403，不能据此直接判断 token 一定不可用。
- 绕过 GCM 后，使用 `lzy + Access Token` 的一次性 Basic header 推送成功。
- 成功后用 `git rev-parse HEAD`、`git rev-parse origin/main`、`git rev-parse github/main` 确认三者提交一致。

## 9. 核心 API（摘要）

### 公司与题材
- `GET /api/companies`
- `POST /api/units`
- `DELETE /api/units/{unit_id}`
- `GET /api/units/{unit_id}/departments`
- `GET /api/management/units/{unit_id}/departments`（管理端别名）
- `GET /api/topics?companyId=...`
- `POST /api/topics`
- `DELETE /api/topics/{topic_id}`

### 模板训练
- `POST /api/topics/{topic_id}/analyze`
- `GET /api/topics/{topic_id}/drafts/latest`
- `POST /api/topics/{topic_id}/agent/revise`
- `POST /api/topics/{topic_id}/confirm-template`
- `GET /api/topics/{topic_id}/templates`
- `DELETE /api/topics/{topic_id}/templates/{template_id}`

### 文档
- `POST /api/topics/{topic_id}/docs`
- `GET /api/docs?topicId=...`
- `GET /api/docs?unitId=...`
- `GET /api/docs/{doc_id}`
- `PUT /api/docs/{doc_id}`
- `DELETE /api/docs/{doc_id}`
- `POST /api/docs/{doc_id}/check`
- `POST /api/docs/importDocx`
- `POST /api/layout/docs/importDocx`（排版端别名，公司公文库上传使用）
- `POST /api/docs/{doc_id}/exportDocx`

### AI
- `POST /api/ai/rewrite`

## 10. 字体与版权合规

系统要求字体：
- 方正小标宋简
- 仿宋_GB2312
- 楷体_GB2312
- 黑体

说明：
- 编辑页自动检测字体，导出前强制复检。
- 仓库不内置受版权约束的商用字体文件，请使用单位已授权字体。

## 11. 大赛演示建议脚本（5 分钟）

1. 展示“公司 -> 题材库 -> 文档库 -> 正文编辑”整体流程。
2. 上传历史纪要训练材料，生成草稿并展示置信度报告。
3. 输入修订指令，演示智能体修订并确认模板版本。
4. 新建正文，演示一键排版和规范校验定位。
5. 选中段落进行智能润色，展示“预览后替换”。
6. 导出 DOCX，打开文件验证红头、字体、编号和尾部格式。

## 12. 当前边界与后续规划

当前已实现：
- 面向纪要/通知/请示/函的模板化排版闭环。
- 训练推断、版本管理、正文编辑、校验、导入导出、智能润色。

后续规划：
- 多角色协作与审批流。
- 更细粒度模板对比与回滚。
- 规则异常自动诊断与修复建议。
- 多机构私有化部署与权限域隔离。

## 13. 全量迁移（旧电脑到新电脑）

为保证“代码 + 数据 + 对象文件 + 环境变量”完整复现，仓库根目录提供了两个脚本：
- `backup-all.ps1`：在旧电脑导出备份
- `restore-all.ps1`：在新电脑导入恢复

### 13.1 旧电脑导出

在项目根目录执行：

```powershell
.\backup-all.ps1
```

默认会生成到：
- `.\backups\public-text-时间戳`

可选参数：

```powershell
.\backup-all.ps1 -BackupDir C:\backup\publicText
.\backup-all.ps1 -SkipEnvCopy
```

导出内容包含：
- `public_text.dump`（PostgreSQL）
- `minio_data.zip`（MinIO `/data`）
- `.env`（可选）
- `git-info.txt`、`checksums.txt`、`manifest.json`、`font-check.txt`

### 13.2 新电脑导入

1. 将备份目录拷到新电脑（例如 `C:\backup\publicText`）。
2. 将同版本代码放到项目目录（建议用 `git` checkout 到备份中的 commit）。
3. 在项目根目录执行：

```powershell
.\restore-all.ps1 -BackupDir C:\backup\publicText
```

脚本会要求输入 `RESTORE` 确认覆盖。若要跳过交互：

```powershell
.\restore-all.ps1 -BackupDir C:\backup\publicText -Force
```

可选参数：

```powershell
.\restore-all.ps1 -BackupDir C:\backup\publicText -SkipEnvRestore
```

恢复完成后访问：
- 前端：`http://localhost:5174`
- 后端健康检查：`http://localhost:8000/api/health`

### 13.3 注意事项

- 两台机器都需要 Docker Desktop 正常运行。
- 若你使用受版权约束字体，请在新电脑单独安装授权字体（脚本不会复制系统字体）。
