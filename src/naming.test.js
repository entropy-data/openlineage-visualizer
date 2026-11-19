import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { datasetDisplay, datasetDisplayOf, datasetPlatform, jobDisplay, jobDisplayOf, jobPlatform, parseNamespace } from './naming.js';
import { openLineageToGraph } from './lineage.js';

const fixture = (file) => JSON.parse(readFileSync(new URL(`../public/${file}`, import.meta.url), 'utf8'));
const nodesOf = (file) => openLineageToGraph(fixture(file)).graph;

const display = (namespace, name, facets) => {
  const { label, context, platform } = datasetDisplay({ namespace, name, facets });
  return { label, context, platform: platform?.label ?? null, icon: platform?.icon ?? null };
};

test('parses namespaces with and without authority', () => {
  assert.deepEqual(parseNamespace('kafka://broker.example.internal:9093'), { scheme: 'kafka', authority: 'broker.example.internal:9093' });
  assert.deepEqual(parseNamespace('bigquery'), { scheme: 'bigquery', authority: null });
  assert.deepEqual(parseNamespace(''), { scheme: null, authority: null });
  assert.deepEqual(parseNamespace('my scheduler'), { scheme: null, authority: null });
});

test('a Kafka topic keeps its whole name, the broker is the context', () => {
  assert.deepEqual(display('kafka://kafka-bootstrap.example.internal:9093', 'bank.payments.transactions.v1'), {
    label: 'bank.payments.transactions.v1', context: 'kafka-bootstrap.example.internal:9093', platform: 'Kafka', icon: 'kafka',
  });
});

test('a BigQuery table shows the table, with project and dataset as context', () => {
  assert.deepEqual(display('bigquery', 'demo-project.bank_mortgages_v1.mortgages'), {
    label: 'mortgages', context: 'demo-project.bank_mortgages_v1', platform: 'BigQuery', icon: 'bigquery',
  });
});

test('the same table name on two platforms is told apart by platform and context', () => {
  const bigquery = display('bigquery', 'demo-project.bank_mortgages_v1.mortgages');
  const impala = display('impala://impala.cdp.example.internal', 'home_loans.mortgages');
  assert.equal(bigquery.label, impala.label);
  assert.deepEqual(impala, { label: 'mortgages', context: 'home_loans', platform: 'Impala', icon: 'impala' });
});

test('Trino tables split catalog.schema from the table, Starburst hosts are named Starburst', () => {
  assert.deepEqual(display('trino://starburst.data.example.internal:443', 'datamart.group_risk.group_risk_exposures'), {
    label: 'group_risk_exposures', context: 'datamart.group_risk', platform: 'Starburst', icon: 'starburst',
  });
  assert.deepEqual(display('trino://trino.example.internal:8080', 'hive.sales.orders'), {
    label: 'orders', context: 'hive.sales', platform: 'Trino', icon: 'trino',
  });
});

test('table-like namespaces of other platforms', () => {
  assert.deepEqual(display('hive://hive.cdp.example.internal', 'cib_trading.trading_positions'),
    { label: 'trading_positions', context: 'cib_trading', platform: 'Hive', icon: 'hive' });
  assert.deepEqual(display('snowflake://org-account', 'DB.SCHEMA.ORDERS'),
    { label: 'ORDERS', context: 'DB.SCHEMA', platform: 'Snowflake', icon: 'snowflake' });
  assert.deepEqual(display('databricks://analytics-workspace', 'main.sales.orders'),
    { label: 'orders', context: 'main.sales', platform: 'Databricks', icon: 'databricks' });
  assert.deepEqual(display('postgres://db:5432', 'shop.public.orders'),
    { label: 'orders', context: 'shop.public', platform: 'PostgreSQL', icon: 'postgres' });
  assert.deepEqual(display('mssql://sql.example.internal:1433', 'erp.dbo.invoices'),
    { label: 'invoices', context: 'erp.dbo', platform: 'SQL Server', icon: 'sqlserver' });
});

test('a OneLake table shows the table, without the item id', () => {
  assert.deepEqual(display('abfss://9b2c1e64-5f3a-4c47-9d8e-0a1b2c3d4e5f@onelake.dfs.fabric.microsoft.com', '/1f0e2d3c-4b5a-6978-8a9b-0c1d2e3f4a5b/Tables/finance/budget'), {
    label: 'budget', context: 'Tables/finance', platform: 'OneLake', icon: 'onelake',
  });
  assert.deepEqual(display('abfss://ws@onelake.dfs.fabric.microsoft.com', '/1f0e2d3c-4b5a-6978-8a9b-0c1d2e3f4a5b/Tables/fact_sales'), {
    label: 'fact_sales', context: 'Tables', platform: 'OneLake', icon: 'onelake',
  });
});

test('file paths show the last segment', () => {
  assert.deepEqual(display('s3://bucket', 'raw/orders/2026/orders.parquet'),
    { label: 'orders.parquet', context: 'raw/orders/2026', platform: 'S3', icon: 's3' });
  assert.deepEqual(display('abfss://container@account.dfs.core.windows.net', '/landing/customers/'),
    { label: 'customers', context: 'landing', platform: 'Azure Data Lake', icon: 'azure' });
  assert.deepEqual(display('sftp://legacy.example.internal', 'risk_marts_v1'),
    { label: 'risk_marts_v1', context: null, platform: 'SFTP', icon: 'sftp' });
});

test('a Power BI item keeps its whole display name, dots included', () => {
  assert.deepEqual(display('powerbi://app.powerbi.com/groups/9b2c1e64-5f3a-4c47-9d8e-0a1b2c3d4e5f', 'Sales Report v1.2'), {
    label: 'Sales Report v1.2', context: null, platform: 'Power BI', icon: 'powerbi',
  });
});

test('an API endpoint keeps its whole name', () => {
  assert.deepEqual(display('api://policy-system.example.internal', 'insurance_policies_api_v1'),
    { label: 'insurance_policies_api_v1', context: 'policy-system.example.internal', platform: 'API', icon: 'api' });
});

test('a symlinks facet names the table of a file path', () => {
  const facets = { symlinks: { identifiers: [{ namespace: 'hive://metastore:9083', name: 'sales.orders', type: 'TABLE' }] } };
  assert.deepEqual(display('s3://bucket', 'warehouse/sales.db/orders', facets),
    { label: 'orders', context: 'sales', platform: 'S3', icon: 's3' });
});

test('unknown namespaces keep the former split; only a scheme names a platform', () => {
  assert.deepEqual(display('custom://host', 'schema.table'), { label: 'table', context: 'schema', platform: 'custom', icon: null });
  assert.deepEqual(display('scheduler_1', 'public.input_table'), { label: 'input_table', context: 'public', platform: null, icon: null });
  assert.deepEqual(display(undefined, 'plain'), { label: 'plain', context: null, platform: null, icon: null });
});

test('the full name joins namespace and name', () => {
  assert.equal(datasetDisplay({ namespace: 'bigquery', name: 'p.d.t' }).fullName, 'bigquery/p.d.t');
  assert.equal(datasetDisplay({ name: 'p.d.t' }).fullName, 'p.d.t');
});

test('dataset platforms', () => {
  assert.equal(datasetPlatform(null), null);
  assert.deepEqual(datasetPlatform('abfss://ws@onelake.dfs.fabric.microsoft.com'), { label: 'OneLake', icon: 'onelake' });
  assert.deepEqual(datasetPlatform('arn:aws:glue:eu-west-1:123456789012'), { label: 'Glue', icon: 'glue' });
});

test('job platforms come from the jobType facet', () => {
  assert.deepEqual(jobPlatform({ integration: 'DBT' }), { label: 'dbt', icon: 'dbt' });
  assert.deepEqual(jobPlatform({ integration: 'SPARK' }), { label: 'Spark', icon: null });
  assert.deepEqual(jobPlatform({ integration: 'KAFKA_CONNECT' }), { label: 'Kafka Connect', icon: 'kafka' });
  assert.deepEqual(jobPlatform({ namespace: 'starburst', integration: 'TRINO' }), { label: 'Starburst', icon: 'starburst' });
  assert.deepEqual(jobPlatform({ integration: 'POWERBI', jobType: 'SEMANTIC_MODEL' }), { label: 'Power BI', icon: 'fabric-semantic-model' });
  assert.deepEqual(jobPlatform({ integration: 'FABRIC', jobType: 'PIPELINE' }), { label: 'Fabric', icon: 'fabric-pipeline' });
  assert.deepEqual(jobPlatform({ integration: 'SOMETHING_ELSE' }), { label: 'SOMETHING_ELSE', icon: null });
  assert.equal(jobPlatform({}), null);
});

test('job labels', () => {
  assert.equal(jobDisplay({ namespace: 'cloud-composer', name: 'dbt.build_orders', integration: 'DBT' }).label, 'build_orders');
  assert.equal(jobDisplay({ namespace: 'powerbi://Sales Workspace', name: 'Sales v1.2', integration: 'POWERBI' }).label, 'Sales v1.2');
  assert.equal(jobDisplay({ namespace: 'fabric://Sales Workspace', name: 'load.orders', integration: 'FABRIC' }).label, 'load.orders');
  assert.equal(jobDisplay({ namespace: 'scheduler', name: 'nightly' }).label, 'nightly');
  assert.equal(jobDisplay({ namespace: 'scheduler', name: 'nightly' }).fullName, 'scheduler/nightly');
});

test('mixed-platform bank demo events: every node names its platform, topics keep their name', () => {
  const graph = nodesOf('test-events-platforms.json');
  const datasets = graph.filter((n) => n.type === 'DATASET').map((n) => datasetDisplayOf(n.data));
  const jobs = graph.filter((n) => n.type === 'JOB').map((n) => jobDisplayOf(n.data));
  for (const d of [...datasets, ...jobs]) assert.ok(d.platform, `${d.fullName} has a platform`);
  const topic = datasets.find((d) => d.fullName === 'kafka://kafka-bootstrap.openshift.bank.internal:9093/bank.core-banking.events.v1');
  assert.equal(topic.label, 'bank.core-banking.events.v1');
  assert.equal(topic.platform.label, 'Kafka');
  const mortgages = datasets.filter((d) => d.label === 'mortgages').map((d) => `${d.platform.label} ${d.context}`).sort();
  assert.deepEqual(mortgages, ['BigQuery demo-project.bank_mortgages_v1', 'Impala home_loans']);
  assert.deepEqual(new Set(datasets.map((d) => d.platform.label)), new Set(['Kafka', 'BigQuery', 'Impala', 'SFTP', 'Starburst']));
  assert.deepEqual(new Set(jobs.map((j) => j.platform.label)), new Set(['Kafka Connect', 'Spark', 'dbt', 'Starburst']));
});

test('Fabric import events: OneLake tables without item ids, Power BI items by their display name', () => {
  const graph = nodesOf('test-events-fabric.json');
  const datasets = graph.filter((n) => n.type === 'DATASET').map((n) => datasetDisplayOf(n.data));
  assert.deepEqual(datasets.map((d) => [d.label, d.context, d.platform.label]).sort(), [
    ['Sales Model v2.1', null, 'Power BI'],
    ['Sales Report', null, 'Power BI'],
    ['dim_customer', 'Tables', 'OneLake'],
    ['fact_orders', 'Tables/finance', 'OneLake'],
    ['orders', 'Tables', 'OneLake'],
  ]);
  const jobs = graph.filter((n) => n.type === 'JOB').map((n) => jobDisplayOf(n.data));
  assert.deepEqual(jobs.map((j) => [j.label, j.platform.icon]).sort(), [
    ['Load Orders', 'fabric-pipeline'],
    ['Sales Model v2.1', 'fabric-semantic-model'],
    ['Sales Report', 'fabric-report'],
  ]);
});
