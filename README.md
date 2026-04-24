# NexaView Web (Splitters)

## Desenvolvimento

```bash
npm run dev
```

Variáveis: um único [`.env.example`](.env.example) documenta tudo; em dev use `.env.local` (gitignored) para sobrepor.

## Docker (um ambiente, um ficheiro)

1. Crie **`.env.docker`** com a secção *Docker* de `.env.example` (e preencha credenciais).
2. Suba a stack (Nginx com o bundle + API Node no mesmo compose):

```bash
npm run deploy:docker
```

O ficheiro **`.env.docker`** é a única fonte de variáveis: o `Dockerfile.frontend` copia-o para `.env.production` (build do Vite) e o `docker-compose` carrega o mesmo ficheiro no **backend** em runtime. Não versionar **`.env.docker`**.

## Portainer

- Faça o upload de **`docker-compose.yml`**, o diretório de contexto (root do repo) e crie o ficheiro **`.env.docker`** no host junto do stack; em seguida use **Deploy the stack** com o mesmo conteúdo de variáveis, ou o **Build** a partir de um repositório onde o pipeline gere `.env.docker` antes do `docker build`.
- `npm run deploy:portainer` é alias de `npm run deploy:docker`.
