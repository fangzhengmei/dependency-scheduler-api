const db = require('../database/db');

const ExecutionHistoryModel = {
  create: (taskId, status, callback) => {
    db.run(
      'INSERT INTO execution_history (task_id, status) VALUES (?, ?)',
      [taskId, status],
      function(err) {
        if (err) return callback(err);
        callback(null, { 
          id: this.lastID, 
          taskId, 
          status, 
          startedAt: new Date().toISOString() 
        });
      }
    );
  },

  update: (id, updates, callback) => {
    const { status, completedAt, errorMessage } = updates;
    db.run(
      'UPDATE execution_history SET status = ?, completed_at = ?, error_message = ? WHERE id = ?',
      [status, completedAt, errorMessage, id],
      function(err) {
        if (err) return callback(err);
        if (this.changes === 0) return callback(null, null);
        ExecutionHistoryModel.findById(id, callback);
      }
    );
  },

  findById: (id, callback) => {
    db.get('SELECT * FROM execution_history WHERE id = ?', [id], callback);
  },

  findByTaskId: (taskId, callback) => {
    db.all(
      'SELECT * FROM execution_history WHERE task_id = ? ORDER BY started_at DESC',
      [taskId],
      callback
    );
  },

  findAll: (options = {}, callback) => {
    const { taskId, status, limit, offset } = options;
    let query = 'SELECT * FROM execution_history WHERE 1=1';
    const params = [];

    if (taskId) {
      query += ' AND task_id = ?';
      params.push(taskId);
    }

    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }

    query += ' ORDER BY started_at DESC';

    if (limit) {
      query += ' LIMIT ?';
      params.push(limit);
    }

    if (offset) {
      query += ' OFFSET ?';
      params.push(offset);
    }

    db.all(query, params, callback);
  },

  getLatestByTaskId: (taskId, callback) => {
    db.get(
      'SELECT * FROM execution_history WHERE task_id = ? ORDER BY started_at DESC LIMIT 1',
      [taskId],
      callback
    );
  }
};

module.exports = ExecutionHistoryModel;
