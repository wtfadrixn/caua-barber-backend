/**
 * database/db.js
 * Inicialização do banco de dados SQLite usando sql.js
 * Persiste dados em arquivo .db via fs
 */

const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'barbearia.db');

let db = null;

// Salva o banco no disco após cada operação de escrita
function saveDb() {
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

async function getDb() {
  if (db) return db;

  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
    initSchema();
    saveDb();
  }

  return db;
}

function initSchema() {
  db.run(`
    CREATE TABLE IF NOT EXISTS clientes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      telefone TEXT,
      criado_em TEXT DEFAULT (datetime('now','localtime'))
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS agendamentos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cliente_id INTEGER NOT NULL,
      servico TEXT NOT NULL,
      data TEXT NOT NULL,
      horario TEXT NOT NULL,
      status TEXT DEFAULT 'agendado',
      preco REAL DEFAULT 0,
      criado_em TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (cliente_id) REFERENCES clientes(id)
    );
  `);

  // Seed: inserir dados de exemplo
  db.run(`
    INSERT OR IGNORE INTO clientes (nome, email, telefone) VALUES
    ('João Silva', 'joao@email.com', '(16) 99999-0001'),
    ('Pedro Alves', 'pedro@email.com', '(16) 99999-0002'),
    ('Lucas Mendes', 'lucas@email.com', '(16) 99999-0003');
  `);

  const hoje = new Date();
  const amanha = new Date(hoje); amanha.setDate(hoje.getDate() + 1);
  const fmt = (d) => d.toISOString().split('T')[0];

  db.run(`
    INSERT OR IGNORE INTO agendamentos (cliente_id, servico, data, horario, status, preco) VALUES
    (1, 'Corte Degradê', '${fmt(hoje)}', '09:00', 'agendado', 45),
    (2, 'Corte + Barba', '${fmt(hoje)}', '10:00', 'concluido', 70),
    (3, 'Sobrancelha', '${fmt(amanha)}', '14:00', 'agendado', 25);
  `);
}

// Executa SELECT e retorna array de objetos
function query(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

// Executa INSERT/UPDATE/DELETE e salva disco
function run(sql, params = []) {
  db.run(sql, params);
  saveDb();
  // Retorna o último rowid
  const res = query('SELECT last_insert_rowid() as id');
  return res[0]?.id || null;
}

module.exports = { getDb, query, run, saveDb };
