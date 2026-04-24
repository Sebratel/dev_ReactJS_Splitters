# Script para publicar imagens NexaView no Docker Hub (Windows PowerShell)
#
# Uso:
#   .\publish-to-docker-hub.ps1 -User seu-usuario -Tag latest
#   .\publish-to-docker-hub.ps1 -User seu-usuario -Tag v1.0.0
#
# Exemplos:
#   .\publish-to-docker-hub.ps1 -User meunome -Tag latest
#   .\publish-to-docker-hub.ps1 -User meunome -Tag v1.0.0

param(
    [Parameter(Mandatory=$true)]
    [string]$User,
    
    [Parameter(Mandatory=$true)]
    [string]$Tag,
    
    [string]$Registry = "docker.io"
)

function Write-Header {
    param([string]$Message)
    Write-Host ""
    Write-Host "=========================================" -ForegroundColor Cyan
    Write-Host $Message -ForegroundColor Cyan
    Write-Host "=========================================" -ForegroundColor Cyan
}

function Write-Status {
    param(
        [string]$Message,
        [ValidateSet("Info", "Success", "Error", "Warning")]
        [string]$Type = "Info"
    )
    
    $Colors = @{
        "Info"    = "White"
        "Success" = "Green"
        "Error"   = "Red"
        "Warning" = "Yellow"
    }
    
    $Symbols = @{
        "Info"    = "ℹ️"
        "Success" = "✅"
        "Error"   = "❌"
        "Warning" = "⚠️"
    }
    
    Write-Host "$($Symbols[$Type]) $Message" -ForegroundColor $Colors[$Type]
}

Write-Header "Publicando NexaView no Docker Hub"

Write-Host "Docker User: $User" -ForegroundColor Yellow
Write-Host "Tag: $Tag" -ForegroundColor Yellow
Write-Host "Registry: $Registry" -ForegroundColor Yellow
Write-Host ""

# Login no Docker Hub
Write-Status "Fazendo login no Docker Hub..." "Info"
docker login -u $User

if ($LASTEXITCODE -ne 0) {
    Write-Status "Erro ao fazer login no Docker Hub" "Error"
    exit 1
}

Write-Status "Login realizado com sucesso" "Success"

# Backend
Write-Status "Buildando backend..." "Info"
Push-Location server

docker build -t "$User/nexaview-backend:$Tag" -t "$User/nexaview-backend:latest" .

if ($LASTEXITCODE -ne 0) {
    Write-Status "Erro ao buildar backend" "Error"
    Pop-Location
    exit 1
}

Write-Status "Backend buildado: $User/nexaview-backend:$Tag" "Success"

Write-Status "Fazendo push do backend (tag: $Tag)..." "Info"
docker push "$User/nexaview-backend:$Tag"

if ($LASTEXITCODE -ne 0) {
    Write-Status "Erro ao fazer push do backend ($Tag)" "Error"
    Pop-Location
    exit 1
}

Write-Status "Push realizado para $User/nexaview-backend:$Tag" "Success"

Write-Status "Fazendo push do backend (tag: latest)..." "Info"
docker push "$User/nexaview-backend:latest"

if ($LASTEXITCODE -ne 0) {
    Write-Status "Erro ao fazer push do backend (latest)" "Error"
    Pop-Location
    exit 1
}

Write-Status "Push realizado para $User/nexaview-backend:latest" "Success"

# Frontend
Pop-Location

Write-Status "Buildando frontend..." "Info"

docker build -f Dockerfile.frontend -t "$User/nexaview-frontend:$Tag" -t "$User/nexaview-frontend:latest" .

if ($LASTEXITCODE -ne 0) {
    Write-Status "Erro ao buildar frontend" "Error"
    exit 1
}

Write-Status "Frontend buildado: $User/nexaview-frontend:$Tag" "Success"

Write-Status "Fazendo push do frontend (tag: $Tag)..." "Info"
docker push "$User/nexaview-frontend:$Tag"

if ($LASTEXITCODE -ne 0) {
    Write-Status "Erro ao fazer push do frontend ($Tag)" "Error"
    exit 1
}

Write-Status "Push realizado para $User/nexaview-frontend:$Tag" "Success"

Write-Status "Fazendo push do frontend (tag: latest)..." "Info"
docker push "$User/nexaview-frontend:latest"

if ($LASTEXITCODE -ne 0) {
    Write-Status "Erro ao fazer push do frontend (latest)" "Error"
    exit 1
}

Write-Status "Push realizado para $User/nexaview-frontend:latest" "Success"

# Resumo
Write-Header "Publicação Concluída com Sucesso!"

Write-Host ""
Write-Host "Próximos passos:" -ForegroundColor Cyan
Write-Host "1. Acesse Portainer" -ForegroundColor White
Write-Host "2. Vá para Stacks → Add Stack" -ForegroundColor White
Write-Host "3. Cole o conteúdo de docker-compose.stack.yml" -ForegroundColor White
Write-Host "4. Configure as variáveis de ambiente:" -ForegroundColor White
Write-Host "   BACKEND_IMAGE=$User/nexaview-backend:$Tag" -ForegroundColor Gray
Write-Host "   FRONTEND_IMAGE=$User/nexaview-frontend:$Tag" -ForegroundColor Gray
Write-Host "5. Deploy!" -ForegroundColor White

Write-Host ""
Write-Host "Imagens disponíveis em: https://hub.docker.com/u/$User/" -ForegroundColor Green
Write-Host ""
