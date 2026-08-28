#!/bin/bash
set -e

WATCHDOG_API_URL="${WATCHDOG_API_URL:-https://watchdog.daztanllc.com}"
AGENT_API_URL="${AGENT_API_URL:-$WATCHDOG_API_URL/api}"
INSTALL_DIR="/usr/local/bin"
AGENT_BIN="watchdog-agent"
CONFIG_FILE="$HOME/.watchdog/config"

echo "╔════════════════════════════════════════╗"
echo "║     Watch-Dog Agent — Instalación     ║"
echo "╚════════════════════════════════════════╝"
echo ""

# Detectar OS y arquitectura
OS=$(uname -s | tr '[:upper:]' '[:lower:]')
ARCH=$(uname -m)

case "$ARCH" in
  x86_64) ARCH="amd64" ;;
  arm64|aarch64) ARCH="arm64" ;;
  *) echo "❌ Arquitectura no soportada: $ARCH"; exit 1 ;;
esac

case "$OS" in
  linux|darwin) ;;
  *) echo "❌ Sistema operativo no soportado: $OS"; exit 1 ;;
esac

echo "✓ Sistema detectado: ${OS}/${ARCH}"

# Pedir la API key si no está en el entorno
if [ -z "$WATCHDOG_KEY" ]; then
  echo ""
  echo "Ingresá la API key que copiaste desde Watch-Dog:"
  read -p "API Key: " WATCHDOG_KEY
fi

if [ -z "$WATCHDOG_KEY" ]; then
  echo "❌ La API key es requerida."
  exit 1
fi

# Guardar la key en un archivo de configuración permanente
echo "✓ Guardando configuración..."
mkdir -p "$HOME/.watchdog"
cat > "$CONFIG_FILE" << EOF
WATCHDOG_KEY=$WATCHDOG_KEY
AGENT_API_URL=$AGENT_API_URL
EOF
chmod 600 "$CONFIG_FILE"

# Descargar el binario# Descargar el binario
BINARY="agent-${OS}-${ARCH}"
GITHUB_REPO="Col-Trinity/monitoreo-recursos"
DOWNLOAD_URL="https://github.com/${GITHUB_REPO}/releases/latest/download/${BINARY}"
echo "✓ Descargando agente para ${OS}/${ARCH}..."
curl -sSL "$DOWNLOAD_URL" -o "/tmp/$AGENT_BIN"
chmod +x "/tmp/$AGENT_BIN"

echo "✓ Instalando en ${INSTALL_DIR}..."
sudo mv "/tmp/$AGENT_BIN" "${INSTALL_DIR}/${AGENT_BIN}"

# Matar instancia anterior si existe
pkill -f "$AGENT_BIN" 2>/dev/null || true

# Iniciar el agente leyendo la configuración
echo "✓ Iniciando el agente..."
source "$CONFIG_FILE"
WATCHDOG_KEY="$WATCHDOG_KEY" \
AGENT_API_URL="$AGENT_API_URL" \
nohup ${INSTALL_DIR}/${AGENT_BIN} > "$HOME/.watchdog/agent.log" 2>&1 &

echo ""
echo "╔════════════════════════════════════════╗"
echo "║   ✅ Watch-Dog Agent instalado!        ║"
echo "╚════════════════════════════════════════╝"
echo ""
echo "El agente está corriendo y mandando métricas."
echo "Para ver los logs: tail -f ~/.watchdog/agent.log"
echo ""
echo "Para que arranque automáticamente al reiniciar,"
echo "agregá esto a tu ~/.bashrc o ~/.zshrc:"
echo ""
echo "  pgrep -f watchdog-agent > /dev/null || (source ~/.watchdog/config && nohup watchdog-agent > ~/.watchdog/agent.log 2>&1 &)"
