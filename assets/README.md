# assets/

## `demo.gif`

El demo GIF **no está incluido en el repo**: agregá tu grabación real como `assets/demo.gif` antes de
publicar. Mientras el archivo no exista, los README no lo referencian.

De esa misma grabación sale la miniatura del Project Card de Qollab (`qollab/thumbnail.png`): un frame
16:9 legible.

**Qué grabar (~10 s):** un turno normal del juego —

1. el reparto inicial, o el `Robar`,
2. aplicar una puerta (`H`) a una carta cuántica (se ve cómo cambia la probabilidad),
3. arrastrar una carta al descarte,
4. la **animación de medición** (barrido → colapso → resultado).

**Cómo grabar**

- **macOS:** `Cmd+Shift+5` → *Grabar selección* → guardar. Convertí a GIF con
  [`gifski`](https://gif.ski/) (`gifski --fps 20 entry.mov -o assets/demo.gif`) o `ffmpeg`:
  ```bash
  ffmpeg -i entry.mov -vf "fps=20,scale=960:-1" assets/demo.gif
  ```
- **Linux/Windows:** OBS o ScreenToGif, y exportá a GIF.

**Tips**

- Levantá el juego con `node front/qards/dev-server.mjs` y abrí <http://localhost:8000>.
- Ventana de ~1200×800; el tablero entra completo.
- Mantené el GIF **por debajo de ~5 MB** para que GitHub lo cargue rápido.
- Si no querés usar GIF, podés poner un `demo.png` y ajustar el `README.md`.
