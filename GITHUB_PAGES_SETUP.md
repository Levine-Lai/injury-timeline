# GitHub Pages 与 API-Football 配置

## 1. 获取 API key

1. 注册 API-Football 账号：https://dashboard.api-football.com/register
2. 登录 Dashboard，在账户/API Key 页面复制 key。
3. 不要把 key 写进 `dist/client`、GitHub 仓库、提交记录或 GitHub Pages Secrets 构建产物。

API-Football 使用请求头：

```http
x-apisports-key: YOUR_KEY
```

## 2. 部署 API 代理

GitHub Pages 没有服务端，因此 key 必须放在独立代理中。项目的 `worker/` 已包含 Cloudflare Worker 示例。

安装并登录 Wrangler 后，在项目目录执行：

```powershell
cd worker
npx wrangler login
npx wrangler secret put API_FOOTBALL_KEY
npx wrangler deploy
```

第二条命令会提示输入 key；输入时不会把它写入 Git。部署完成后记录 Worker 地址，例如：

```text
https://injury-api-proxy.<你的子域>.workers.dev
```

正式公开前，把 `worker/wrangler.toml` 中的 `ALLOWED_ORIGIN` 从 `*` 改成你的 Pages 地址。

## 3. 连接前端

修改 `dist/client/config.js`：

```js
window.INJURY_API_BASE = 'https://injury-api-proxy.<你的子域>.workers.dev';
```

这里只填写代理地址，不能填写 API key。

## 4. 发布 GitHub Pages

项目已包含 `.github/workflows/pages.yml`。把仓库推送到 GitHub 后：

1. 打开仓库 `Settings → Pages`。
2. 在 `Build and deployment → Source` 选择 `GitHub Actions`。
3. 推送到 `main`，或在 Actions 页面手动运行 `Deploy GitHub Pages`。

发布地址通常是：

```text
https://<用户名>.github.io/<仓库名>/
```

## 5. 本地密钥

本地调试可将 key 写入未跟踪的 `.dev.vars`：

```text
API_FOOTBALL_KEY=你的真实key
```

`.dev.vars` 和 `.env` 已加入 `.gitignore`。

