FROM node:22-alpine

RUN apk add --no-cache wget tzdata
ENV TZ=America/Sao_Paulo

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

EXPOSE 3001

# `-r ./apm.cjs` inicia o agente Elastic APM antes dos imports do `index.js`.
# Sem ELASTIC_APM_SERVER_URL no ambiente, o preload não ativa nada (ver server/apm.cjs).
CMD ["node", "-r", "./apm.cjs", "index.js"]
