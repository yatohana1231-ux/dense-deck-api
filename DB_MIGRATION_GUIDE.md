# DB Migration Guide (Prisma)

## 概要
Prisma スキーマ変更時のマイグレーション手順をまとめています。  
基本フロー: スキーマ変更 → 開発用DBで `migrate dev` → マイグレーションをコミット → 本番で `migrate deploy`。

## 手順

1. 作業環境を用意  
   - ローカルや開発用DBに接続できる `DATABASE_URL` を `.env` に設定する。  
   - 例: Docker で Postgres を起動し、`postgresql://postgres:pass@localhost:5432/dense_deck?schema=public` など。

2. Prisma スキーマを修正  
   - `prisma/schema.prisma` にモデル追加/カラム追加などの変更を加える。

3. マイグレーション生成（開発用 DB に適用）  
   - `npx prisma migrate dev --name <name>`  
   - これで `prisma/migrations/<timestamp>_<name>/migration.sql` が生成され、開発DBに適用される。  
   - 必要に応じて `npx prisma generate` でクライアント再生成。

4. マイグレーションをコミット  
   - 生成された `prisma/migrations/` の新ディレクトリをリポジトリに含めてコミットする。

5. 本番/ステージングで適用  
   - デプロイ先で `.env` を本番の `DATABASE_URL` に設定したうえで  
     `npx prisma migrate deploy`  
     を実行し、マイグレーションを本番DBに適用する。  
   - 本番で `migrate dev` は使わない。

6. アプリ再起動/デプロイ  
   - API を再起動して新スキーマに対応させる。必要に応じてフロントも再ビルド。

## 注意点
- 本番適用前にDBバックアップを推奨。  
- 環境ごとに `DATABASE_URL` を分ける（ローカル/本番）。  
- スキーマ変更は必ずマイグレーションファイルに落とし込み、手動で直接本番スキーマを変更しないこと。  
- ローカルで Postgres を使う場合は Docker Desktop などで簡単に立ち上げることが可能。使用後は `docker stop pg-local && docker rm pg-local` でクリーンアップ。
