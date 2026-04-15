# 内网服务器部署

这套部署配置用于公司内网服务器，保留当前前端页面和员工默认密码 `000000` 的临时策略不变。

## 部署目标

- 前端使用生产构建后的静态文件，由 Nginx 对外提供 `80` 端口
- `/api/*` 和 `/assets/*` 由前端容器内的 Nginx 反向代理到 FastAPI
- PostgreSQL 数据落在宿主机 `./data/postgres`
- 导入/导出文件落在宿主机 `./data/storage`
- 模板、题材、员工、文档元数据继续保存在 PostgreSQL

## 首次准备

1. 复制环境变量模板

```powershell
Copy-Item .env.server.example .env.server
```

2. 至少修改以下值

- `POSTGRES_PASSWORD`
- `APP_PORT`，默认 `80`
- `DEEPSEEK_API_KEY`，如果服务器需要使用 AI 功能

## 启动

```powershell
docker compose --env-file .env.server -f docker-compose.server.yml up -d --build
```

或者使用脚本：

```powershell
.\deploy-server.ps1
```

## 访问与检查

- 前端首页：`http://服务器IP/`
- 后端健康检查：`http://服务器IP/api/health`
- 服务器本机健康检查：`http://127.0.0.1:8000/api/health`

检查命令：

```powershell
docker compose --env-file .env.server -f docker-compose.server.yml ps
docker compose --env-file .env.server -f docker-compose.server.yml logs --tail=100
```

## 数据落盘位置

- PostgreSQL：`./data/postgres`
- 导入与导出文件：`./data/storage`

这两个目录都在宿主机，容器重建后不会丢。

## 停止

```powershell
docker compose --env-file .env.server -f docker-compose.server.yml down
```

如果只是重启服务，不要删除 `./data/postgres` 和 `./data/storage`。
