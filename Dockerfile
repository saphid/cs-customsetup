FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=8080 DB_FILE=/data/profiles.db LOADOUT_IN_CONTAINER=1
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --prod --frozen-lockfile
COPY server server
COPY station station
COPY web web
RUN mkdir /data && chown node:node /data
VOLUME /data
EXPOSE 8080
USER node
CMD ["node", "--disable-warning=ExperimentalWarning", "server/server.mjs"]
