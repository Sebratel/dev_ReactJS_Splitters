# Stack NexaView para Portainer e Docker Hub

## 📋 Sobre esta Stack

`docker-compose.stack.yml` é a stack pronta para usar no **Portainer** com **imagens do Docker Hub**.

### ✨ Características

- ✅ Usa variáveis de ambiente para todas as configurações
- ✅ Suporta imagens do Docker Hub
- ✅ Health checks automáticos
- ✅ Restart policies robustas
- ✅ Network isolada
- ✅ Labels para gerenciamento no Portainer
- ✅ Pronto para produção

---

## 📦 Pré-requisitos

### 1. **Publicar Imagens no Docker Hub**

Primeiro, você precisa publicar as imagens no Docker Hub:

```bash
# Login no Docker Hub
docker login

# Build backend
cd server
docker build -t seu-usuario/nexaview-backend:latest .
docker push seu-usuario/nexaview-backend:latest

# Build frontend
cd ..
docker build -f Dockerfile.frontend -t seu-usuario/nexaview-frontend:latest .
docker push seu-usuario/nexaview-frontend:latest
```

### 2. **Copiar a Stack**

Copie o conteúdo de `docker-compose.stack.yml` ou acesse a URL raw no GitHub.

---

## 🚀 Como usar no Portainer

### **Método 1: Via Portainer UI**

1. Acesse **Portainer Web UI** → **Stacks**
2. Clique em **+ Add Stack**
3. Cole o conteúdo de `docker-compose.stack.yml`
4. Na seção **Environment Variables**, adicione:

```
BACKEND_IMAGE=seu-usuario/nexaview-backend:latest
FRONTEND_IMAGE=seu-usuario/nexaview-frontend:latest
MASSIVA_MYSQL_HOST=10.0.11.171
MASSIVA_MYSQL_USER=DevSebratel
MASSIVA_MYSQL_PASSWORD=DevBI*24
```

5. Clique em **Deploy**

### **Método 2: Via API/CLI**

```bash
# Usando curl para fazer deploy direto
curl -X POST http://portainer-url/api/stacks \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d @- << EOF
{
  "Name": "nexaview",
  "StackFileContent": "$(cat docker-compose.stack.yml | jq -R -s .)"
}
EOF
```

---

## 🔧 Variáveis de Ambiente Disponíveis

### Backend

| Variável | Padrão | Descrição |
|----------|--------|-----------|
| `BACKEND_IMAGE` | `node:22-alpine` | Imagem Docker do backend |
| `MASSIVA_MYSQL_HOST` | `10.0.11.171` | Host MySQL |
| `MASSIVA_MYSQL_DATABASE` | `DB_Massives` | Banco de dados |
| `MASSIVA_MYSQL_USER` | `DevSebratel` | Usuário MySQL |
| `MASSIVA_MYSQL_PASSWORD` | `DevBI*24` | Senha MySQL |
| `DB_HOST` | (vazio) | PostgreSQL host (opcional) |
| `DB_USER` | (vazio) | PostgreSQL user (opcional) |
| `DB_PASSWORD` | (vazio) | PostgreSQL password (opcional) |

### Frontend

| Variável | Padrão | Descrição |
|----------|--------|-----------|
| `FRONTEND_IMAGE` | `node:22-alpine` | Imagem Docker do frontend |
| `VITE_LOCAL_BFF_URL` | (vazio) | Mesmo host e porta do browser (`/api` via Nginx dentro do container frontend) |
| `VITE_GOOGLE_CLIENT_ID` | (vazio) | Google OAuth Client ID |
| `VITE_GOOGLE_REDIRECT_URI` | (vazio) | Google OAuth Redirect URI |

### APIs Externas

| Variável | Padrão | Descrição |
|----------|--------|-----------|
| `VITE_GEOGRID_API_KEY` | (vazio) | Chave GeoGrid |
| `AUTOISP_PASSWORD` | (vazio) | Senha AutoISP |

---

## 📊 Comandos Úteis no Portainer

### Ver logs
```bash
docker logs -f nexaview-backend
docker logs -f nexaview-frontend
```

### Verificar saúde
```bash
# App (porta no host: FRONTEND_PORT, predefinido 3177 em docker-compose.portainer.yml)
curl -sI http://seu-servidor:3177/

# Backend (rede Docker; ou descomente `ports` no compose para testar no host)
docker exec react-backend-portainer wget -qO- http://127.0.0.1:3001/api/health
```

### Entrar no container
```bash
docker exec -it nexaview-backend sh
docker exec -it nexaview-frontend sh
```

### Remover stack
```bash
docker-compose -f docker-compose.stack.yml down
```

---

## 🔐 Segurança em Produção

### Recomendações

1. **Use secrets do Portainer** para credenciais sensíveis
   - `MASSIVA_MYSQL_PASSWORD`
   - `AUTOISP_PASSWORD`
   - `ERP_CLIENT_SECRET`
   - `VITE_GOOGLE_CLIENT_ID`

2. **Configure HTTPS/TLS**
   - Use Nginx ou Traefik como reverse proxy
   - Configure certificados SSL

3. **Use um Registry Privado**
   - Docker Hub privado ou Harbor
   - Adicione autenticação no Portainer

4. **Resource Limits**
   - Descomente `deploy.resources` no arquivo
   - CPU: 1 core, Memory: 1GB para backend
   - CPU: 0.5 core, Memory: 512MB para frontend

5. **Network Policies**
   - Configure firewall para permitir apenas portas 3001 e 5173
   - Use `internal: true` se não precisar expor a rede

---

## 📝 Exemplo Completo de Deployment

```yaml
# Variáveis de Ambiente no Portainer
BACKEND_IMAGE=seu-usuario/nexaview-backend:v1.0.0
FRONTEND_IMAGE=seu-usuario/nexaview-frontend:v1.0.0
MASSIVA_MYSQL_HOST=mysql.producao.internal
MASSIVA_MYSQL_PASSWORD=senha-super-segura-aqui
DB_HOST=postgres.producao.internal
DB_USER=user_nexaview
DB_PASSWORD=pass-segura-postgres
VITE_GOOGLE_CLIENT_ID=seu-client-id-aqui
VITE_GOOGLE_REDIRECT_URI=https://app.seudomain.com/callback
AUTOISP_PASSWORD=senha-autoisp
```

---

## 🆘 Troubleshooting

### Container não inicia

```bash
# Ver logs
docker logs nexaview-backend

# Se disser "connection refused" no MySQL
# Verifique: MASSIVA_MYSQL_HOST, MASSIVA_MYSQL_USER, MASSIVA_MYSQL_PASSWORD
```

### Health check failing

```bash
# Dar mais tempo de startup
# Aumentar start_period em healthcheck

# Ou verificar se o serviço está realmente up
docker exec nexaview-backend wget -q -O- http://localhost:3001/api/health
```

### Frontend não consegue conectar ao backend

```bash
# Verificar rede Docker
docker network ls
docker network inspect nexaview-network

# Verificar conectividade
docker exec nexaview-frontend wget -q -O- http://backend:3001/api/health
```

---

## 📚 Links Úteis

- [Docker Hub](https://hub.docker.com)
- [Portainer Docs](https://docs.portainer.io)
- [Docker Compose Reference](https://docs.docker.com/compose/reference/)
- [Health Check Best Practices](https://docs.docker.com/reference/dockerfile/#healthcheck)

---

## ✅ Checklist Pré-Deployment

- [ ] Imagens publicadas no Docker Hub
- [ ] Variáveis de ambiente validadas
- [ ] MySQL remoto acessível
- [ ] APIs externas configuradas
- [ ] Certificados SSL (se usar HTTPS)
- [ ] Backups do banco de dados configurados
- [ ] Logs centralizados (opcional)
- [ ] Monitoramento ativo (Datadog, New Relic, etc.)

---

## 🎉 Pronto para Produção!

Sua aplicação NexaView está pronta para rodar em produção no Portainer com imagens do Docker Hub.