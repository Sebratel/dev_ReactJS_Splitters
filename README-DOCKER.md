# Docker Compose para Portainer

## Como usar

1. **Faça upload do `docker-compose.portainer.yml`** no Portainer (stack a partir do Git).
2. **Deploy o stack**
3. **Aceda ao frontend:** `http://seu-servidor:3177` (ou defina **`FRONTEND_PORT`** no ambiente da stack para outra porta livre).
   - O mapeamento predefinido é **host → container** `3177:3177` (Nginx dentro da imagem do frontend escuta na **3177**).
   - O **backend** expõe **`BACKEND_PORT`** no host (predefinido **3001**).
   - Com **`VITE_LOCAL_BFF_URL` vazio**, o browser usa a mesma origem (host + porta) para `/api` (proxy no Nginx **dentro** da imagem do frontend).

## O que está incluído

- ✅ Backend Node.js (rede interna, porta 3001; healthcheck em `/api/health`)
- ✅ Frontend React/Vite (Nginx interno na porta **3177** do container)
- ✅ Conexão MySQL remoto (variáveis `MASSIVA_MYSQL_*`)
- ✅ APIs externas configuradas
- ✅ Health checks automáticos
- ✅ Rede Docker para comunicação

Opcional (não faz parte deste compose): pasta **`docker/nginx-edge/`** para quem quiser um reverse proxy extra ou TLS na mesma máquina.

## Funcionalidades

- ✅ Sistema de massivas
- ✅ APIs GeoGrid, Hub, AutoISP
- ✅ Google OAuth
- ❌ Estatísticas de dashboard (PostgreSQL desabilitado)

## Problemas?

Se o container ficar unhealthy, verifique os logs:

```bash
docker logs react-backend-portainer
```
