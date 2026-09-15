# Investigación de assets públicos — Personaje ingeniero V3

Objetivo: construir un protagonista industrial estilizado, compatible con navegador, modificable y sin dependencia de licencias restrictivas.

## Fuentes revisadas

### 1. Quaternius — Universal Base Characters
- Repositorio de referencia: `programasweights/avatar`
- Asset documentado: `public/assets/character.glb`
- Base original: Quaternius Universal Base Characters — Standard
- Licencia del personaje: CC0 1.0 Universal
- Ventajas: cuerpo humanoide editable, armature completo, manos articuladas y pipeline reproducible en Blender.
- Uso recomendado para una futura versión de mayor fidelidad: generar uniforme EI, chaleco, casco y accesorios sobre el mismo armature.

### 2. Quaternius — Universal Animation Library
- Repositorio: `J-Ponzo/gltf-universal-animation-library`
- Licencia: CC0 1.0
- Ventajas: biblioteca de locomoción reutilizable y legalmente simple para un personaje corporativo distribuido por web.
- Uso recomendado: caminar, correr, idle, interacción y gestos de NPC en una versión con rig Quaternius.

### 3. Kenney asset mirrors / collections
- Repositorios revisados: `ETdoFresh/kenney.nl`, `iwenzhou/kenney`, `eturner58/game-assets`, `series-ai/jam-ready-assets`
- Licencia predominante para Kenney: CC0 1.0
- Fortalezas: props, UI, iconografía, señales, audio y kits 3D.
- Uso recomendado: complementar estaciones, señalética, mobiliario industrial estilizado y feedback de interfaz.

### 4. Repositorios de referencia con pipelines reproducibles
- `programasweights/avatar`: demuestra cómo tomar una base Quaternius CC0 y construir vestuario propio conservando armature y skin weights.
- `ChilyerStudiosLLC/blender-character-pipeline`: documenta un pipeline para vestuario sobre Universal Base Characters.
- `Seyamalam/blood-league-kickoff`: documenta procedencia, hashes y conversión de Quaternius Base Characters + Universal Animation Library.
- `ilrein/warptracker`: recomienda Quaternius/Kenney/procedural y evita redistribuir Mixamo por restricciones de licencia.

## Decisión para V3.1

Para corregir de inmediato la identidad visual sin introducir un nuevo rig externo antes de probar el gameplay, el protagonista V3.1 se construye proceduralmente en Three.js con estética low-poly/Roblox-like:

- casco de seguridad amarillo;
- gafas de seguridad;
- camisa azul industrial;
- chaleco reflectivo amarillo con franjas;
- botas de seguridad;
- cinturón y bolsillos de herramientas;
- credencial EI;
- tablet de trabajo;
- color de equipo configurable;
- animación procedural de idle, caminar, correr e interacción.

Esto elimina por completo el aspecto medieval del protagonista y mantiene control total de proporciones, colores y animación.

## Ruta recomendada para V4

1. Tomar Quaternius Universal Base Character CC0 como cuerpo humanoide.
2. Modelar en Blender un uniforme EI original sobre el mismo armature.
3. Crear variantes de casco, chaleco, camisa y pantalón por especialización.
4. Retarget o integrar Universal Animation Library CC0.
5. Exportar un GLB optimizado con texturas WebP/KTX2 y LOD.
6. Conservar un archivo de procedencia/licencias y hashes de cada asset.

## Fuentes

- https://github.com/programasweights/avatar
- https://github.com/J-Ponzo/gltf-universal-animation-library
- https://github.com/ETdoFresh/kenney.nl
- https://github.com/iwenzhou/kenney
- https://github.com/eturner58/game-assets
- https://github.com/series-ai/jam-ready-assets
- https://github.com/ChilyerStudiosLLC/blender-character-pipeline
- https://github.com/Seyamalam/blood-league-kickoff
- https://github.com/ilrein/warptracker
