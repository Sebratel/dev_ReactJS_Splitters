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
- Se aparecer *Bind for 0.0.0.0:3177 failed: port is already allocated*, a porta **3177** do host está ocupada. No stack, define **`FRONTEND_PORT=3177`** (ou outra livre); o mapeamento predefinido no compose passa a ser **3177→3177** no container. Para expor em **80**, para o serviço que a usa ou usa um *reverse proxy*.
- No stack, abra **Environment variables** e defina as chaves da secção *Docker* de [`.env.example`](.env.example) (`VITE_*`, `DB_*`, `MASSIVA_*`, `GEOGRID_*`, portas, etc.). O compose passa-as como *build args* para o frontend.
- Pode usar **Load variables from .env file** e colar o conteúdo de um `.env` completo (equivalente ao que usaria em `docker compose --env-file`).
- `npm run deploy:portainer` é alias de `npm run deploy:docker`.

### Build da imagem (`Dockerfile.frontend`)

- A imagem corre **`vite build`** (bundle) e **não** `tsc -b`, para evitar falhas difíceis de reproduzir fora do Docker. O typecheck continua em **`npm run build`** e **`npm run typecheck`** antes de merge/deploy.
- Se o **`vite build`** falhar, veja o log do `RUN npx vite build`. Se for **memória**, aumente `NODE_OPTIONS` (`--max-old-space-size`) no Dockerfile.
- Se o **backend** ficar *unhealthy*: confira `DB_*` e `MASSIVA_MYSQL_*` no stack. O serviço sobe a HTTP antes de completar a ligação às bases; veja *Logs* do container se as rotas com DB devolverem erro.
