# DeepSeek API Key Missing 运维处理指南

本文面向内网部署运维人员，用于处理页面或后端日志出现：

```text
DeepSeek API key is missing. Set DEEPSEEK_API_KEY.
```

## 结论

当前系统支持两种 DeepSeek 接入方式：

- 内网无鉴权 DeepSeek：`DEEPSEEK_API_KEY` 可以留空，`DEEPSEEK_REQUIRE_API_KEY=false`。
- 需要鉴权的 DeepSeek 或网关：填写 `DEEPSEEK_API_KEY`，并可设置 `DEEPSEEK_REQUIRE_API_KEY=true`。

如果接入的是公司内网无鉴权 DeepSeek，仍然报 `api key missing`，通常是服务器还在运行旧镜像或 `.env.server` 没有配置 `DEEPSEEK_REQUIRE_API_KEY=false`。

## 1. 检查配置文件

在服务器项目目录执行：

```powershell
Get-Content .env.server
```

内网无鉴权 DeepSeek 推荐配置：

```env
DEEPSEEK_API_KEY=
DEEPSEEK_REQUIRE_API_KEY=false
DEEPSEEK_BASE_URL=http://10.211.49.42:8124/v1/models
DEEPSEEK_MODEL=deepseek-chat
DEEPSEEK_TIMEOUT_SEC=45
DEEPSEEK_TEMPERATURE=0.2
TEMPLATE_INFERENCE_ENGINE=hybrid
```

如果 DeepSeek 地址不是 `10.211.49.42:8124`，把 `DEEPSEEK_BASE_URL` 改成实际内网地址。系统会把 `/v1/models` 自动转换为 `/v1/chat/completions`。

## 2. 重建并重启后端

修改 `.env.server` 后必须重建后端容器：

```powershell
docker compose --env-file .env.server -f docker-compose.server.yml up -d --build backend
```

如果同时要重启前端和数据库依赖：

```powershell
docker compose --env-file .env.server -f docker-compose.server.yml up -d --build
```

## 3. 检查容器环境变量

确认后端容器里读到的是新配置：

```powershell
docker compose --env-file .env.server -f docker-compose.server.yml exec backend python -c "from app.config import Settings; s=Settings(); print('require_key=', s.deepseek_require_api_key); print('base_url=', s.deepseek_base_url); print('has_key=', bool(s.deepseek_api_key))"
```

内网无鉴权模式应看到：

```text
require_key= False
has_key= False
```

## 4. 检查后端日志

```powershell
docker compose --env-file .env.server -f docker-compose.server.yml logs --tail=100 backend
```

如果仍出现 `DeepSeek API key is missing`，说明后端仍未使用新代码或新配置。重新拉取代码、确认分支和提交，再执行第 2 步。

## 5. 检查 DeepSeek 网络可达性

进入后端容器检查接口连通性：

```powershell
docker compose --env-file .env.server -f docker-compose.server.yml exec backend python -c "import urllib.request; print(urllib.request.urlopen('http://10.211.49.42:8124/v1/models', timeout=10).status)"
```

如果这里超时或连接失败，问题是服务器到 DeepSeek 服务的网络、端口、防火墙或地址配置，不是 API key。

## 6. 需要鉴权时的配置

如果内网网关后来要求鉴权，改为：

```env
DEEPSEEK_API_KEY=实际密钥
DEEPSEEK_REQUIRE_API_KEY=true
```

然后重新执行：

```powershell
docker compose --env-file .env.server -f docker-compose.server.yml up -d --build backend
```

不要把真实密钥提交到仓库。
