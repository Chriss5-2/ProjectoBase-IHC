# Constelaciones Históricas 3D

Aplicación web interactiva que visualiza eventos y personajes históricos como una constelación tridimensional. Cada personaje es un nodo luminoso en una espiral temporal, con conexiones causales que se revelan al acercar el zoom. Al interactuar con un personaje, puedes mantener una conversación contextual con él a través de la API de Gemini (Google AI).

## Características

- **Visualización 3D interactiva**: Espiral temporal con personajes históricos representados como nodos luminosos
- **13 personajes históricos**: Leonardo da Vinci, Galileo, Newton, Einstein, Marie Curie, y más
- **Conexiones causales**: Líneas que conectan eventos influenciados entre sí, visibles al acercar el zoom
- **Chat con personajes**: Conversa con figuras históricas mediante integración con Gemini API
- **Filtros y búsqueda**: Filtra por categoría o busca por nombre/año
- **Navegación orbital**: Rota, haz zoom y explora la constelación en 3D

## Tecnologías

- **Three.js**: Renderizado 3D con WebGL
- **D3.js**: Conceptos de visualización de datos
- **Google Gemini API**: Generación de respuestas conversacionales
- **Vanilla JavaScript (ES6+)**: Módulos ES6 con import maps

## Estructura del Proyecto

```
proyecto-ejemplo/
  index.html          # Estructura principal y UI
  css/
    styles.css        # Estilos dark theme
  js/
    main.js           # Aplicación principal (Three.js + UI)
    data.js           # Datos históricos y prompts de personajes
    llm-client.js     # Cliente para la API de Gemini
  README.md           # Este archivo
```

## Configuración

### 1. Obtener API Key de Gemini

1. Visita [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Genera una clave de API gratuita
3. Al abrir la aplicación, se te pedirá ingresar la key (se guarda en localStorage)

### 2. Ejecutar la aplicación

Como la aplicación usa ES6 modules con import maps, necesitas un servidor web local:

**Opción 1: Python**
```bash
cd proyecto-ejemplo
python -m http.server 8000
# Abrir http://localhost:8000
```

**Opción 2: Node.js**
```bash
cd proyecto-ejemplo
npx serve
# Abrir http://localhost:3000
```

**Opción 3: VS Code**
Instala la extensión "Live Server" y haz clic en "Go Live".

## Interacción Programática con LLM

La aplicación demuestra la integración programática con un LLM (Gemini) en los siguientes puntos:

### 1. System Instructions Dinámicas

Cada personaje tiene un `prompt_personaje` que define su contexto histórico, conocimientos, limitaciones y estilo de comunicación. Estas instrucciones se envían como `systemInstruction` en cada llamada a la API.

### 2. Memoria de Conversación

La clase `LLMClient` mantiene un historial de mensajes que se incluye en cada petición, permitiendo que el personaje recuerde el contexto de la conversación.

### 3. Control de Temperatura

La temperatura controla la creatividad de las respuestas:
- `0.0`: Respuestas deterministas y precisas
- `0.7`: Balance entre coherencia y variedad (default)
- `1.5-2.0`: Respuestas más creativas e impredecibles

### 4. Flujo de Datos

```
Usuario hace clic en nodo → Se carga el prompt_personaje
                                ↓
Usuario escribe mensaje → LLM.chat(mensaje, prompt_personaje)
                                ↓
                        Se envía a Gemini API con:
                        - systemInstruction: prompt_personaje
                        - contents: historial + mensaje nuevo
                        - generationConfig: temperature, maxTokens
                                ↓
                        Respuesta contextual del personaje
                                ↓
                        Se muestra en el panel de chat
```

## Prompts de Personajes

Los prompts están optimizados siguiendo principios de prompt engineering:

1. **Contexto temporal estricto**: Cada personaje solo conoce lo que existía hasta su año
2. **Reglas de comportamiento**: 5-8 reglas específicas por personaje
3. **Límites de conocimiento**: Conceptos explícitos que NO debe conocer
4. **Estilo definido**: Tono, vocabulario y referencias culturales de la época
5. **Instrucciones de formato**: Cómo responder ante preguntas anacrónicas

## Código de Ejemplo: Uso del LLMClient

```javascript
import { LLMClient } from './llm-client.js';

// Crear cliente
const llm = new LLMClient('TU_API_KEY', 'gemini-2.0-flash');

// Conversar con un personaje
const systemPrompt = `Eres Isaac Newton en 1687. Solo conoces la ciencia de tu época.`;

const respuesta = await llm.chat(
    "¿Qué piensas de la teoría de la relatividad?",
    systemPrompt,
    0.7  // temperature
);

console.log(respuesta);
// "No conozco tal teoría. En mi época estudiamos el movimiento 
//  mediante las leyes que he establecido..."
```

## Experimentación con Temperature

Puedes probar diferentes valores de temperatura para el mismo prompt:

```javascript
const temperatures = [0.0, 0.5, 1.0, 1.5];

for (const temp of temperatures) {
    const response = await llm.chatOneShot(
        "Descríbele a alguien del futuro cómo ves el mundo",
        newtonPrompt,
        temp
    );
    console.log(`Temperature ${temp}:`, response);
}
```

## Extensión del Proyecto

Ideas para extender la aplicación:

1. **Generación de audio**: Usar la API TTS de Gemini para que los personajes "hablen"
2. **Más personajes**: Agregar figuras de diferentes épocas y culturas
3. **Líneas temporales múltiples**: Comparar desarrollos paralelos en diferentes regiones
4. **Modo quiz**: El personaje hace preguntas sobre su época para evaluar al usuario
5. **Análisis de sentimiento**: Visualizar el tono emocional de las conversaciones

## Licencia

Proyecto educativo para el curso CC451 - Inteligencia Artificial.
