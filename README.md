# genmd-from-discord-bot

Discordから記事を投稿し、GitHub PR経由で静的サイトに公開するBot。

https://log4me.2haya.net/ に記事をデプロイするのに使っている。

## 前提条件

- Node.js 20+
- Docker / Docker Compose（Dockerで稼働させる場合）
- Discord Developer Portal でBotを作成済み
- GitHub リポジトリとFine-grained PAT

### 対象リポジトリの事前準備

Botは最初に `GITHUB_BASE_BRANCH`（既定: `main`）のrefを取得するため、対象リポジトリに初期コミットが1つ以上必要。

- 空のリポジトリだと `Git Repository is empty` エラーになる
- 初期コミット（README等）を作成し、`main` ブランチが存在する状態にする
- `site/content/posts/` ディレクトリは記事作成時に自動作成されるため、事前に用意する必要なし

## 環境変数の設定

`.env.example` を `.env` にコピーし、各値を設定する。

```bash
cp .env.example .env
```

| 変数 | 説明 | 取得方法 |
|---|---|---|
| `DISCORD_TOKEN` | Botトークン | Discord Developer Portal → Bot → Token |
| `DISCORD_CLIENT_ID` | アプリケーションID | Discord Developer Portal → General Information |
| `DISCORD_GUILD_ID` | サーバーID | Discord 設定 → 詳細設定 → サーバーIDをコピー |
| `ALLOWED_DISCORD_USER_IDS` | 許可するユーザID（カンマ区切り） | Discord 設定 → 詳細設定 → ユーザIDをコピー |
| `GITHUB_TOKEN` | GitHub PAT | GitHub Settings → Developer settings → Fine-grained tokens |
| `GITHUB_OWNER` | リポジトリオーナー | GitHub ユーザ名 or Org名 |
| `GITHUB_REPO` | リポジトリ名 | |
| `GITHUB_BASE_BRANCH` | ベースブランチ | 既定: `main` |
| `SITE_BASE_URL` | サイトのベースURL | 例: `https://example.com` |
| `POSTS_DIRECTORY` | 記事保存先 | 既定: `site/content/posts` |
| `DATABASE_PATH` | SQLiteファイルパス | 既定: `./bot.sqlite` |
| `TIMEZONE` | タイムゾーン | 既定: `Asia/Tokyo` |

### GitHub PAT の権限

Fine-grained PAT に以下の権限を付与する:

- Repository contents: Read and write
- Pull requests: Read and write
- Metadata: Read-only

## ローカルでの動作確認

```bash
npm install
npm run dev
```

起動後、`Logged in as <Bot名>` と表示されれば成功。

## Dockerでの動作確認

```bash
docker compose -f docker/compose.yml up --build
```

SQLiteファイルは `bot-data` volume に永続化される。

## Kubernetesでの動作確認

```bash
kubectl apply -f k8s/
```

- 非機密設定は `k8s/configmap.yaml`、トークン等の機密情報は `k8s/secret.yaml` に設定する
- SQLiteファイルは PVC（`bot-data` 相当の `genmd-from-discord-bot`）で永続化される
- イメージは `k8s/deployment.yaml` の `image` を実環境のレジストリ名に置き換える

## 動作確認手順

1. Discord サーバーで `/post` を実行
2. Modal が表示されるので、タイトルと本文を入力
3. PRが作成され、確認Embedとボタンが表示される
4. 「公開する」ボタンでPRがsquash mergeされる
5. 「取り消す」ボタンでPRがcloseされる
