# 🚀 Stack NexaView - Guia Rápido para Docker Hub + Portainer

## 📋 O que foi criado

Para publicar sua aplicação no Docker Hub e usar no Portainer:

### Arquivos Criados:
1. **`docker-compose.stack.yml`** - Stack pronta para Portainer com imagens do Docker Hub
2. **`STACK_PORTAINER_DOCKER_HUB.md`** - Documentação completa
3. **`publish-to-docker-hub.sh`** - Script para publicar imagens automaticamente
4. **`.env.portainer.example`** - Template de variáveis de ambiente

---

## ⚡ Passo a Passo Rápido

### 1️⃣ Publicar Imagens no Docker Hub

```bash
# Opção A: Usar o script (Linux/Mac)
chmod +x publish-to-docker-hub.sh
./publish-to-docker-hub.sh seu-usuario latest

# Opção B: Manual (Windows/PowerShell)
docker login
cd server
docker build -t seu-usuario/nexaview-backend:latest .
docker push seu-usuario/nexaview-backend:latest
cd ..
docker build -f Dockerfile.frontend -t seu-usuario/nexaview-frontend:latest .
docker push seu-usuario/nexaview-frontend:latest
```

### 2️⃣ No Portainer

1. Acesse **Stacks** → **Add Stack**
2. Copie o conteúdo de **`docker-compose.stack.yml`**
3. Na seção **Environment Variables**, adicione:

```
BACKEND_IMAGE=seu-usuario/nexaview-backend:latest
FRONTEND_IMAGE=seu-usuario/nexaview-frontend:latest
MASSIVA_MYSQL_HOST=10.0.11.171
MASSIVA_MYSQL_USER=DevSebratel
MASSIVA_MYSQL_PASSWORD=DevBI*24
```

4. Clique **Deploy** ✅

---

## 🔗 URLs da Stack

Após deploy:
- **Frontend**: http://seu-servidor:5173
- **Backend**: http://seu-servidor:3001
- **Health Check**: http://seu-servidor:3001/api/health

---

## 📦 Variáveis Disponíveis

Configure no Portainer conforme necessário:

```yaml
# Imagens (OBRIGATÓRIO)
BACKEND_IMAGE=seu-usuario/nexaview-backend:latest
FRONTEND_IMAGE=seu-usuario/nexaview-frontend:latest

# Banco de dados
MASSIVA_MYSQL_HOST=10.0.11.171
MASSIVA_MYSQL_USER=DevSebratel
MASSIVA_MYSQL_PASSWORD=DevBI*24

# APIs
VITE_GEOGRID_API_KEY=sua-chave
AUTOISP_PASSWORD=sua-senha
VITE_GOOGLE_CLIENT_ID=seu-client-id

# URLs (stack com nginx-edge: VITE_LOCAL_BFF_URL vazio = mesmo host público)
VITE_LOCAL_BFF_URL=
VITE_GOOGLE_REDIRECT_URI=https://seu-dominio.com/callback
```

Veja **`.env.portainer.example`** para lista completa!

---

## 🔐 Segurança Recomendações

✅ Use Portainer **Secrets** para:
- `MASSIVA_MYSQL_PASSWORD`
- `AUTOISP_PASSWORD`
- `ERP_CLIENT_SECRET`
- `VITE_GOOGLE_CLIENT_ID`

✅ Configure **SSL/TLS** com Traefik ou Nginx

✅ Ative **Resource Limits** (veja `docker-compose.stack.yml`)

---

## 🆘 Comandos Úteis

```bash
# Ver logs em tempo real
docker logs -f nexaview-backend
docker logs -f nexaview-frontend

# Health check
curl http://localhost:3001/api/health

# Entrar no container
docker exec -it nexaview-backend sh

# Listar containers
docker ps | grep nexaview

# Remover stack
docker-compose -f docker-compose.stack.yml down
```

---

## 📚 Arquivos de Referência

| Arquivo | Uso |
|---------|-----|
| `docker-compose.stack.yml` | Stack para Portainer |
| `STACK_PORTAINER_DOCKER_HUB.md` | Documentação completa |
| `publish-to-docker-hub.sh` | Script de automação |
| `.env.portainer.example` | Template de variáveis |
| `docker-compose.yml` | Desenvolvimento local |
| `docker-compose.portainer.yml` | Build local → Portainer |

---

## ✨ Próximos Passos

1. ✅ Publicar imagens: `./publish-to-docker-hub.sh seu-usuario latest`
2. ✅ No Portainer: copiar `docker-compose.stack.yml`
3. ✅ Configurar variáveis de ambiente
4. ✅ Deploy
5. ✅ Monitorar logs
6. ✅ Configurar backups

---

**Tudo pronto para produção! 🚀**