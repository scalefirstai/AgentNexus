#!/usr/bin/env node
'use strict';

const commands = require('../src/commands');

const USAGE = `Usage:
  code-graph init                          create .codegraph/ and schema
  code-graph index                         full reindex of tracked JS/TS files
  code-graph update                        incremental reindex since last HEAD
  code-graph impact <file...>              files that transitively import any of <file>
  code-graph map <path-prefix> [depth]     mermaid diagram for nodes near a path
  code-graph neighbors <file>              1-hop neighbors of <file>
  code-graph query <cypher>                run a raw Cypher query
  code-graph install-hooks                 symlink post-commit + pre-push hooks
`;

async function main() {
  const [, , cmd, ...args] = process.argv;

  if (!cmd || cmd === '-h' || cmd === '--help') {
    process.stdout.write(USAGE);
    process.exit(cmd ? 0 : 1);
  }

  const fn = commands[cmd];
  if (!fn) {
    process.stderr.write(`unknown command: ${cmd}\n\n${USAGE}`);
    process.exit(1);
  }

  try {
    const exitCode = await fn(args);
    process.exit(exitCode || 0);
  } catch (err) {
    process.stderr.write(`error: ${err.stack || err.message || err}\n`);
    process.exit(1);
  }
}

main();
