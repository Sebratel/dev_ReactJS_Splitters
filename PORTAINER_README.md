# Docker Compose para Portainer

## Problema Resolvido

O arquivo `docker-compose.yml` original usa `env_file: - .env.local`, mas o Portainer não consegue acessar arquivos locais fora do contexto do stack. Este arquivo `docker-compose.portainer.yml` incorpora as variáveis essenciais diretamente no arquivo.

## Como usar no Portainer

### 1. **Faça upload do arquivo correto**

No Portainer, faça upload do **`docker-compose.portainer.yml`** (não o `docker-compose.yml` original).

### 2. **Configure variáveis de ambiente sensíveis (opcional)**

Se precisar das credenciais mais sensíveis, configure-as como **Environment Variables** no Portainer:

```
ERP_CLIENT_ID=ad0c5d9a-fad1-4ca9-8d1e-cff2cedb3146
ERP_CLIENT_SECRET=cb53bd13-5305-4306-b03b-b00cf05f2e34
ERP_SYNDATA=TWpNMU9EYzVaakk1T0dSaU1USmxaalprWldFd00ySTFZV1JsTTJRMFptUT06...
MASSIVA_COOKIE_STRING=_hjSessionUser_5073910=...
VITE_DEV_SESSION_TOKEN=eyJhbGciOiJSUzI1NiIsImtpZCI6ImIzZDk1Yjk1ZmE0OGQxODBiODVmZmU4MDgyZmNmYTIxNzRiMDQ2Njci...
```

### 3. **Deploy no Portainer**

O stack deve iniciar sem erros agora! ✅

## O que foi incorporado

### Backend
- ✅ Conexão MySQL remoto (`10.0.11.171`)
- ✅ APIs externas (GeoGrid, Hub, AutoISP)
- ✅ Configurações de massiva

### Frontend
- ✅ URL do backend (`http://backend:3001`)
- ✅ APIs para browser (VITE_*)
- ✅ Configurações Google OAuth
- ✅ Configurações de desenvolvimento

## Arquivos necessários

Para o Portainer, você só precisa fazer upload do:
- `docker-compose.portainer.yml`

Os Dockerfiles (`Dockerfile.frontend` e `server/Dockerfile`) serão baixados automaticamente durante o build.

## Troubleshooting

### Se ainda der erro de build

Certifique-se de que os arquivos estão no repositório Git ou disponíveis para o Portainer:

1. **Build context**: O Portainer precisa acessar `./server` e `./` (raiz)
2. **Dockerfiles**: `Dockerfile.frontend` e `server/Dockerfile` devem existir

### Verificar logs

```bash
# No Portainer, veja os logs dos containers
docker logs nexaview-backend
docker logs nexaview-frontend
```

### Health check

Acesse: http://seu-servidor:3001/api/health

---

## Desenvolvimento Local

Para desenvolvimento local (fora do Portainer), continue usando:

```bash
# Usa .env.local
docker-compose up -d
```

Para Portainer, use sempre `docker-compose.portainer.yml`.