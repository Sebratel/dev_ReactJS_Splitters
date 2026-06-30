# NexaView Web (Splitters)

## Desenvolvimento

```bash
npm run dev
```

Variáveis: um único [`.env.example`](.env.example) documenta tudo; em dev use `.env.local` (gitignored) para sobrepor.

## Docker / Portainer

O deploy é feito pelo **Portainer**, criando a stack a partir do Git e apontando o compose path para **`docker-compose.portainer.yml`** (ver [`README-DOCKER.md`](README-DOCKER.md)). As variáveis (`VITE_*`, `DB_*`, `MASSIVA_*`, `GEOGRID_*`, portas, etc.) são definidas no painel *Environment variables* da stack — a secção *Docker* de [`.env.example`](.env.example) documenta todas. O compose passa as `VITE_*` como *build args* do frontend; o Vite **não** lê ficheiro dentro da imagem.

- O repositório no Git **não** deve (e não precisa) conter `.env.docker`. O `Dockerfile.frontend` **não** faz `COPY` desse ficheiro. Se ainda vires o erro `"/.env.docker": not found`, o stack está a construir **código antigo**: faz *Pull and redeploy* apontado ao **último commit** da branch (ou cola o `Dockerfile.frontend` / `docker-compose.portainer.yml` atuais do GitHub).
- Se aparecer *Bind for 0.0.0.0:3177 failed: port is already allocated*, a porta **3177** do host está ocupada. No stack, define **`FRONTEND_PORT`** com outra porta livre (ex.: `8080`); o mapeamento predefinido no compose é **host → container** `3177:3177`. Para comunicar com o backend direto, use também **`BACKEND_PORT=3001`** e defina `VITE_LOCAL_BFF_URL=http://localhost:3001` no stack.
- No stack, abra **Environment variables** e defina as chaves da secção *Docker* de [`.env.example`](.env.example) (`VITE_*`, `DB_*`, `MASSIVA_*`, `GEOGRID_*`, portas, etc.). O compose passa-as como *build args* para o frontend.
- Pode usar **Load variables from .env file** e colar o conteúdo de um `.env` completo (equivalente ao que usaria em `docker compose --env-file`).

### Build da imagem (`Dockerfile.frontend`)

- A imagem corre **`vite build`** (bundle) e **não** `tsc -b`, para evitar falhas difíceis de reproduzir fora do Docker. O typecheck continua em **`npm run build`** e **`npm run typecheck`** antes de merge/deploy.
- Se o **`vite build`** falhar, veja o log do `RUN npx vite build`. Se for **memória**, aumente `NODE_OPTIONS` (`--max-old-space-size`) no Dockerfile.
- Se o **backend** ficar *unhealthy*: confira `DB_*` e `MASSIVA_MYSQL_*` no stack. O serviço sobe a HTTP antes de completar a ligação às bases; veja *Logs* do container se as rotas com DB devolverem erro.
