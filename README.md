# Sistema de Análisis de Presupuesto y Nóminas - Backend

## Descripción General

El backend es un servidor API desarrollado en Deno con TypeScript que permite almacenar, consultar y correlacionar datos de presupuesto público y nóminas de Guatemala. Los datos se modelan como un grafo donde cada entidad (programas, actividades, empleados, unidades administrativas) es un nodo, y las relaciones entre ellos son aristas.

## Tecnologías Utilizadas

- Deno como runtime de TypeScript
- Oak como framework web para la API
- PostgreSQL como base de datos relacional
- SheetJS (XLSX) para lectura de archivos Excel
- PostgreSQL JSONB para almacenar propiedades flexibles

## Estructura de Datos

### Nodos

Cada nodo tiene los siguientes campos:
- id: identificador único numérico
- label: tipo de nodo (Program, Activity, Employee, AdministrativeUnit, etc.)
- name: nombre único del nodo
- properties: objeto JSON con atributos específicos del tipo
- created_at: timestamp de creación

### Aristas

Cada arista tiene los siguientes campos:
- id: identificador único numérico
- source_id: ID del nodo origen
- target_id: ID del nodo destino
- relation_type: tipo de relación (PART_OF, EXECUTES, WORKS_IN, FUNDS, CORRELATED_WITH)
- weight: peso numérico de la relación (opcional)
- properties: objeto JSON con atributos adicionales
- created_at: timestamp de creación

## Endpoints de la API

### Subida de Datos

#### POST /api/upload/excel
Sube un archivo Excel (XLSX, XLS, ODS) que contiene datos de presupuesto o nómina. El sistema detecta automáticamente el tipo de archivo, extrae los nodos y aristas, y los guarda en la base de datos.

Parámetros: multipart/form-data con campo "file"

Respuesta:
{
  "success": true,
  "filename": "archivo.xlsx",
  "type": "payroll",
  "year": 2026,
  "month": 1,
  "nodesSaved": 278,
  "edgesSaved": 229,
  "timestamp": "fecha"
}

#### POST /api/data/upload
Sube datos en formato JSON directamente. Útil para integraciones donde los datos ya están estructurados.

Cuerpo de la petición:
{
  "type": "budget",
  "source": "nombre_fuente",
  "year": 2023,
  "nodes": [],
  "edges": []
}

Respuesta:
{
  "success": true,
  "type": "budget",
  "source": "nombre_fuente",
  "nodesSaved": 7,
  "edgesSaved": 4,
  "timestamp": "fecha"
}

#### GET /api/data/template/:type
Obtiene una plantilla JSON para estructurar los datos manualmente. Los tipos disponibles son "budget" y "payroll".

### Consulta del Grafo

#### GET /api/graph/nodes
Lista los nodos almacenados con paginación.

Parámetros opcionales:
- label: filtrar por tipo de nodo
- limit: cantidad de resultados (default 100)
- offset: desplazamiento para paginación (default 0)

Respuesta:
{
  "nodes": [],
  "total": 100,
  "limit": 100,
  "offset": 0
}

#### GET /api/graph/nodes/:id
Obtiene un nodo específico por su ID junto con todas sus aristas entrantes y salientes.

Respuesta:
{
  "id": 1,
  "label": "Program",
  "name": "Nombre del programa",
  "properties": {},
  "created_at": "fecha",
  "edges": []
}

#### GET /api/graph/edges
Lista las aristas del grafo. Requiere el parámetro nodeId para obtener las aristas conectadas a un nodo específico.

Parámetro requerido:
- nodeId: ID del nodo

#### GET /api/graph/neighbors/:nodeId
Obtiene todos los nodos vecinos conectados directamente al nodo especificado.

Parámetro opcional:
- relationType: filtrar por tipo de relación

Respuesta:
{
  "node": {},
  "neighbors": [
    {
      "node": {},
      "relation": {}
    }
  ]
}

#### GET /api/graph/path
Encuentra el camino más corto entre dos nodos usando el algoritmo BFS.

Parámetros:
- from: ID del nodo origen
- to: ID del nodo destino
- maxDepth: profundidad máxima de búsqueda (default 10, opcional)

Respuesta:
{
  "nodes": [],
  "edges": [],
  "totalWeight": 0.8
}

#### GET /api/graph/search
Busca nodos por coincidencia textual en el nombre o en las propiedades.

Parámetro:
- q: texto de búsqueda

Respuesta:
{
  "query": "texto",
  "results": [],
  "count": 5
}

#### GET /api/graph/summary
Obtiene estadísticas resumidas del grafo.

Respuesta:
{
  "totalNodes": 15,
  "totalEdges": 14,
  "nodesByLabel": {
    "Program": 3,
    "Activity": 2,
    "Employee": 3
  },
  "edgesByType": {
    "PART_OF": 2,
    "WORKS_IN": 3,
    "CORRELATED_WITH": 7
  }
}

### Correlaciones

#### POST /api/correlations/run
Ejecuta el motor de correlaciones que analiza los datos existentes y crea nuevas aristas de tipo CORRELATED_WITH. Las correlaciones se basan en similitud textual entre nombres y en ratios presupuesto-salario.

Respuesta:
{
  "success": true,
  "message": "Correlation analysis completed",
  "correlationsCreated": 7
}

#### GET /api/correlations/results
Obtiene las correlaciones encontradas.

Parámetros opcionales:
- nodeId: filtrar por nodo específico
- minWeight: peso mínimo (default 0.1)
- limit: cantidad de resultados (default 100)
- offset: desplazamiento para paginación (default 0)

Respuesta:
{
  "correlations": [],
  "limit": 100,
  "offset": 0,
  "total": 10
}

#### GET /api/correlations/between
Obtiene la correlación entre dos nodos específicos.

Parámetros:
- source: ID del nodo origen
- target: ID del nodo destino

Respuesta:
{
  "source": 7,
  "target": 9,
  "correlation": {}
}

### Utilidades

#### GET /api/health
Verifica que el servidor esté funcionando.

Respuesta:
{
  "status": "ok",
  "timestamp": "fecha"
}

## Tipos de Nodos Soportados

- Program: Programa presupuestario (contiene código y presupuesto por año)
- Subprogram: Subprograma dentro de un programa
- Project: Proyecto específico
- Activity: Actividad específica con asignación presupuestaria
- ExecutingUnit: Unidad ejecutora (ej: Vicepresidencia, Guardia Presidencial)
- Employee: Empleado público (contiene puesto, salarios, unidad)
- AdministrativeUnit: Unidad administrativa (ej: Despacho Ministerial, Viceministerio)
- BudgetAllocation: Asignación presupuestaria específica

## Tipos de Relaciones Soportadas

- PART_OF: Un nodo es parte de otro (ej: Activity PART_OF Program)
- EXECUTES: Una unidad ejecutora ejecuta una actividad
- WORKS_IN: Un empleado trabaja en una unidad administrativa
- FUNDS: Una asignación presupuestaria financia una actividad
- CORRELATED_WITH: Relación inferida por correlación (textual o numérica)
- DEPENDS_ON: Dependencia genérica entre nodos

## Procesamiento de Archivos Excel

### Presupuesto (formato CUADRO1)
El parser identifica programas por el código en la columna PROGRAMA, subprogramas por SUBPROGRAMA, proyectos por PROYECTO y actividades por ACTIVIDAD. Extrae los montos aprobados de las columnas APROBADO 2021 y APROBADO 2022.

### Unidades Ejecutoras (formato CUADRO7)
Extrae el código y descripción de las unidades ejecutoras junto con su presupuesto asignado.

### Nóminas (formato RENGLON)
Identifica la fila de encabezados que contiene "NOMBRE EMPLEADO" y extrae para cada empleado: puesto, nombre, renglón, unidad administrativa, salario base y salario nominal. Crea automáticamente nodos de tipo AdministrativeUnit si no existen.

## Instalación y Configuración

### Requisitos
- Deno 1.40 o superior
- PostgreSQL 14 o superior

### Variables de Entorno
Archivo .env:
DATABASE_URL=postgres://usuario:contraseña@localhost:5432/budget_graph
PORT=8000
HOST=0.0.0.0
UPLOAD_DIR=./uploads
LOG_LEVEL=info

### Comandos
deno task migrate    # Ejecutar migraciones de base de datos
deno task start      # Iniciar servidor en modo producción
deno task dev        # Iniciar servidor con watch mode

## Flujo de Trabajo Típico

1. El usuario sube un archivo Excel mediante POST /api/upload/excel
2. El sistema procesa el archivo y extrae nodos y aristas
3. Los datos se guardan en PostgreSQL
4. El frontend consulta GET /api/graph/summary para estadísticas
5. El frontend obtiene nodos y aristas con GET /api/graph/nodes y GET /api/graph/edges
6. Para exploración interactiva, usa GET /api/graph/neighbors/:id
7. Para búsquedas, usa GET /api/graph/search?q=texto
8. Opcionalmente, ejecuta POST /api/correlations/run para encontrar relaciones

## Manejo de Errores

Todos los endpoints devuelven códigos de error HTTP estándar:
- 400: Error en la petición (parámetros inválidos, archivo incorrecto)
- 404: Recurso no encontrado
- 500: Error interno del servidor

La respuesta de error tiene formato:
{
  "error": "Descripción del error",
  "timestamp": "fecha"
}

## Limitaciones Conocidas

- Los nombres de nodos deben coincidir exactamente para crear aristas correctamente
- El sistema es sensible a mayúsculas y minúsculas
- Las correlaciones textuales usan el algoritmo de Jaccard con umbral mínimo de 0.15
- Archivos Excel muy grandes pueden requerir ajustar MAX_FILE_SIZE en .env
