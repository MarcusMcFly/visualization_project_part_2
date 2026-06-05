# Movement and Mental Health in Children — Visualización de datos (Parte II)

Práctica universitaria realizada como parte de la asignatura "Visualización de Datos" del Máster Universitario en Ciencia de Datos de la UOC.

Proyecto público: https://marcusmcfly.github.io/Visual_analytics_storytelling/

Visualización interactiva de la relación entre **actividad física** (Apple Watch Series 7) y
**salud mental infantil** (cuestionarios SDQ y SNAP-IV), basada en el dataset
*[Movement and Mental Health in Children](https://zenodo.org/records/14875672)* (Zenodo, 2024).

La justificación y selección del dataset están en `docs/part_1.docx` (**Parte I**).

## Arquitectura (dos capas)

Los datos crudos pesan **~2,73 GB** y no pueden servirse desde GitHub Pages, así que el proyecto
se separa en:

1. **ETL offline (Python / notebooks)** — lee `datasets/raw/`, agrega y exporta **JSON ligeros** a `docs/data/`.
2. **Web estática (HTML/CSS/JS)** — en `docs/`, consume esos JSON con Plotly.js + D3.js.
   Se publica en **GitHub Pages** (rama `main`, carpeta `/docs`).

```
notebooks/   01_eda · 02_etl_demographic · 03_etl_movement · 04_analysis
src/         etl_utils.py (helpers de lectura y scoring)
docs/        index.html · css/ · js/ · data/*.json   ← raíz de GitHub Pages
datasets/raw # 84 CSV — NO versionado (.gitignore)
```

## Puesta en marcha

```bash
python -m venv .venv
# Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

1. Coloca los CSV del dataset en `datasets/raw/`.
2. Ejecuta los notebooks en orden (`01` → `04`); generan `docs/data/*.json`.
3. Sirve la web en local:
   ```bash
   cd docs && python -m http.server 8000
   ```
   y abre <http://localhost:8000>.

## Objetivos de visualización (Parte I)

- **A** · Perfilado psicométrico (SDQ / SNAP-IV)
- **B** · Fenotipos de movimiento (pasos, sedentarismo, ritmo circadiano)
- **C** · Relación movimiento ↔ salud mental (correlaciones)
- **D** · Segmentación de perfiles (clustering)
- **E** · Dinámica temporal (intradía, laborable vs. finde)

## Notas sobre los datos

- `{ID}_T.csv` = actividad agregada por hora (delimitador `;`); `{ID}_F.csv` = fragmentos (delimitador `,`).
- Falta el ítem `SDQ19` y la columna `age` → se tratan como ausentes.

## Licencia y atribución del dataset

El conjunto de datos original se publica bajo licencia
**[Creative Commons Attribution 4.0 International (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/)**.

Esto significa que cualquiera es libre de **compartir** (copiar y redistribuir) y **adaptar**
(transformar y construir a partir de) los datos, incluso con fines comerciales, siempre que se
**atribuya** correctamente la autoría, se indique si se han hecho cambios y se enlace a la licencia.
Bajo esta licencia, **redistribuir públicamente** los datos derivados de este proyecto (los JSON
preagregados en `docs/data/`) es legítimo siempre que se mantenga la atribución que figura a continuación.

> **Atribución requerida (CC BY 4.0):**
> W. Lin, *“Movement and Mental Health in Children”*. Zenodo, v1, diciembre de 2024.
> DOI: [10.5281/zenodo.14875672](https://doi.org/10.5281/zenodo.14875672) ·
> <https://zenodo.org/records/14875672>

Los datos están **anonimizados** (los participantes se identifican con códigos como `H1`, `W4`…,
sin datos personales directos), por lo que su publicación abierta no plantea problemas adicionales
de privacidad más allá de mantener la atribución exigida por la licencia.
