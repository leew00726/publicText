# 公司内网部署简版说明

本文档面向内网部署同事，重点说明：

- 服务器配置
- 依赖环境
- 数据库连接
- 配置文件
- 部署命令

## 1. 服务器配置建议

最低建议：

- CPU：4 核
- 内存：8 GB
- 磁盘：50 GB 以上
- 操作系统：Windows Server / Windows 10+ / Linux

推荐：

- CPU：8 核
- 内存：16 GB
- 磁盘：100 GB 以上

说明：

- 平台以前后端分离方式运行
- PostgreSQL 数据库存放在服务器本机磁盘
- 导入、导出文件也存放在服务器本机磁盘
- 如需 AI 功能，服务器需要能访问外部 DeepSeek 接口

## 2. 依赖环境

部署前需安装并启动：

- Docker
- Docker Compose

检查命令：

```powershell
docker --version
docker compose version
```

## 3. 部署目录

建议将项目代码放在固定目录，例如：

```text
D:\apps\publicText
```

后续所有命令默认在项目根目录执行。

## 4. 服务组成

内网部署使用 `docker-compose.server.yml`，会启动 3 个服务：

- `frontend`
  对外提供页面访问，默认暴露 `80` 端口。
- `backend`
  提供 API 服务，默认仅绑定本机 `127.0.0.1:8000`。
- `postgres`
  PostgreSQL 16 数据库。

## 5. PostgreSQL 部署方法

### 5.1 方式一：随平台一起部署

这是默认方式，推荐直接使用项目自带的 `docker-compose.server.yml`。

启动命令：

```powershell
docker compose --env-file .env.server -f docker-compose.server.yml up -d --build
```

说明：

- 会自动启动 `postgres` 容器
- 数据默认落盘到 `./data/postgres`
- 后端会通过 Compose 内部地址 `postgres:5432` 连接数据库

### 5.2 方式二：单独部署 PostgreSQL

如果数据库需要独立维护，也可以先单独启动 PostgreSQL，再让后端连接外部数据库。

示例命令：

```powershell
docker run -d `
  --name public-text-postgres `
  --restart unless-stopped `
  -e POSTGRES_DB=public_text `
  -e POSTGRES_USER=public_text `
  -e POSTGRES_PASSWORD=请改成正式密码 `
  -p 5432:5432 `
  -v D:\apps\publicText\data\postgres:/var/lib/postgresql/data `
  postgres:16
```

检查命令：

```powershell
docker ps
docker logs public-text-postgres --tail 100
```

### 5.3 使用外部 PostgreSQL 时的后端连接

如果 PostgreSQL 不跟随平台一起启动，而是使用单独部署的数据库实例，则后端需要把连接地址改成实际数据库地址。

连接串格式：

```text
postgresql+psycopg2://数据库用户名:数据库密码@数据库IP:5432/数据库名
```

例如：

```text
postgresql+psycopg2://public_text:your_password@192.168.10.20:5432/public_text
```

当前项目的 `docker-compose.server.yml` 默认是通过这组环境变量拼接连接串：

- `POSTGRES_DB`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`

如果后续要完全改成外部数据库模式，建议把 `backend` 服务中的 `DATABASE_URL` 改为固定外部地址，并移除 `depends_on: postgres`。

## 6. 数据落盘目录

宿主机目录如下：

- 数据库目录：`./data/postgres`
- 文件目录：`./data/storage`

说明：

- `./data/postgres` 保存 PostgreSQL 数据
- `./data/storage` 保存上传、导入、导出文件
- 重建容器不会清空以上目录

## 7. 配置文件

### 7.1 环境变量文件

复制模板：

```powershell
Copy-Item .env.server.example .env.server
```

主要配置项如下：

```env
APP_PORT=80
BACKEND_PORT=8000

POSTGRES_DB=public_text
POSTGRES_USER=public_text
POSTGRES_PASSWORD=请修改为正式密码

CORS_ORIGINS=http://服务器IP
CORS_ORIGIN_REGEX=^https?://(服务器IP|localhost|127\.0\.0\.1)(?::\d+)?$

DEEPSEEK_API_KEY=
DEEPSEEK_BASE_URL=https://api.deepseek.com/v1
DEEPSEEK_MODEL=deepseek-chat
DEEPSEEK_TIMEOUT_SEC=45
DEEPSEEK_TEMPERATURE=0.2
```

至少需要修改：

- `POSTGRES_PASSWORD`
- `APP_PORT`
- `CORS_ORIGINS`
- `CORS_ORIGIN_REGEX`
- `DEEPSEEK_API_KEY`，如果需要 AI 功能

### 7.2 员工账号文件

员工账号文件路径：

```text
backend/assets/employee_directory.json
```

格式示例：

```json
[
  {
    "employeeNo": "82000001",
    "name": "张三",
    "companyName": "云成数科",
    "departmentName": "综合部",
    "subDepartmentName": ""
  }
]
```

说明：

- `employeeNo` 为登录账号
- 系统启动时会自动同步该文件到数据库
- 新同步员工默认密码为 `000000`

## 8. 数据库连接说明

### 8.1 容器内连接

后端连接数据库使用的地址为：

```text
postgresql+psycopg2://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}
```

这里的 `postgres` 是 Docker Compose 内部服务名。

### 8.2 服务器本机连接

数据库容器默认没有对外暴露宿主机端口，因此：

- 前端和后端可正常通过容器网络访问数据库
- 其他机器不能直接从外部连 PostgreSQL

如果需要在服务器本机进入数据库，可执行：

```powershell
docker compose --env-file .env.server -f docker-compose.server.yml exec postgres sh
```

进入容器后：

```sh
psql -U public_text -d public_text
```

如果你修改了数据库名或用户名，请替换为实际值。

### 8.3 如需外部数据库工具连接

当前 `docker-compose.server.yml` 默认未开放 PostgreSQL 端口。

如果确实需要用 Navicat、DBeaver 等外部工具连接，可临时在 `postgres` 服务增加：

```yaml
ports:
  - "5432:5432"
```

然后重启服务。

不建议长期对内网大范围开放该端口；如必须开放，应限制服务器防火墙访问来源。

## 9. 部署命令

### 9.1 推荐方式

```powershell
.\deploy-server.ps1
```

### 9.2 手动方式

```powershell
docker compose --env-file .env.server -f docker-compose.server.yml up -d --build
```

## 10. 检查命令

查看容器状态：

```powershell
docker compose --env-file .env.server -f docker-compose.server.yml ps
```

查看日志：

```powershell
docker compose --env-file .env.server -f docker-compose.server.yml logs --tail=100
```

查看后端日志：

```powershell
docker compose --env-file .env.server -f docker-compose.server.yml logs --tail=100 backend
```

## 11. 验收

访问地址：

- 前端：`http://服务器IP/`
- 健康检查：`http://服务器IP/api/health`

健康检查正常返回：

```json
{"status":"ok"}
```

登录验证：

- 用户名：员工工号 `employeeNo`
- 默认密码：`000000`

## 12. 常用运维命令

停止服务：

```powershell
docker compose --env-file .env.server -f docker-compose.server.yml down
```

重新启动：

```powershell
docker compose --env-file .env.server -f docker-compose.server.yml up -d
```

重建并启动：

```powershell
docker compose --env-file .env.server -f docker-compose.server.yml up -d --build
```

重启后端：

```powershell
docker compose --env-file .env.server -f docker-compose.server.yml restart backend
```

## 13. 部署同事最短操作清单

1. 安装 Docker 和 Docker Compose
2. 将代码放到服务器目录
3. 执行 `Copy-Item .env.server.example .env.server`
4. 修改 `.env.server` 中数据库密码、访问地址、AI 密钥
5. 检查 `backend/assets/employee_directory.json`
6. 执行 `.\deploy-server.ps1`
7. 打开 `http://服务器IP/`
8. 打开 `http://服务器IP/api/health`
9. 用工号和默认密码 `000000` 登录测试
