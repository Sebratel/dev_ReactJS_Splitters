# Docker Compose para Portainer

## Como usar

1. **Faça upload do `docker-compose.portainer.yml`** no Portainer
2. **Deploy o stack**
3. **Acesse:**
   - Frontend: http://seu-servidor:5173
   - Backend: http://seu-servidor:3001/api/health

## O que está incluído

- ✅ Backend Node.js (porta 3001)
- ✅ Frontend React/Vite (porta 5173)
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