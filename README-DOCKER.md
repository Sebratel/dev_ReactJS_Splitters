# Docker Compose para Portainer

## Como usar

1. **Faça upload do `docker-compose.portainer.yml`** no Portainer
2. **Deploy o stack**
3. **Acesse o frontend direto:** `http://seu-servidor:3177` (ou use `FRONTEND_PORT` para outro valor)
   - Frontend e backend expõem portas no host para acesso direto (`3177` e `3001` por padrão)
   - **Debug:** ajuste `FRONTEND_PORT` e `BACKEND_PORT` no compose para expor outras portas

## O que está incluído

- ✅ **nginx-edge** (reverse proxy público, configs em `docker/nginx-edge/conf.d/`)
- ✅ Backend Node.js (rede interna, porta 3001)
- ✅ Frontend React/Vite (servidor Node interno na porta 3177 do container)
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