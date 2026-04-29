# Habilidades Sociales 3D — Constelación de Conflictos

Aplicación web interactiva que visualiza el ecosistema de habilidades sociales, emociones, estrategias y escenarios de conflicto como una constelación tridimensional. Cada nodo representa un concepto clave del entrenamiento en inteligencia emocional y resolución de conflictos. Al hacer clic en un personaje, puedes practicar conversaciones reales con él mediante la API de Gemini.

## Tema del Proyecto

**Aplicación para el entrenamiento de habilidades sociales, control de emociones y manejo de conflictos.**

Integrantes:
- Serrano Arostegui, Edy Saul
- Luna Jaramillo, Christian Giovanni
- Osorio Tello, Diego Jesus

## Características

- **Visualización 3D interactiva**: Espiral temporal con 15 nodos en 4 categorías
- **6 personajes entrenables**: Practica con NPCs que simulan conflictos reales (gerente, compañero, familiar, desconocido) y coaches de habilidades (empatía, asertividad, escucha activa)
- **11 conexiones causales**: Muestra relaciones entre emociones, estrategias, habilidades y escenarios
- **Chat contextual con LLM**: Cada personaje responde de forma dinámica y adapta su actitud a tus respuestas
- **Filtros y búsqueda**: Explora por categoría o busca cualquier concepto
- **Navegación orbital**: Rota, haz zoom y explora la constelación en 3D

## Categorías de nodos

| Color | Categoría | Nodos |
|-------|-----------|-------|
| 🔴 Rojo | Escenarios de Conflicto | Laboral, Escolar, Familiar, Público, Digital |
| 🔵 Azul | Habilidades Sociales | Empatía, Asertividad, Escucha Activa, Com. No Violenta |
| 🟠 Naranja | Emociones | Ira, Frustración, Ansiedad Social, Tristeza |
| 🟢 Verde | Estrategias | Respiración Consciente, Reformulación Cognitiva |

## Personajes para practicar

1. **El Gerente Iracundo** — Conflicto de autoridad laboral (máxima dificultad)
2. **El Compañero Hostil** — Exclusión y condescendencia en trabajo grupal
3. **El Familiar Distante** — Resentimiento acumulado en el hogar
4. **El Extraño Agresivo** — Confrontación imprevista en espacio público
5. **El Entrenador de Empatía** — Coach socrático de perspectiva social
6. **El Mentor de Asertividad** — Guía práctica con roleplay de Yo-mensajes
7. **El Entrenador de Escucha Activa** — Coach de parafraseo y validación

## Tecnologías

- **Three.js**: Renderizado 3D con WebGL
- **Google Gemini API** (`gemini-2.0-flash`): Respuestas contextuales de personajes
- **Vanilla JavaScript ES6+**: Módulos ES6 con import maps

## Estructura del Proyecto

```
proyecto-lab6/
  index.html          # Estructura principal y UI
  css/
    styles.css        # Estilos dark theme
  js/
    main.js           # Aplicación principal (Three.js + UI + lógica)
    data.js           # Datos de nodos y prompts de personajes
    llm-client.js     # Cliente para la API de Gemini
  README.md
```

## Configuración y ejecución

### 1. Obtener API Key de Gemini

1. Visita [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Genera una clave de API gratuita
3. Al abrir la aplicación, ingresa la key cuando se solicite (se guarda en localStorage)

### 2. Ejecutar la aplicación

**Opción 1: Python**
```bash
cd proyecto-lab6
python -m http.server 8000
# Abrir http://localhost:8000
```

**Opción 2: Node.js**
```bash
cd proyecto-lab6
npx serve
# Abrir http://localhost:3000
```

**Opción 3: VS Code**
Instala la extensión "Live Server" y haz clic en "Go Live".

## Integración Programática con LLM

### System Instructions Dinámicas

Cada personaje tiene un `prompt_personaje` que define su contexto, actitud, reglas de comportamiento y cómo escala o desescala según las respuestas del usuario. Se envía como `systemInstruction` en cada llamada a la API.

### Memoria de Conversación

La clase `LLMClient` mantiene un historial de mensajes (hasta 20 turnos) incluido en cada petición, permitiendo que el personaje recuerde el contexto y evolucione su actitud.

### Control de Temperatura

- `0.0`: Respuestas predecibles y consistentes (útil para evaluar el mismo prompt)
- `0.7`: Balance coherencia/variedad (default)
- `1.0–1.5`: Respuestas más creativas e impredecibles del personaje

## Ejemplo de uso del LLMClient

```javascript
import { LLMClient } from './llm-client.js';

const llm = new LLMClient('TU_API_KEY', 'gemini-2.0-flash');

const systemPrompt = `Eres el Gerente Iracundo. Acabas de llamar al usuario por errores en su informe...`;

const respuesta = await llm.chat(
    "Entiendo que hubo errores. Dame un día y los corrijo.",
    systemPrompt,
    0.7
);

console.log(respuesta);
// "Bien. Eso es lo que necesito escuchar. Para mañana al mediodía."
```

## Experimentación con Temperature

```javascript
const temperatures = [0.0, 0.5, 1.0, 1.5];
const prompt = "Entiendo que hubo errores, dame un día para corregirlos.";

for (const temp of temperatures) {
    const response = await llm.chatOneShot(prompt, gerentePrompt, temp);
    console.log(`Temperature ${temp}:`, response);
}
```
