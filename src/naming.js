// Display names and platforms of OpenLineage datasets and jobs.
//
// A dataset is identified by a namespace and a name, and how the name is built depends on the
// namespace's scheme (https://openlineage.io/docs/spec/naming): `bigquery` names a table
// `{project}.{dataset}.{table}`, `kafka://{host}:{port}` names a topic, `s3://{bucket}` an object
// key. The label of a node is the part of the name a reader recognises (the table, the whole topic,
// the file), the context is the rest of the name (schema, dataset, folder), and the platform says
// which system holds the dataset. The full namespace and name stay available in the tooltip and the
// detail panel.

// How the name of a dataset is split into label and context.
//   table: dot separated, the last segment is the table, the rest is its schema/database/catalog
//   path:  slash separated, the last segment is the file or folder, the rest is its parent
//   whole: the name as it is (topics, reports, API endpoints)
const TABLE = 'table';
const PATH = 'path';
const WHOLE = 'whole';

// Platform of a namespace scheme. `icon` is a key of the host's icon set (Entropy Data serves
// them at /assets/media/icons/<key>.svg), null when there is none.
const SCHEMES = {
  kafka: { label: 'Kafka', icon: 'kafka', naming: WHOLE },
  pubsub: { label: 'Pub/Sub', icon: 'pubsub', naming: WHOLE },
  kinesis: { label: 'Kinesis', icon: 'kinesis', naming: WHOLE },
  bigquery: { label: 'BigQuery', icon: 'bigquery', naming: TABLE },
  trino: { label: 'Trino', icon: 'trino', naming: TABLE },
  presto: { label: 'Presto', icon: 'presto', naming: TABLE },
  hive: { label: 'Hive', icon: 'hive', naming: TABLE },
  impala: { label: 'Impala', icon: 'impala', naming: TABLE },
  snowflake: { label: 'Snowflake', icon: 'snowflake', naming: TABLE },
  databricks: { label: 'Databricks', icon: 'databricks', naming: TABLE },
  postgres: { label: 'PostgreSQL', icon: 'postgres', naming: TABLE },
  postgresql: { label: 'PostgreSQL', icon: 'postgres', naming: TABLE },
  mysql: { label: 'MySQL', icon: 'mysql', naming: TABLE },
  mariadb: { label: 'MariaDB', icon: 'mariadb', naming: TABLE },
  mssql: { label: 'SQL Server', icon: 'sqlserver', naming: TABLE },
  sqlserver: { label: 'SQL Server', icon: 'sqlserver', naming: TABLE },
  oracle: { label: 'Oracle', icon: 'oracle', naming: TABLE },
  db2: { label: 'Db2', icon: 'db2', naming: TABLE },
  teradata: { label: 'Teradata', icon: 'teradata', naming: TABLE },
  redshift: { label: 'Redshift', icon: 'redshift', naming: TABLE },
  awsathena: { label: 'Athena', icon: 'athena', naming: TABLE },
  clickhouse: { label: 'ClickHouse', icon: 'clickhouse', naming: TABLE },
  duckdb: { label: 'DuckDB', icon: 'duckdb', naming: TABLE },
  vertica: { label: 'Vertica', icon: 'vertica', naming: TABLE },
  exasol: { label: 'Exasol', icon: 'exasol', naming: TABLE },
  cassandra: { label: 'Cassandra', icon: null, naming: TABLE },
  azurekusto: { label: 'Azure Data Explorer', icon: 'azure', naming: PATH },
  azurecosmos: { label: 'Cosmos DB', icon: 'azure', naming: PATH },
  abfss: { label: 'Azure Data Lake', icon: 'azure', naming: PATH },
  abfs: { label: 'Azure Data Lake', icon: 'azure', naming: PATH },
  wasbs: { label: 'Azure Blob Storage', icon: 'azure', naming: PATH },
  s3: { label: 'S3', icon: 's3', naming: PATH },
  s3a: { label: 'S3', icon: 's3', naming: PATH },
  s3n: { label: 'S3', icon: 's3', naming: PATH },
  gs: { label: 'Cloud Storage', icon: 'gcs', naming: PATH },
  gcs: { label: 'Cloud Storage', icon: 'gcs', naming: PATH },
  hdfs: { label: 'HDFS', icon: null, naming: PATH },
  dbfs: { label: 'Databricks', icon: 'databricks', naming: PATH },
  file: { label: 'File', icon: 'local', naming: PATH },
  sftp: { label: 'SFTP', icon: 'sftp', naming: PATH },
  ftp: { label: 'FTP', icon: 'sftp', naming: PATH },
  powerbi: { label: 'Power BI', icon: 'powerbi', naming: WHOLE },
  api: { label: 'API', icon: 'api', naming: WHOLE },
  http: { label: 'API', icon: 'api', naming: WHOLE },
  https: { label: 'API', icon: 'api', naming: WHOLE },
};

const ONELAKE = { label: 'OneLake', icon: 'onelake', naming: PATH };
const STARBURST = { label: 'Starburst', icon: 'starburst', naming: TABLE };
const GLUE = { label: 'Glue', icon: 'glue', naming: PATH };

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Splits `scheme://authority/rest` (or a bare `bigquery`) into its parts.
export function parseNamespace(namespace) {
  if (!namespace) return { scheme: null, authority: null };
  if (namespace.startsWith('arn:aws:glue:')) return { scheme: 'arn:aws:glue', authority: namespace };
  const match = /^([a-z][a-z0-9+.-]*):\/\/([^/]*)/i.exec(namespace);
  if (match) return { scheme: match[1].toLowerCase(), authority: match[2] || null };
  // A bare namespace is a scheme only when OpenLineage names it so (`bigquery`, `file`, `pubsub`);
  // anything else, such as `scheduler_1`, is a free-form namespace.
  if (SCHEMES[namespace.toLowerCase()]) return { scheme: namespace.toLowerCase(), authority: null };
  return { scheme: null, authority: null };
}

function schemeInfo(namespace) {
  const { scheme, authority } = parseNamespace(namespace);
  const host = (authority || '').toLowerCase();
  if (!scheme) return { scheme, authority, info: null };
  if ((scheme === 'abfss' || scheme === 'abfs') && host.includes('onelake.')) return { scheme, authority, info: ONELAKE };
  if (scheme === 'trino' && host.includes('starburst')) return { scheme, authority, info: STARBURST };
  if (scheme === 'arn:aws:glue') return { scheme, authority, info: GLUE };
  return { scheme, authority, info: SCHEMES[scheme] || null };
}

// The platform a dataset namespace points to: { label, icon }, or null without a namespace.
// An unknown scheme is still a platform, named after the scheme, without an icon.
export function datasetPlatform(namespace) {
  const { scheme, info } = schemeInfo(namespace);
  if (info) return { label: info.label, icon: info.icon };
  if (scheme) return { label: scheme, icon: null };
  return null;
}

function splitTable(name) {
  const parts = name.split('.');
  if (parts.length < 2) return { label: name, context: null };
  return { label: parts.pop(), context: parts.join('.') };
}

function splitPath(name, { dropLeadingGuid = false } = {}) {
  const parts = name.split('/').filter(Boolean);
  if (parts.length === 0) return { label: name, context: null };
  // A OneLake path starts with the id of the lakehouse or warehouse, which says nothing to a reader.
  if (dropLeadingGuid && parts.length > 1 && GUID.test(parts[0])) parts.shift();
  const label = parts.pop();
  return { label, context: parts.length > 0 ? parts.join('/') : null };
}

// The table a symlinks facet names for a dataset, e.g. the metastore table of a Spark file path.
function symlinkTable(facets) {
  const identifiers = facets?.symlinks?.identifiers;
  if (!Array.isArray(identifiers)) return null;
  return identifiers.find((i) => i?.name && (i.type || '').toUpperCase() === 'TABLE') || null;
}

// How a dataset node presents itself: { label, context, platform, fullName }.
// `facets` are the dataset's facets, as far as the graph kept them (symlinks).
export function datasetDisplay({ namespace, name, facets } = {}) {
  const fullName = namespace ? `${namespace}/${name}` : name || '';
  const platform = datasetPlatform(namespace);
  if (!name) return { label: '', context: null, platform, fullName };

  const symlink = symlinkTable(facets);
  if (symlink) {
    const linked = schemeInfo(symlink.namespace).info;
    const split = linked?.naming === PATH ? splitPath(symlink.name) : splitTable(symlink.name);
    return { ...split, platform, fullName };
  }

  const { scheme, authority, info } = schemeInfo(namespace);
  let split;
  if (info?.naming === WHOLE) {
    split = { label: name, context: null };
  } else if (info?.naming === PATH) {
    split = splitPath(name, { dropLeadingGuid: info === ONELAKE });
  } else if (info?.naming === TABLE) {
    split = splitTable(name);
  } else if (/\s/.test(name)) {
    // A display name such as a report title, not an identifier.
    split = { label: name, context: null };
  } else if (name.includes('/')) {
    split = splitPath(name);
  } else {
    split = splitTable(name);
  }
  // A topic or an endpoint says where it lives only through the namespace: the broker or host.
  if (!split.context && info?.naming === WHOLE && scheme !== 'powerbi' && authority) {
    split = { ...split, context: authority };
  }
  return { ...split, platform, fullName };
}

// Platform of a job, from its jobType facet: `integration` (DBT, SPARK, ...) and `jobType`.
const INTEGRATIONS = {
  DBT: { label: 'dbt', icon: 'dbt' },
  SPARK: { label: 'Spark', icon: null },
  FLINK: { label: 'Flink', icon: null },
  AIRFLOW: { label: 'Airflow', icon: null },
  DAGSTER: { label: 'Dagster', icon: null },
  TRINO: { label: 'Trino', icon: 'trino' },
  KAFKA_CONNECT: { label: 'Kafka Connect', icon: 'kafka' },
  SNOWFLAKE: { label: 'Snowflake', icon: 'snowflake' },
  DATABRICKS: { label: 'Databricks', icon: 'databricks' },
  BIGQUERY: { label: 'BigQuery', icon: 'bigquery' },
  DATAFLOW: { label: 'Dataflow', icon: 'google-cloud' },
  VERTEX_AI: { label: 'Vertex AI', icon: 'google-cloud' },
  POWERBI: { label: 'Power BI', icon: 'powerbi' },
  FABRIC: { label: 'Fabric', icon: 'fabric' },
};

// Fabric and Power BI items have an icon of their own per item type.
const FABRIC_ITEM_ICONS = {
  SEMANTIC_MODEL: 'fabric-semantic-model',
  REPORT: 'fabric-report',
  PIPELINE: 'fabric-pipeline',
  DATAFLOW: 'fabric-dataflow',
  NOTEBOOK: 'fabric-notebook',
};

export function jobPlatform({ namespace, integration, jobType } = {}) {
  if (!integration) return null;
  const key = integration.toUpperCase();
  const known = INTEGRATIONS[key];
  if (!known) return { label: integration, icon: null };
  if (key === 'TRINO' && (namespace || '').toLowerCase().includes('starburst')) {
    return { label: 'Starburst', icon: 'starburst' };
  }
  if (key === 'POWERBI' || key === 'FABRIC') {
    const itemIcon = FABRIC_ITEM_ICONS[(jobType || '').toUpperCase()];
    if (itemIcon) return { label: known.label, icon: itemIcon };
  }
  return known;
}

// How a job node presents itself: { label, platform, fullName }. A job name such as
// `dbt.build_orders` keeps its last segment, a Fabric or Power BI item its whole display name.
export function jobDisplay({ namespace, name, integration, jobType } = {}) {
  const fullName = namespace ? `${namespace}/${name}` : name || '';
  const platform = jobPlatform({ namespace, integration, jobType });
  const { scheme } = parseNamespace(namespace);
  const whole = !name || scheme === 'powerbi' || scheme === 'fabric' || /\s/.test(name) || !name.includes('.');
  const label = whole ? name || '' : name.split('.').pop();
  return { label, platform, fullName };
}

// The same, from the data of a graph node (see lineage.js), which keeps the symlinks facet as `symlinks`.
export function datasetDisplayOf(data = {}) {
  const facets = data.symlinks ? { symlinks: data.symlinks } : undefined;
  return datasetDisplay({ namespace: data.namespace, name: data.name, facets });
}

export function jobDisplayOf(data = {}) {
  return jobDisplay({ namespace: data.namespace, name: data.name, integration: data.integration, jobType: data.jobType });
}
