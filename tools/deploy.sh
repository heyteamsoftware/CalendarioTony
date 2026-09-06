#!/usr/bin/env bash
# Sube el contenido de web/ a la carpeta "calendario" del FTP de paneltony.gt.tc
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# Credenciales en tools/deploy.env (ignorado por git, nunca se sube al repo).
# Copia tools/deploy.env.example para crear el tuyo.
source "$SCRIPT_DIR/deploy.env"
LOCAL_DIR="$(cd "$SCRIPT_DIR/../web" && pwd)"

cd "$LOCAL_DIR"

# Estos dos ficheros son la base de datos en vivo (eventos manuales y ediciones
# guardadas desde admin.html). Nunca se suben: si se sobrescribieran con las
# plantillas vacías del repo local, se perderían todos los cambios ya guardados.
EXCLUIR="api/manual_events.json api/overrides.json"

find . -type f | while read -r f; do
  rel="${f#./}"
  for skip in $EXCLUIR; do
    if [ "$rel" = "$skip" ]; then continue 2; fi
  done
  echo "Subiendo $rel"
  curl -s --ftp-create-dirs -u "$USER:$PASS" \
    -T "$rel" "ftp://$HOST/$REMOTE_DIR/$rel"
done
echo "(omitidos, son datos en vivo del servidor: $EXCLUIR)"

echo "Listo."
