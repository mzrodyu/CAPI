# Postgres 持久化

CAPI 支持 Postgres 作为后端持久化。

## 配置

```text
PERSISTENCE=postgres
DATABASE_URL=postgres://capi:capi@localhost:5432/capi?sslmode=disable
DATABASE_MAX_OPEN_CONNS=10
DATABASE_MAX_IDLE_CONNS=5
DATABASE_CONN_MAX_LIFETIME_MINUTES=30
```

启动时会自动创建：

```sql
CREATE TABLE IF NOT EXISTS capi_state (
  id text PRIMARY KEY,
  data jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS capi_schema_migrations (
  version integer PRIMARY KEY,
  name text NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now()
);
```

当前版本先使用 `jsonb` 快照保存完整状态，目的是让文件模式平滑切到 Postgres，不打断现有 API。后续可以继续把用户、API Key、渠道、模型、日志、额度流水拆成规范化表。

## 本地 Docker

```bash
docker run --name capi-postgres \
  -e POSTGRES_USER=capi \
  -e POSTGRES_PASSWORD=capi \
  -e POSTGRES_DB=capi \
  -p 5432:5432 \
  -d postgres:17
```

然后设置：

```text
PERSISTENCE=postgres
DATABASE_URL=postgres://capi:capi@localhost:5432/capi?sslmode=disable
```

## 迁移策略

第一次使用空数据库时，CAPI 会写入空状态和默认模型目录。首次打开站点后，在初始化页面创建管理员账号。

从文件模式切换到 Postgres 时，可以先用空状态启动；如果需要迁移现有 `data/state.json`，后续可增加导入命令。
