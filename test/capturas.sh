#!/bin/bash
# Hace las capturas de las tiendas para una app: bash capturas.sh <carpeta-web> <pasos.mjs> <carpeta-store>
# Tamaños: Google Play 1080x2160, iPhone 6,9" 1320x2868 e iPhone 6,3" 1206x2622 (sin transparencia, como pide Apple).
set -e
WEB=$1; PASOS=$2; STORE=$3
DIR=$(cd "$(dirname "$0")" && pwd)
for t in "android:360x720x3" "iphone-6.9:440x956x3" "iphone-6.3:402x874x3"; do
  nombre=${t%%:*}; tam=${t#*:}
  rm -rf "/tmp/capt-$nombre" && mkdir -p "$STORE/capturas/$nombre"
  NATIVO=1 TAMANO=$tam node "$DIR/probar.mjs" "$WEB" "$PASOS" "/tmp/capt-$nombre" | grep -v -E "agent-proxy|connect_rejected" || true
  python3 - "$nombre" "$STORE/capturas/$nombre" <<'PY'
import sys, glob, os
from PIL import Image
nombre, dest = sys.argv[1], sys.argv[2]
for f in sorted(glob.glob(f'/tmp/capt-{nombre}/*.png')):
    Image.open(f).convert('RGB').save(os.path.join(dest, os.path.basename(f)), optimize=True)
print(nombre, len(glob.glob(dest + '/*.png')), 'capturas', Image.open(sorted(glob.glob(dest + '/*.png'))[0]).size)
PY
done
