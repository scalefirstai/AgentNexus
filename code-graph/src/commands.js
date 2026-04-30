'use strict';

const fs = require('fs');
const path = require('path');
const lib = require('./lib');

// ---------- helpers ----------

async function deleteModule(conn, modPath) {
  await lib.exec(conn, `MATCH (m:Module {path: $p}) DETACH DELETE m`, { p: modPath });
  await lib.exec(
    conn,
    `MATCH (s:Symbol) WHERE s.module = $p DETACH DELETE s`,
    { p: modPath }
  );
}

async function upsertModule(conn, modPath) {
  const ext = path.extname(modPath);
  const name = path.basename(modPath, ext);
  await lib.exec(
    conn,
    `CREATE (:Module {path: $p, name: $n, ext: $e})`,
    { p: modPath, n: name, e: ext }
  );
}

async function upsertExternal(conn, name) {
  const existing = await lib.exec(
    conn,
    `MATCH (e:External {name: $n}) RETURN e.name AS n`,
    { n: name }
  );
  if (existing.length === 0) {
    await lib.exec(conn, `CREATE (:External {name: $n})`, { n: name });
  }
}

async function indexFile(conn, root, modPath) {
  const abs = path.join(root, modPath);
  if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) {
    await deleteModule(conn, modPath);
    return { kind: 'deleted', file: modPath };
  }

  const source = fs.readFileSync(abs, 'utf8');
  const { imports, symbols } = lib.parseSource(modPath, source);

  await deleteModule(conn, modPath);
  await upsertModule(conn, modPath);

  for (const sym of symbols) {
    const id = `${modPath}::${sym.name}@${sym.line}`;
    await lib.exec(
      conn,
      `CREATE (:Symbol {id: $id, name: $n, kind: $k, module: $m, line: $l, exported: $e})`,
      { id, n: sym.name, k: sym.kind, m: modPath, l: sym.line, e: sym.exported }
    );
    await lib.exec(
      conn,
      `MATCH (m:Module {path: $m}), (s:Symbol {id: $id}) CREATE (m)-[:DEFINES]->(s)`,
      { m: modPath, id }
    );
  }

  for (const imp of imports) {
    if (lib.isRelative(imp.spec)) {
      const resolved = lib.resolveRelative(modPath, imp.spec, root);
      if (!resolved) continue;
      // ensure target module node exists (lazy stub if not yet indexed)
      const target = await lib.exec(
        conn,
        `MATCH (m:Module {path: $p}) RETURN m.path AS p`,
        { p: resolved }
      );
      if (target.length === 0) await upsertModule(conn, resolved);
      await lib.exec(
        conn,
        `MATCH (a:Module {path: $a}), (b:Module {path: $b}) CREATE (a)-[:IMPORTS {line: $l}]->(b)`,
        { a: modPath, b: resolved, l: imp.line }
      );
    } else {
      const ext = lib.externalName(imp.spec);
      await upsertExternal(conn, ext);
      await lib.exec(
        conn,
        `MATCH (a:Module {path: $a}), (b:External {name: $n}) CREATE (a)-[:IMPORTS_EXTERNAL {line: $l}]->(b)`,
        { a: modPath, n: ext, l: imp.line }
      );
    }
  }

  return { kind: 'indexed', file: modPath, symbols: symbols.length, imports: imports.length };
}

// ---------- subcommands ----------

async function init() {
  const { conn, dbPath } = await lib.open();
  await lib.ensureSchema(conn);
  process.stdout.write(`code-graph initialised at ${dbPath}\n`);
}

async function indexCmd() {
  const { conn, root } = await lib.open();
  await lib.ensureSchema(conn);

  // wipe existing graph data (keep schema + meta empty/fresh)
  await lib.exec(conn, `MATCH (n:Module) DETACH DELETE n`);
  await lib.exec(conn, `MATCH (n:External) DETACH DELETE n`);
  await lib.exec(conn, `MATCH (n:Symbol) DETACH DELETE n`);

  const files = lib.listSourceFiles(root);
  let nSym = 0;
  let nImp = 0;
  for (const f of files) {
    const r = await indexFile(conn, root, f);
    if (r.kind === 'indexed') {
      nSym += r.symbols;
      nImp += r.imports;
    }
  }

  const sha = lib.headSha(root);
  if (sha) await lib.setMeta(conn, 'head_commit', sha);
  await lib.setMeta(conn, 'indexed_at', new Date().toISOString());

  process.stdout.write(
    `indexed ${files.length} files, ${nSym} symbols, ${nImp} import edges${sha ? ` @ ${sha.slice(0, 7)}` : ''}\n`
  );
}

async function update() {
  const { conn, root } = await lib.open();
  await lib.ensureSchema(conn);

  const lastSha = await lib.getMeta(conn, 'head_commit');
  const head = lib.headSha(root);
  if (!lastSha || !head) {
    process.stdout.write(`no recorded HEAD; running full index\n`);
    return indexCmd();
  }
  if (lastSha === head) {
    process.stdout.write(`graph already at ${head.slice(0, 7)}\n`);
    return;
  }

  const changed = lib.diffNames(root, lastSha, head);
  if (changed === null) {
    process.stdout.write(`could not diff ${lastSha.slice(0, 7)}..${head.slice(0, 7)}; running full index\n`);
    return indexCmd();
  }

  for (const f of changed) {
    await indexFile(conn, root, f);
  }
  await lib.setMeta(conn, 'head_commit', head);
  await lib.setMeta(conn, 'indexed_at', new Date().toISOString());
  process.stdout.write(`updated ${changed.length} files (${lastSha.slice(0, 7)}..${head.slice(0, 7)})\n`);
}

async function impact(args) {
  if (args.length === 0) {
    process.stderr.write(`usage: code-graph impact <file> [file...]\n`);
    return 1;
  }
  const { conn, root } = await lib.open();
  const targets = args.map((a) => path.relative(root, path.resolve(a)).replace(/\\/g, '/'));

  const seen = new Set();
  for (const t of targets) {
    const result = await lib.exec(
      conn,
      `MATCH (src:Module)-[:IMPORTS*1..6]->(tgt:Module {path: $p})
       RETURN DISTINCT src.path AS path`,
      { p: t }
    );
    for (const r of result) seen.add(r.path);
  }

  if (seen.size === 0) {
    process.stdout.write(`no downstream importers for: ${targets.join(', ')}\n`);
    return;
  }
  process.stdout.write(`downstream importers (${seen.size}):\n`);
  for (const p of [...seen].sort()) process.stdout.write(`  ${p}\n`);
}

async function neighbors(args) {
  if (args.length === 0) {
    process.stderr.write(`usage: code-graph neighbors <file>\n`);
    return 1;
  }
  const { conn, root } = await lib.open();
  const target = path.relative(root, path.resolve(args[0])).replace(/\\/g, '/');

  const out = await lib.exec(
    conn,
    `MATCH (m:Module {path: $p})-[:IMPORTS]->(d:Module) RETURN d.path AS p`,
    { p: target }
  );
  const inn = await lib.exec(
    conn,
    `MATCH (s:Module)-[:IMPORTS]->(m:Module {path: $p}) RETURN s.path AS p`,
    { p: target }
  );
  const ext = await lib.exec(
    conn,
    `MATCH (m:Module {path: $p})-[:IMPORTS_EXTERNAL]->(e:External) RETURN e.name AS p`,
    { p: target }
  );
  const syms = await lib.exec(
    conn,
    `MATCH (m:Module {path: $p})-[:DEFINES]->(s:Symbol) RETURN s.name AS n, s.kind AS k, s.line AS l`,
    { p: target }
  );

  process.stdout.write(`${target}\n`);
  process.stdout.write(`  imports (${out.length}):\n`);
  for (const r of out) process.stdout.write(`    -> ${r.p}\n`);
  process.stdout.write(`  imported by (${inn.length}):\n`);
  for (const r of inn) process.stdout.write(`    <- ${r.p}\n`);
  process.stdout.write(`  external (${ext.length}):\n`);
  for (const r of ext) process.stdout.write(`    ~ ${r.p}\n`);
  process.stdout.write(`  defines (${syms.length}):\n`);
  for (const r of syms) process.stdout.write(`    * ${r.k} ${r.n}:${r.l}\n`);
}

function safeId(p) {
  return p.replace(/[^A-Za-z0-9]/g, '_');
}

async function map(args) {
  if (args.length === 0) {
    process.stderr.write(`usage: code-graph map <path-prefix> [maxNodes]\n`);
    return 1;
  }
  const prefix = args[0];
  const maxNodes = parseInt(args[1] || '40', 10);
  const { conn } = await lib.open();

  const modules = await lib.exec(
    conn,
    `MATCH (m:Module) WHERE m.path STARTS WITH $p RETURN m.path AS p ORDER BY m.path LIMIT $n`,
    { p: prefix, n: maxNodes }
  );
  if (modules.length === 0) {
    process.stdout.write(`no modules with prefix ${prefix}\n`);
    return;
  }
  const inSet = new Set(modules.map((m) => m.p));

  const edges = await lib.exec(
    conn,
    `MATCH (a:Module)-[:IMPORTS]->(b:Module)
     WHERE a.path STARTS WITH $p OR b.path STARTS WITH $p
     RETURN a.path AS f, b.path AS t LIMIT 500`,
    { p: prefix }
  );

  const lines = ['```mermaid', 'graph LR'];
  for (const m of modules) lines.push(`  ${safeId(m.p)}["${m.p}"]`);
  for (const e of edges) {
    if (!inSet.has(e.f) && !inSet.has(e.t)) continue;
    lines.push(`  ${safeId(e.f)} --> ${safeId(e.t)}`);
  }
  lines.push('```');
  process.stdout.write(lines.join('\n') + '\n');
}

async function query(args) {
  if (args.length === 0) {
    process.stderr.write(`usage: code-graph query <cypher>\n`);
    return 1;
  }
  const cypher = args.join(' ');
  const { conn } = await lib.open();
  const result = await lib.exec(conn, cypher);
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
}

async function installHooks() {
  const { root } = await lib.open();
  const gitDir = path.join(root, '.git');
  if (!fs.existsSync(gitDir)) {
    process.stderr.write(`not a git repo: ${root}\n`);
    return 1;
  }
  const hooksDir = path.join(gitDir, 'hooks');
  fs.mkdirSync(hooksDir, { recursive: true });

  const here = path.resolve(__dirname, '..', 'hooks');
  for (const name of ['post-commit', 'pre-push']) {
    const src = path.join(here, name);
    const dst = path.join(hooksDir, name);
    if (fs.existsSync(dst) && !fs.lstatSync(dst).isSymbolicLink()) {
      process.stdout.write(`skipped ${name} (existing non-symlink hook)\n`);
      continue;
    }
    if (fs.existsSync(dst)) fs.unlinkSync(dst);
    fs.symlinkSync(src, dst);
    fs.chmodSync(src, 0o755);
    process.stdout.write(`linked ${name} -> ${src}\n`);
  }
}

module.exports = {
  init,
  index: indexCmd,
  update,
  impact,
  map,
  neighbors,
  query,
  'install-hooks': installHooks,
};
