const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = process.env.NODE_ENV === 'test' 
  ? path.join(__dirname, '..', '..', 'test.db')
  : path.join(__dirname, '..', '..', 'tasks.db');

const db = new sqlite3.Database(dbPath);

function initDatabase(callback) {
  db.serialize(() => {
    db.run(`
      CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        status TEXT DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS dependencies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id INTEGER NOT NULL,
        dependent_task_id INTEGER NOT NULL,
        FOREIGN KEY (task_id) REFERENCES tasks (id),
        FOREIGN KEY (dependent_task_id) REFERENCES tasks (id),
        UNIQUE (task_id, dependent_task_id)
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS execution_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id INTEGER NOT NULL,
        status TEXT NOT NULL,
        started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        completed_at DATETIME,
        error_message TEXT,
        FOREIGN KEY (task_id) REFERENCES tasks (id)
      )
    `, callback);
  });
}

db.initDatabase = initDatabase;

initDatabase((err) => {
  if (err) {
    console.error('Failed to initialize database:', err);
  }
});

module.exports = db;
