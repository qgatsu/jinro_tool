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

### サイトマップ

`sitemap.xml` に検索対象のトップページを記載し、`robots.txt` から参照しています。
両ファイルはビルド時に `dist/` へコピーされます。
公開後、Search Console の「サイトマップ」で `https://www.jinro-powertool.com/sitemap.xml` を送信してください。
独立したページを追加する場合は、`sitemap.xml` にその正規 URL を追加します。

公式ドキュメント: [GitHub 連携](https://vercel.com/docs/git/vercel-for-github)、[ビルド設定](https://vercel.com/docs/builds/configure-a-build)。

### 公開ファイルのローカル確認

Node.js 18 以上と Python 3 がある環境では、Docker なしで確認できます。

```bash
node deploy/build-static.mjs
python3 -m http.server 3000 --directory dist
```

`http://localhost:3000/` を開きます。`dist/` は生成物なので Git に含めません。

## 試合の保存・連戦

- 試合は利用中のブラウザの localStorage に自動保存します。サーバーには送信しません。
- 「記録して次の試合へ」で参加者だけを引き継ぎます。役職構成・CO・死亡・投票・スケール・メモ・結果は初期化します。
- 以前の試合は「試合」の選択欄から開き直して編集できます。試合ごとに投票の取り消し・やり直しも保持します。
- 別端末・別ブラウザ・別オリジンの保存データとは共有されません。ブラウザのサイトデータを消すと履歴も消えます。
- 保存容量不足や保存不可の場合は画面上部に表示します。破損した保存データは自動で上書きしません。

プレイヤーは固定 ID で記録し、名前の変更では各記録の紐付けを維持します。削除時は投票の取り消し・やり直し履歴を含めて参照を除去します。
投票の修正は投票順を維持し、クリックまたは線の先端のドラッグで投票先だけを変更します。選択した線は外周を赤く表示します。同じペアの再選択では削除せず、専用の「選択した1票を削除」で削除します。
死亡判定は日付順に、各日の「CO・投票 → 吊り → 噛み」で計算します。過去日への変更による後続の重複死亡は解除し、霊能結果の対象も同期します。

## ロジックの検証

追加ライブラリなしで、ID・投票削除・死亡判定・試合分離・保存データの検証を実行できます。

```bash
node test/game.test.mjs
```

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
