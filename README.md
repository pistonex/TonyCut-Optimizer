# TonyCut Optimizer 🪚📐

**TonyCut Optimizer** es una aplicación web avanzada para la optimización de cortes de tableros (madera, melamina, MDF, etc.). Permite a carpinteros, diseñadores y aficionados maximizar el uso del material, reduciendo el desperdicio al generar automáticamente diagramas de corte eficientes basados en sus dimensiones requeridas.

## ✨ Características Principales

*   **Optimización Inteligente:** Calcula la mejor disposición matemática para ubicar piezas dentro de los tableros base disponibles, minimizando el desperdicio de material general. Incluye modo **Quality** que prueba 3 estrategias de ordenamiento (área, lado más largo, perímetro) y elige la de mayor eficiencia.
*   **Gestión de Materiales y Piezas:** Permite ingresar dimensiones (largo, ancho, cantidad) tanto de las piezas requeridas como del stock disponible de tableros.
*   **Configuración Avanzada:**
    *   Soporte multidimensional (milímetros, centímetros y pulgadas).
    *   Consideración del **espesor de la sierra** (Kerf) entre los cortes.
    *   Consideración del **espesor de los tapacantos** aplicados a cada borde para calcular las medidas efectivas de corte.
    *   Margen de refilado en los bordes perimetrales del tablero base (board margin).
*   **Gestión de Veta de la Madera (Grain Direction):** Opción para respetar obligatoriamente la dirección de la veta de la madera al momento del cálculo (evita el rotado a 90° de ciertas placas).
*   **Gestión de Tapacantos:** Seleccione e identifique visualmente cuáles bordes de cada pieza (superior, inferior, izquierdo, derecho) requieren tapacanto, actualizando el despunte y la dimensión de corte automáticamente.
*   **Importación y Exportación:**
    *   Guarde sus proyectos localmente en formato `.json` para abrir y retomar el trabajo más adelante.
    *   Importación rápida de grandes volúmenes de piezas mediante la carga de archivos delimitados `.csv`.
*   **Exportación y Reportes:**
    *   Exportación de esquemas completos y resúmenes de corte de manera nativa al formato **PDF**.
    *   Sistema avanzado de impresión dual integrado al navegador (**Imprimir Esquema Completo** / **Imprimir Resumen de Cortes**).
*   **Gestor de Plantillas (Templates):** Guarde agrupaciones frecuentes de piezas y stock reutilizándolas en futuros trabajos con un par de clics.
*   **Almacenamiento Local (Local Storage):** Autoguardado instantáneo del progreso en su navegador sin la necesidad de tener una cuenta o una base de datos del lado del servidor.
*   **Modo Oscuro / Claro:** Interfaz amigable, minimalista y dinámica adaptada a la preferencia visual de cada usuario.

## 🛠️ Tecnologías Utilizadas

El proyecto fue construido sobre una pila tecnológica (stack) moderna enfocada en el rendimiento, escalabilidad web y rápido renderizado del DOM:

*   **[React 19](https://react.dev/) / [TypeScript](https://www.typescriptlang.org/)**: Para un manejo estructurado, fuertemente tipado y componetizado del DOM.
*   **[Vite](https://vitejs.dev/)**: Como sistema de dependencias dinámicas ultrarrápido (Build Tool).
*   **[Vitest](https://vitest.dev/)**: Framework de tests unitarios para validar el algoritmo de optimización.
*   **[Tailwind CSS](https://tailwindcss.com/)**: Framework para un estilado fácil de mantener, veloz y completamente responsivo a dispositivos variables.
*   **[Lucide React](https://lucide.dev/)**: Para una iconografía consistente, estética y liviana.
*   **[jsPDF](https://github.com/parallax/jsPDF) & [html2canvas](https://html2canvas.hertzen.com/)**: Motor de escaneo y dibujado visual orientado a renderizar las gráficas visuales en el explorador, emitiendo como salida un documento multipágina con calidad de impresión.

## 🚀 Instalación y Uso Local

Sigue estos pasos para instalar, levantar el entorno de desarrollo y probar el optimizador localmente:

### Prerrequisitos
Asegúrate de contar con **[Node.js](https://nodejs.org/)** (versión 18+ es recomendada) y un manejador de paquetes de Node (`npm` está incluido) dentro de tu sistema:

```bash
node -v # Debería imprimir tu versión de Node
npm -v  # Debería imprimir tu versión de npm
```

### Instrucciones

1. **Clonar/Navegar al repositorio:**
   Sitúate dentro de una consola/terminal sobre el directorio principal raíz del proyecto usando `cd`:
   ```bash
   cd /ruta/correspondiente/a/tonycut
   ```

2. **Instalar paquetes de dependencias (`node_modules/`):**
   ```bash
   npm install
   ```

3. **Ejecutar el servidor de desarrollo en vivo:**
   ```bash
   npm run dev
   ```
   *La terminal te proporcionará la ruta local (típicamente `http://localhost:5173/`), ábrela en tu navegador para interactuar con la Web App.*

4. **Ejecutar tests unitarios (Opcional):**
   Validación del algoritmo de optimización y utilidades:
   ```bash
   npm test
   ```

5. **Compilar los artefactos para Producción (Opcional):**
   Proceso dirigido a preparar el proyecto a fin de ser alojado (deployed) a un entorno real o servidor como Vercel, Netlify, o tu propio Hosting:
   ```bash
   npm run build
   ```

## 📂 Estructura Principal del Proyecto

La codificación base del software reside en la raíz y subcarpetas principales:

*   `App.tsx` : Componente de entrada y orquestador maestro (almacena el Context global, los Side Menus y el Gestor de Archivos).
*   `/components/` : Contenido fragmentado y modularizado de la interfaz gráfica.
    *   `InputForms.tsx` : Componentes para ingresar el stock de tableros y manipular la tabla dinámica de piezas requeridas.
    *   `Visualizer.tsx` : Motor de renderizado visual. Dibuja los rectángulos del material utilizando cálculos proporcionales al navegador (DOM).
*   `/services/` : Capa de backend/abstracción desacoplada de React.
    *   `optimizer.ts` : Rutina pura y cruda conformada por algoritmos de empaquetado 2D (Bin Packing Math Algorithm) que logra encontrar el encaje computacionalmente más robusto en el panel base perimetral.
    *   `optimizer.test.ts` : Suite de tests unitarios (Vitest) que validan el algoritmo con 15 casos, incluyendo verificación de no superposición entre piezas.
*   `types.ts` : Diccionario conteniendo todas las estructuras, atributos en interfaces vitales que comparten todos los ficheros `.ts`/`.tsx` (TypeScript) del entorno de trabajo.

## 💡 Flujo de Trabajo (Cómo operar la aplicación)

1. **Ingresa tu Stock de Tablero:** Específica las dimensiones del aglomerado base de material disponibe y su cantidad en stock mediante _Añadir Hoja_.
2. **Carga tus Requerimientos de Pieza:** Usa la tabla para sumar los recortes deseados. Detalla cómo se llama la pieza, qué medida tiene de _Largo x Ancho_ y el material (tiene que coincidir con el stock).
    *   *Tip:* En la columna _Veta_, asegúrate de activarlo o apagarlo dependiendo de si el material es sólido (tipo madera) donde su dirección estructural es inalterable, o si es MDF liso.
    *   *Tip:* Acciona sobre el cubo indicativo si se busca revestir con Tapacanto perimetral; esto deducirá su tamaño relativo para efectuar un corte de sierra exacto.
3. **Afina detalles Finales (Opcional):** Toca sobre la rueda mecánica (_Configurar_) limitando cuál será la mordida de incisión de la sierra (ejemplo 3mm o 4mm), y estableciendo el borde desperdiciado original del propio tablero fabricado (stock margin).
4. **Optimiza:** Haz clic en el botón principal azul **Calcular**. Un gráfico veloz mostrará cómo quedó distribuido geométricamente el plano exacto. Desplázate a la derecha previsualizando analíticas y eficiencia del metro cuadrado de tablero salvado y gastado en refase.
5. **Imprime/Descarga:** Procede mediante el despliegue _Archivo > Imprimir Todo_ mandando todo hacia tu impresora para guiar tu proceso diario de ensamblaje.

---

> _Desarrollado para optimizar tiempos, materiales y simplificar las matemáticas del corte de forma eficaz._
