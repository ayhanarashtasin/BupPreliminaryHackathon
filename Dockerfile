# Fallback execution path for the judges. No secrets are baked in: every credential
# arrives at runtime through -e / --env-file.
FROM node:22-alpine

ENV NODE_ENV=production \
    PORT=8080

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY server/ ./server/
COPY client/ ./client/
COPY BUP_CSE_FEST_2026_Preli_Public_Sample_Cases.json ./

USER node
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server/index.js"]
