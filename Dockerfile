FROM node:22-alpine

WORKDIR /app

# 依存関係だけ先に入れてキャッシュを効かせる
COPY package.json package-lock.json* ./
RUN npm install

# Prisma schema を含めてクライアント生成
COPY tsconfig.json ./
COPY prisma ./prisma
RUN npx prisma generate

# ソース
COPY src ./src
COPY assets ./assets

# ビルド
RUN npm run build

ENV NODE_ENV=production
EXPOSE 3000

CMD ["npm", "run", "start"]
