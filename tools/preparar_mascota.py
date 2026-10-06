# -*- coding: utf-8 -*-
"""Corta la mascota (tools/mascota/original.png, PNG con transparencia) en tres
piezas para poder animar el paseo con CSS: torso y dos piernas.

Las coordenadas son las del recuadro que envuelve a la figura (bbox de alfa):
  torso      -> hasta justo debajo del bajo del pantalón
  pierna izq -> pie izquierdo (se solapa unos píxeles bajo el torso)
  pierna der -> pie derecho

Uso: python tools/preparar_mascota.py
"""
from pathlib import Path
from PIL import Image

RAIZ = Path(__file__).resolve().parent.parent
ORIGEN = RAIZ / "tools" / "mascota" / "original.png"
DESTINO = RAIZ / "web" / "img" / "mascota"

# Cortes en coordenadas de la imagen original (x0, y0, x1, y1; x1/y1 exclusivos)
TORSO_Y_FIN = 515          # el torso incluye el pantalón y el arranque de las piernas
PIERNA_Y_INI = 509         # las piernas empiezan 6 px por encima para solaparse
CENTRO_X = 177             # hueco entre las dos piernas
PIERNA_IZQ_X0 = 60
PIERNA_DER_X1 = 292

def main():
    im = Image.open(ORIGEN).convert("RGBA")
    x0, y0, x1, y1 = im.getchannel("A").getbbox()
    print("bbox figura:", (x0, y0, x1, y1), "->", x1 - x0, "x", y1 - y0)
    DESTINO.mkdir(parents=True, exist_ok=True)

    piezas = {
        "torso.png": (x0, y0, x1, TORSO_Y_FIN),
        "pierna-izq.png": (PIERNA_IZQ_X0, PIERNA_Y_INI, CENTRO_X, y1),
        "pierna-der.png": (CENTRO_X, PIERNA_Y_INI, PIERNA_DER_X1, y1),
    }
    for nombre, caja in piezas.items():
        pieza = im.crop(caja)
        pieza.save(DESTINO / nombre, optimize=True)
        # posición de la pieza dentro del recuadro de la figura
        print(f"{nombre:16s} tamaño {pieza.width}x{pieza.height}  "
              f"left={caja[0] - x0} top={caja[1] - y0}")

if __name__ == "__main__":
    main()
