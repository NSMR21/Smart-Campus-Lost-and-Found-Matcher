// Splits a .sql script into individual statements the same way the mysql
// command-line client does: honours DELIMITER lines, quotes and comments.
// Used by scripts/setup-db.mjs and by the SQL Lab page.

export function splitSqlStatements(sql) {
  const statements = [];
  let delimiter = ';';
  let current = '';
  let hasCode = false;
  let atLineStart = true;
  let i = 0;
  const n = sql.length;

  const flush = () => {
    if (hasCode) statements.push(current.trim());
    current = '';
    hasCode = false;
  };

  while (i < n) {
    if (atLineStart) {
      const nl = sql.indexOf('\n', i);
      const lineEnd = nl === -1 ? n : nl;
      const match = /^\s*DELIMITER\s+(\S+)\s*$/i.exec(sql.slice(i, lineEnd).replace(/\r$/, ''));
      if (match) {
        flush();
        delimiter = match[1];
        i = lineEnd + 1;
        continue;
      }
      atLineStart = false;
    }

    const ch = sql[i];

    // -- comment / # comment (skip to end of line, keep the newline)
    if ((ch === '-' && sql[i + 1] === '-' && /\s/.test(sql[i + 2] ?? ' ')) || ch === '#') {
      const nl = sql.indexOf('\n', i);
      i = nl === -1 ? n : nl;
      continue;
    }
    // /* block comment */
    if (ch === '/' && sql[i + 1] === '*') {
      const end = sql.indexOf('*/', i + 2);
      i = end === -1 ? n : end + 2;
      current += ' ';
      continue;
    }
    // quoted string or identifier
    if (ch === "'" || ch === '"' || ch === '`') {
      let j = i + 1;
      while (j < n) {
        if (sql[j] === '\\' && ch !== '`') { j += 2; continue; }
        if (sql[j] === ch) {
          if (sql[j + 1] === ch) { j += 2; continue; }   // doubled quote
          break;
        }
        j++;
      }
      current += sql.slice(i, j + 1);
      hasCode = true;
      i = j + 1;
      continue;
    }
    if (sql.startsWith(delimiter, i)) {
      flush();
      i += delimiter.length;
      continue;
    }

    if (ch === '\n') atLineStart = true;
    if (!/\s/.test(ch)) hasCode = true;
    current += ch;
    i++;
  }
  flush();
  return statements;
}
