'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const DB_DIRNAME = '.codegraph';
const SOURCE_EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);

// ---------- Kuzu DB ----------

function repoRoot(cwd = process.cwd()) {
  try {
    return execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd, encoding: 'utf8' }).trim();
  } catch {
    return cwd;
  }
}

async function open(root = repoRoot()) {
  const kuzu = require('kuzu');
  const dbPath = path.join(root, DB_DIRNAME);
  fs.mkdirSync(dbPath, { recursive: true });
  const db = new kuzu.Database(dbPath);
  const conn = new kuzu.Connection(db);
  return { db, conn, dbPath, root };
}

const SCHEMA_STATEMENTS = [
  `CREATE NODE TABLE IF NOT EXISTS Module(path STRING, name STRING, ext STRING, PRIMARY KEY(path))`,
  `CREATE NODE TABLE IF NOT EXISTS External(name STRING, PRIMARY KEY(name))`,
  `CREATE NODE TABLE IF NOT EXISTS Symbol(id STRING, name STRING, kind STRING, module STRING, line INT64, exported BOOLEAN, PRIMARY KEY(id))`,
  `CREATE NODE TABLE IF NOT EXISTS Meta(key STRING, value STRING, PRIMARY KEY(key))`,
  `CREATE REL TABLE IF NOT EXISTS IMPORTS(FROM Module TO Module, line INT64)`,
  `CREATE REL TABLE IF NOT EXISTS IMPORTS_EXTERNAL(FROM Module TO External, line INT64)`,
  `CREATE REL TABLE IF NOT EXISTS DEFINES(FROM Module TO Symbol)`,
];

async function ensureSchema(conn) {
  for (const stmt of SCHEMA_STATEMENTS) {
    await conn.query(stmt);
  }
}

async function rows(queryResult) {
  // Kuzu's QueryResult: getAll() returns array of objects keyed by RETURN aliases.
  if (typeof queryResult.getAll === 'function') {
    const all = await queryResult.getAll();
    if (typeof queryResult.close === 'function') queryResult.close();
    return all;
  }
  return queryResult;
}

async function exec(conn, cypher, params) {
  if (params && Object.keys(params).length > 0) {
    const prepared = await conn.prepare(cypher);
    const result = await conn.execute(prepared, params);
    return rows(result);
  }
  return rows(await conn.query(cypher));
}

async function setMeta(conn, key, value) {
  await exec(conn, `MATCH (m:Meta {key: $k}) DELETE m`, { k: key });
  await exec(conn, `CREATE (:Meta {key: $k, value: $v})`, { k: key, v: String(value) });
}

async function getMeta(conn, key) {
  const r = await exec(conn, `MATCH (m:Meta {key: $k}) RETURN m.value AS v`, { k: key });
  return r[0] ? r[0].v : null;
}

// ---------- Repo walk (git ls-files) ----------

function listSourceFiles(root) {
  const out = execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' });
  return out
    .split('\n')
    .filter(Boolean)
    .filter((p) => SOURCE_EXT.has(path.extname(p)));
}

// ---------- Git diff helpers ----------

function diffNames(root, base, head = 'HEAD') {
  try {
    const out = execFileSync('git', ['diff', '--name-only', `${base}..${head}`], {
      cwd: root,
      encoding: 'utf8',
    });
    return out.split('\n').filter(Boolean).filter((p) => SOURCE_EXT.has(path.extname(p)));
  } catch {
    return null;
  }
}

function headSha(root) {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

// ---------- JS/TS regex parser ----------

const RE_IMPORT_FROM = /^\s*import\s+(?:[^'"]+?\s+from\s+)?['"]([^'"]+)['"]/gm;
const RE_REQUIRE = /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
const RE_DYN_IMPORT = /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

const RE_DECL = /^\s*(export\s+(?:default\s+)?)?(async\s+)?(function|class|interface|type|enum|const|let|var)\s+([A-Za-z_$][\w$]*)/gm;

function lineOf(source, index) {
  let line = 1;
  for (let i = 0; i < index; i++) if (source.charCodeAt(i) === 10) line++;
  return line;
}

function parseSource(filePath, source) {
  const imports = [];
  const seen = new Set();

  for (const re of [RE_IMPORT_FROM, RE_REQUIRE, RE_DYN_IMPORT]) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(source)) !== null) {
      const spec = m[1];
      const line = lineOf(source, m.index);
      const key = `${spec}@${line}`;
      if (seen.has(key)) continue;
      seen.add(key);
      imports.push({ spec, line });
    }
  }

  const symbols = [];
  RE_DECL.lastIndex = 0;
  let m;
  while ((m = RE_DECL.exec(source)) !== null) {
    const exported = Boolean(m[1]);
    const kindRaw = m[3];
    const name = m[4];
    const line = lineOf(source, m.index);
    const kind = kindRaw === 'let' || kindRaw === 'var' ? 'const' : kindRaw;
    symbols.push({ name, kind, line, exported });
  }

  return { imports, symbols };
}

// ---------- Import resolution ----------

function isRelative(spec) {
  return spec.startsWith('./') || spec.startsWith('../') || spec.startsWith('/');
}

function resolveRelative(fromFile, spec, root) {
  const fromDir = path.dirname(path.resolve(root, fromFile));
  const base = path.resolve(fromDir, spec);

  const candidates = [
    base,
    ...['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'].map((e) => base + e),
    ...['index.ts', 'index.tsx', 'index.js', 'index.jsx'].map((f) => path.join(base, f)),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c) && fs.statSync(c).isFile()) {
      return path.relative(root, c).replace(/\\/g, '/');
    }
  }
  return null;
}

function externalName(spec) {
  if (spec.startsWith('@')) {
    const parts = spec.split('/');
    return parts.slice(0, 2).join('/');
  }
  return spec.split('/')[0];
}

module.exports = {
  DB_DIRNAME,
  SOURCE_EXT,
  open,
  ensureSchema,
  exec,
  rows,
  setMeta,
  getMeta,
  repoRoot,
  listSourceFiles,
  diffNames,
  headSha,
  parseSource,
  isRelative,
  resolveRelative,
  externalName,
};
