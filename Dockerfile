FROM node:22-alpine

WORKDIR /app

# 依存インストール（キャッシュ効かせる）
COPY package.json package-lock.json* ./
RUN npm install

# ソース
COPY tsconfig.json ./
COPY src ./src
COPY assets ./assets

# 本番実行はビルド済みJSで
RUN npm run build

ENV NODE_ENV=production
EXPOSE 3000

CMD ["npm", "run", "start"]
