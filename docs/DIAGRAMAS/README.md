# Diagramas

Diagramas del sistema **tal como quedó implementado** (6 nov 2026). Reemplazan las versiones de la ERS hechas antes de programar. Cada uno tiene su fuente (`.mmd` de Mermaid o `.dot` de Graphviz) y su imagen `.png` lista para la ERS o la presentación.

| Diagrama | Sección del ERS | Fuente | Imagen | Cómo se mantiene |
|---|---|---|---|---|
| Contexto | Rúbrica | `contexto.mmd` | `contexto.png` | A mano |
| Casos de uso (34 RF + 4 EXT) | 3.2 / rúbrica | `casos-de-uso.dot` | `casos-de-uso.png` | A mano |
| Entidades de la base de datos (14 tablas) | 3.4 | `entidades.mmd` | `entidades.png` | **Generado** desde `database/migrations` |
| Arquitectura en 3 capas | 3.7.1 | `arquitectura.mmd` | `arquitectura.png` | A mano |
| Clases | 3.7.2 | `clases.mmd` | `clases.png` | **Generado** desde `database/migrations` |
| Estados de una cita | 3.7.3 | `estados-cita.mmd` | `estados-cita.png` | A mano |
| Colaboración para crear una cita (MCA-01) | 3.7.4 | `colaboracion-crear-cita.mmd` | `colaboracion-crear-cita.png` | A mano |
| Actividad para registrar una venta (MV-01) | 3.7.5 | `actividad-registrar-venta.mmd` | `actividad-registrar-venta.png` | A mano |

## Qué cambió respecto de la ERS

- **Entidades (3.4):** nombres finales de las 14 tablas y sus columnas (D-013), con llaves (PK, FK, UK), columnas opcionales y calculadas (`Venta.Codigo`, `Producto.Disponibilidad`). `RevisionVenta` es de la extensión EXT-MV-U01 (no está en el ERS). Coincide columna por columna con `DICCIONARIO_DATOS.md`.
- **Clases (3.7.2):** las mismas entidades como clases. Las llaves foráneas se dibujan como asociaciones con su multiplicidad (ERS 3.4.3), y cada operación indica el caso de uso que la implementa. Las líneas de detalle (`CitaServicio`, `VentaProducto`, `VentaServicio`, `RevisionVenta`) son composición: no existen sin su cita o su venta.
- **Arquitectura (3.7.1):** las tres capas con los archivos reales: páginas, `shared/api/cliente.js`, `rutas.js` con `requiereAdministradora`, módulos con `.rutas`, `.logica` y `.datos` (D-017) y SQL Server.
- **Estados de una cita (3.7.3):** se agregan los caminos de la administradora: crear Confirmada (MCA-12), reprogramar sin solicitud (MCA-13), cancelar con motivo (MCA-14) y completar (MCA-07).
- **Colaboración (3.7.4):** se dibuja como diagrama de secuencia, que muestra la misma colaboración con el orden de los mensajes. Incluye la transacción con el bloqueo `agenda` y la segunda verificación del horario.
- **Actividad (3.7.5):** la transacción del servidor con `Stock >= cantidad`, «Cantidad insuficiente» y la reversión ante errores.
- **Casos de uso:** las extensiones (EXT) llevan borde punteado para no confundirlas con requisitos del ERS.

## Cómo volver a generarlos

Si cambia una migración, regenerar entidades y clases:

```powershell
npm run docs:diagramas
```

Para pasar las fuentes a imágenes se necesita Mermaid CLI (`npm i -g @mermaid-js/mermaid-cli`) y Graphviz:

```powershell
cd docs/DIAGRAMAS
mmdc -i entidades.mmd -o entidades.png -s 2 -b white      # igual para cada .mmd
dot -Tpng -Gdpi=130 casos-de-uso.dot -o casos-de-uso.png
```

GitHub muestra los `.mmd` directamente si se copian dentro de un bloque ` ```mermaid ` en un archivo `.md`.

## Para la ERS en Confluence

La página «Diagramas de la ERS» del espacio SA indica que, para reemplazar un diagrama, se sube una nueva versión del archivo adjunto **con el mismo nombre**, y se actualiza en las secciones 3.4 y 3.7. Las imágenes de esta carpeta están listas para eso.
