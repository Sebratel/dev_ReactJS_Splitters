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

Em local, crie **`.env.docker`** (não comitar) com o mesmo conteúdo; o `npm run deploy:docker` usa `docker compose --env-file .env.docker` para preencher `build args` e o `environment` do backend. O Vite **não** lê ficheiro dentro da imagem: as `VITE_*` vão pelo compose.

## Portainer

- O repositório no Git **não** deve (e não precisa) conter `.env.docker`. O `Dockerfile.frontend` **não** faz `COPY` desse ficheiro. Se ainda vires o erro `"/.env.docker": not found`, o stack está a construir **código antigo**: faz *Pull and redeploy* apontado ao **último commit** da branch (ou cola o `Dockerfile.frontend` / `docker-compose.yml` atuais do GitHub).
- No stack, abra **Environment variables** e defina as chaves da secção *Docker* de [`.env.example`](.env.example) (`VITE_*`, `DB_*`, `MASSIVA_*`, `GEOGRID_*`, portas, etc.). O compose passa-as como *build args* para o frontend.
- Pode usar **Load variables from .env file** e colar o conteúdo de um `.env` completo (equivalente ao que usaria em `docker compose --env-file`).
- `npm run deploy:portainer` é alias de `npm run deploy:docker`.
