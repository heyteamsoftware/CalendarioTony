# -*- coding: utf-8 -*-
"""Construye web/data/curiosidades.json a partir de tools/curiosidades/*.txt.

Cada fichero .txt lleva una curiosidad por línea. Se ignoran las líneas vacías y
las que empiezan por '#'. El script avisa de duplicados (exactos o casi
idénticos) y de textos demasiado largos para el bocadillo, y no los incluye.

Uso: python tools/build_curiosidades.py
"""
import json
import re
import sys
import unicodedata
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
ORIGEN = RAIZ / "tools" / "curiosidades"
DESTINO = RAIZ / "web" / "data" / "curiosidades.json"
MAX_CARACTERES = 200


def clave(texto):
    """Normaliza para detectar duplicados: sin tildes, mayúsculas ni signos."""
    t = unicodedata.normalize("NFD", texto.lower())
    t = "".join(c for c in t if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z0-9]+", " ", t).strip()


def main():
    vistos = {}
    resultado = []
    avisos = 0
    for fichero in sorted(ORIGEN.glob("*.txt")):
        n_fichero = 0
        for n, linea in enumerate(fichero.read_text(encoding="utf-8").splitlines(), 1):
            texto = linea.strip()
            if not texto or texto.startswith("#"):
                continue
            if len(texto) > MAX_CARACTERES:
                print(f"LARGA ({len(texto)}) {fichero.name}:{n}: {texto[:60]}...")
                avisos += 1
                continue
            k = clave(texto)
            if k in vistos:
                print(f"DUPLICADA {fichero.name}:{n} (ya en {vistos[k]}): {texto[:60]}...")
                avisos += 1
                continue
            vistos[k] = fichero.name
            resultado.append(texto)
            n_fichero += 1
        print(f"{fichero.name:34s} {n_fichero:5d}")

    DESTINO.parent.mkdir(parents=True, exist_ok=True)
    DESTINO.write_text(json.dumps(resultado, ensure_ascii=False, indent=0) + "\n", encoding="utf-8")
    print(f"\nTotal: {len(resultado)} curiosidades -> {DESTINO.relative_to(RAIZ)} "
          f"({DESTINO.stat().st_size // 1024} KB), {avisos} avisos")
    return 0


if __name__ == "__main__":
    sys.exit(main())
