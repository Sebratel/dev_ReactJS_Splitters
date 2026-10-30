#!/bin/sh
# Entrypoint do container nginx do frontend.
# Gera snippets condicionais e substitui variáveis no template antes de iniciar o nginx.
set -e

# ── 1. Basic Auth para o gateway (server-side, sem popup no browser) ──────────
GATEWAY_AUTH_CONF=/etc/nginx/conf.d/gateway-auth.conf

if [ -n "$GATEWAY_BASIC_AUTH_USER" ] && [ -n "$GATEWAY_BASIC_AUTH_PASSWORD" ]; then
  B64=$(printf '%s:%s' "$GATEWAY_BASIC_AUTH_USER" "$GATEWAY_BASIC_AUTH_PASSWORD" \
        | base64 | tr -d '\n')
  # Substitui Authorization pelo Basic e preserva o Bearer do usuário em X-Forwarded-Authorization.
  cat > "$GATEWAY_AUTH_CONF" <<EOF
proxy_set_header Authorization              "Basic $B64";
proxy_set_header X-Forwarded-Authorization \$http_authorization;
EOF
  echo "[entrypoint] Gateway Basic Auth configurado (usuario: $GATEWAY_BASIC_AUTH_USER)"
else
  # Sem credenciais: repassa Authorization original sem alteração.
  cat > "$GATEWAY_AUTH_CONF" <<'EOF'
proxy_set_header Authorization $http_authorization;
EOF
  echo "[entrypoint] Gateway sem Basic Auth"
fi

# ── 2. Proxy AutoISP (opcional) ───────────────────────────────────────────────
AUTOISP_CONF=/etc/nginx/conf.d/autoisp.conf

if [ -n "$AUTOISP_ORIGIN" ]; then
  AUTOISP_STRIPPED=$(echo "$AUTOISP_ORIGIN" | sed 's|/$||')
  cat > "$AUTOISP_CONF" <<EOF
location /__autoisp/ {
    proxy_pass            $AUTOISP_STRIPPED/;
    proxy_http_version    1.1;
    proxy_set_header      Host              \$proxy_host;
    proxy_set_header      X-Real-IP         \$remote_addr;
    proxy_set_header      X-Forwarded-For   \$proxy_add_x_forwarded_for;
    proxy_set_header      traceparent              "";
    proxy_set_header      tracestate               "";
    proxy_set_header      elastic-apm-traceparent  "";
    proxy_read_timeout    60s;
    proxy_connect_timeout 10s;
}
EOF
  echo "[entrypoint] Proxy AutoISP configurado: $AUTOISP_ORIGIN"
else
  # Arquivo vazio — include não falha com arquivo em branco.
  > "$AUTOISP_CONF"
fi

# ── 3. Exigir GATEWAY_ORIGIN (sem ele o nginx.conf gerado é inválido) ────────
if [ -z "$GATEWAY_ORIGIN" ]; then
  echo "[entrypoint] ERRO: GATEWAY_ORIGIN não definido (ex.: https://host-do-gateway). Container não iniciado." >&2
  exit 1
fi

# ── 4. Substituir variáveis no template principal ─────────────────────────────
envsubst '${BACKEND_ORIGIN} ${GATEWAY_ORIGIN}' \
  < /etc/nginx/nginx.conf.template > /etc/nginx/nginx.conf

echo "[entrypoint] nginx.conf gerado — BACKEND: ${BACKEND_ORIGIN:-n/a} | GATEWAY: ${GATEWAY_ORIGIN:-n/a}"

# ── 5. Validar config e iniciar nginx ─────────────────────────────────────────
nginx -t
exec nginx -g 'daemon off;'
