# Docker Compose para Portainer

## Como usar

1. **Faça upload do `docker-compose.portainer.yml`** no Portainer (stack a partir do Git mantém `docker/nginx-edge/` montado no serviço `nginx-edge`)
2. **Deploy o stack**
3. **Acesse pela borda Nginx:** `http://seu-servidor` (porta **80**, ou `EDGE_HTTP_PORT` se definir na stack)
   - Frontend e backend não expõem portas no host por defeito; o proxy encaminha para o container `frontend`
   - **Debug:** descomente `ports` em `backend` e/ou `frontend` no compose para aceder direto (ex. `:5173`, `:3031`)

## O que está incluído

- ✅ **nginx-edge** (reverse proxy público, configs em `docker/nginx-edge/conf.d/`)
- ✅ Backend Node.js (rede interna, porta 3001)
- ✅ Frontend React/Vite (Nginx interno na porta 80 do container)
- ✅ Conexão MySQL remoto (10.0.11.171)
- ✅ APIs externas configuradas
- ✅ Health checks automáticos
- ✅ Rede Docker para comunicação

## Funcionalidades

- ✅ Sistema de massivas
- ✅ APIs GeoGrid, Hub, AutoISP
- ✅ Google OAuth
- ❌ Estatísticas de dashboard (PostgreSQL desabilitado)

## Problemas?

Se o container ficar unhealthy, verifique os logs:
```bash
docker logs nexaview-backend
```