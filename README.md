# OpenLineage Visualizer

Visualizes OpenLineage events as a lineage graph using React Flow.

Supports both Marquez graph format and raw OpenLineage events (JSON array or NDJSON).

## Setup

```bash
npm install
```

## Development

```bash
npm run dev
```

Open http://localhost:5173.

The app reads data from the URL in the `data-json-url` attribute on the `#openlineage-visualizer` div in `index.html`.

### Using test events

Test events are included at `public/test-events.json`. By default `index.html` points to them:

```html
<div id="openlineage-visualizer" data-json-url="/test-events.json" data-height="500px"></div>
```

## Expected data formats

The visualizer accepts three formats via the `data-json-url` endpoint:

### 1. OpenLineage events (JSON array)

```json
[
  {
    "eventType": "COMPLETE",
    "eventTime": "2025-01-01T12:00:00Z",
    "run": { "runId": "abc-123" },
    "job": {
      "namespace": "my_scheduler",
      "name": "etl_job",
      "facets": {
        "jobType": { "integration": "SPARK", "jobType": "TASK", "processingType": "BATCH" },
        "sql": { "query": "INSERT INTO output_table SELECT id, name FROM input_table" }
      }
    },
    "inputs": [
      {
        "namespace": "postgres://db:5432",
        "name": "public.input_table",
        "facets": {
          "schema": {
            "fields": [
              { "name": "id", "type": "INTEGER", "description": "Primary key" },
              { "name": "name", "type": "VARCHAR" }
            ]
          }
        }
      }
    ],
    "outputs": [
      {
        "namespace": "postgres://db:5432",
        "name": "public.output_table",
        "facets": {
          "schema": {
            "fields": [
              { "name": "id", "type": "INTEGER" },
              { "name": "name", "type": "VARCHAR" }
            ]
          },
          "columnLineage": {
            "fields": {
              "id": {
                "inputFields": [
                  { "namespace": "postgres://db:5432", "name": "public.input_table", "field": "id" }
                ]
              }
            }
          }
        }
      }
    ]
  }
]
```

### 2. NDJSON (one event per line)

Same event structure as above, one JSON object per line.

### 3. Pre-built Marquez graph format

```json
{
  "graph": [
    {
      "id": "my_scheduler:etl_job",
      "type": "JOB",
      "data": {
        "name": "etl_job",
        "namespace": "my_scheduler",
        "status": "COMPLETE",
        "sql": "SELECT ..."
      },
      "outEdges": [
        { "origin": "my_scheduler:etl_job", "destination": "postgres://db:5432:public.output_table" }
      ]
    },
    {
      "id": "postgres://db:5432:public.input_table",
      "type": "DATASET",
      "data": {
        "name": "public.input_table",
        "namespace": "postgres://db:5432",
        "fields": [{ "name": "id", "type": "INTEGER" }]
      },
      "outEdges": [
        { "origin": "postgres://db:5432:public.input_table", "destination": "my_scheduler:etl_job" }
      ]
    }
  ]
}
```

## Build

```bash
npm run build
```

Output goes to `dist/`.
