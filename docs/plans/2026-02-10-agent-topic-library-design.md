# 公司题材库 + Agent模板学习（零留存）设计

## 1. 目标与边界

### 1.1 目标
- 以公司为主体管理公文题材库。
- 题材由用户自定义创建，创建后立即可用。
- 用户上传同题材历史 DOCX 后，系统自动归纳排版共性，生成模板草案。
- 用户可与 Agent 对话修订模板，确认后保存为生效模板。
- 训练过程采用 A 级“零留存”：不保留原始训练文件、不保留正文、不保留文件名。

### 1.2 非目标（V1）
- 不做大模型微调。
- 不做文本语义训练，仅做版式规则归纳。
- 不保留训练样本用于回放，复核需重新上传。

## 2. 关键决策（已确认）

- 方案选型：`方案A`（规则统计 + Agent解释与修订）。
- 安全级别：`A`（训练完成后零留存）。
- 题材来源：用户自定义新建，不使用固定枚举。
- 题材可用性：创建后无需审核，直接使用。
- 模板生效：`confirmed` 后自动设为当前生效模板。
- 审计日志：不记录文件名，仅记录数量/字节数/状态/时间。

## 3. 业务流程

1. 用户选择公司。
2. 进入公司题材库（初始可为空）。
3. 用户新建题材（仅名称必填，系统生成唯一 code）。
4. 进入题材详情，上传多份历史 DOCX。
5. 后端内存解析并抽取样式特征。
6. 统计共性并生成模板草案（含置信度说明）。
7. 用户与 Agent 对话修订草案。
8. 用户确认模板，系统保存新版本并自动设为生效模板。
9. 后续按该题材新建公文时默认套用当前生效模板。

## 4. 架构设计

### 4.1 前端
- `CompanySelectPage`：公司选择入口。
- `TopicListPage`：题材列表与空态引导，新建题材。
- `TopicDetailPage`：上传材料、分析结果、草案预览、Agent修订、确认保存。
- `TemplatePreviewPanel`：结构化显示规则（标题层级、字体、字号、段距、行距、缩进、页边距等）。
- `AgentChatPanel`：仅针对结构化规则对话，不展示正文。

### 4.2 后端
- `TopicService`：题材 CRUD、编码生成、公司隔离。
- `StyleExtractionService`：DOCX 样式特征提取（内存处理）。
- `RuleInferenceService`：多文件共性统计与置信度计算。
- `AgentRevisionService`：基于草案规则进行增量修订与解释。
- `TemplatePublishService`：定版、版本管理、生效切换。
- `AuditService`：零留存审计事件记录。

## 5. 数据模型（新增）

### 5.1 Topic
- `id, company_id(unit_id), name, code, description, status(active), created_by, created_at, updated_at`
- 唯一约束：`(company_id, code)`

### 5.2 TopicTemplateDraft
- `id, topic_id, version, status(draft|confirmed|archived), inferred_rules(json), confidence_report(json), agent_summary, created_at, updated_at`

### 5.3 TopicTemplate
- `id, topic_id, version, rules(json), source_draft_id, effective(bool), created_at`

### 5.4 DeletionAuditEvent
- `id, company_id, topic_id, file_count, total_bytes, status(success|failed), started_at, ended_at, error_code`
- 不含文件名、不含正文、不含文件路径

## 6. API（V1）

- `GET /api/companies`
- `GET /api/topics?companyId=`
- `POST /api/topics`
- `POST /api/topics/{topicId}/analyze`（multipart 上传多文件，服务端内存解析）
- `GET /api/topics/{topicId}/drafts/latest`
- `POST /api/topics/{topicId}/agent/revise`
- `POST /api/topics/{topicId}/confirm-template`
- `GET /api/topics/{topicId}/templates`

## 7. 零留存控制点（必须）

- 禁止将训练文件写入 MinIO/本地磁盘。
- 禁止将正文写入数据库与日志。
- 禁止向量库/索引落地。
- 请求结束统一执行内存对象销毁（含异常路径）。
- 禁用请求体日志；异常日志脱敏。
- 训练目录与进程缓存目录排除系统备份快照（运维项）。

## 8. 失败与并发处理

- 解析失败：返回文件级错误码，不附正文片段。
- 样本不足：返回“不可归纳”与建议补样本数。
- 并发修订：草案保存使用 `version` 乐观锁，冲突则提示刷新。
- 清理失败：主流程返回失败并写审计告警事件。

## 9. 验收标准

1. 上传训练后存储层无原始 DOCX。
2. 数据库无正文/文件名字段落地。
3. 可完成“新建题材 -> 分析 -> 修订 -> 定版自动生效”闭环。
4. 审计日志仅包含元数据（数量、字节数、状态、时间）。
5. 并发修订有版本冲突保护。
6. 定版模板可被新建文档正确套用。

## 10. 实施优先级

1. 数据模型与迁移：Topic/Draft/Template/Audit。
2. 分析接口：多文件内存解析 + 归纳。
3. Agent修订接口：结构化规则增量修改。
4. 前端题材库与详情页。
5. 定版自动生效与新建公文接入。
6. 零留存与日志安全回归测试。

