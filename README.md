# jinro_tool

静的な HTML/CSS/JS で構成された人狼プレイヤー向けツールです。
Vercel で静的サイトとして公開できます。サーバー処理・DB・環境変数は不要です。

## Vercel へのデプロイ

1. この変更を GitHub の `qgatsu/jinro_tool` に push します。
2. Vercel の個人アカウントで **Add New → Project** を開き、`qgatsu/jinro_tool` を Import します。
3. Framework Preset は **Other**、Root Directory はリポジトリのルート（`./`）にします。
4. `vercel.json` の設定を使用して Deploy します。環境変数の設定は不要です。
5. **Settings → Environments → Production → Branch Tracking** で、本番に使用するブランチを `deploy` に設定します。初回も `deploy` ブランチのコミットが公開されていることを Deployments で確認してください。

ビルドは `node deploy/build-static.mjs`、公開ディレクトリは `dist` です。
依存パッケージのインストールは不要で、HTML・CSS・JS・画像・フォントだけを公開用にコピーします。
以後は `deploy` ブランチへの push で Vercel が本番を更新します。

公式ドキュメント: [GitHub 連携](https://vercel.com/docs/git/vercel-for-github)、[ビルド設定](https://vercel.com/docs/builds/configure-a-build)。

### 公開ファイルのローカル確認

Node.js 18 以上と Python 3 がある環境では、Docker なしで確認できます。

```bash
node deploy/build-static.mjs
python3 -m http.server 3000 --directory dist
```

`http://localhost:3000/` を開きます。`dist/` は生成物なので Git に含めません。

## ローカル確認

```bash
docker compose up --build
```

- 初回実行時は `Dockerfile` を元に Nginx イメージをビルドします。
- コンテナはポート `3000` を公開し、ホストの `3000` 番にフォワードします。
- ブラウザで `http://localhost:3000/` にアクセスすると UI を確認できます。

## Lightsail などへのデプロイ

以下は従来の構成です。GitHub Actions の Lightsail デプロイは手動実行のみとしています。

`youtube_clip_search` と同様の手順で、`deploy/lightsail` 以下に本番用ファイルを配置しています。

```bash
cd deploy/lightsail
docker compose up -d --build
```

- `deploy/lightsail/Dockerfile`: 静的ファイルを Nginx (alpine) イメージへコピー。
- `deploy/lightsail/docker-compose.yml`: サービス名 `jinro_tool` として 8080→80 で公開。
- `.dockerignore`: デプロイ時に不要なファイルをイメージへ含めないための設定。
