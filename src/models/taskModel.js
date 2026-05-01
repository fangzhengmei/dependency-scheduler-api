const db = require('../database/db');

const TaskModel = {
  create: (name, description, callback) => {
    db.run(
      'INSERT INTO tasks (name, description) VALUES (?, ?)',
      [name, description],
      function(err) {
        if (err) return callback(err);
        callback(null, { id: this.lastID, name, description, status: 'pending' });
      }
    );
  },

  findById: (id, callback) => {
    db.get('SELECT * FROM tasks WHERE id = ?', [id], callback);
  },

  findAll: (callback) => {
    db.all('SELECT * FROM tasks ORDER BY created_at', callback);
  },

  update: (id, updates, callback) => {
    const { name, description, status } = updates;
    db.run(
      'UPDATE tasks SET name = ?, description = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [name, description, status, id],
      function(err) {
        if (err) return callback(err);
        if (this.changes === 0) return callback(null, null);
        TaskModel.findById(id, callback);
      }
    );
  },

  updateStatus: (id, status, callback) => {
    db.run(
      'UPDATE tasks SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [status, id],
      function(err) {
        if (err) return callback(err);
        if (this.changes === 0) return callback(null, null);
        TaskModel.findById(id, callback);
      }
    );
  },

  delete: (id, callback) => {
    db.run('DELETE FROM tasks WHERE id = ?', [id], function(err) {
      if (err) return callback(err);
      callback(null, this.changes > 0);
    });
  },

  addDependency: (taskId, dependentTaskId, callback) => {
    db.run(
      'INSERT INTO dependencies (task_id, dependent_task_id) VALUES (?, ?)',
      [taskId, dependentTaskId],
      function(err) {
        if (err) {
          if (err.code === 'SQLITE_CONSTRAINT') {
            return callback(null, { exists: true });
          }
          return callback(err);
        }
        callback(null, { id: this.lastID, taskId, dependentTaskId, exists: false });
      }
    );
  },

  removeDependency: (taskId, dependentTaskId, callback) => {
    db.run(
      'DELETE FROM dependencies WHERE task_id = ? AND dependent_task_id = ?',
      [taskId, dependentTaskId],
      function(err) {
        if (err) return callback(err);
        callback(null, this.changes > 0);
      }
    );
  },

  getDependencies: (taskId, callback) => {
    db.all(
      'SELECT t.* FROM tasks t JOIN dependencies d ON t.id = d.dependent_task_id WHERE d.task_id = ?',
      [taskId],
      callback
    );
  },

  getDependents: (taskId, callback) => {
    db.all(
      'SELECT t.* FROM tasks t JOIN dependencies d ON t.id = d.task_id WHERE d.dependent_task_id = ?',
      [taskId],
      callback
    );
  },

  getAllDependencies: (callback) => {
    db.all('SELECT * FROM dependencies', callback);
  },

  getAllTasksWithDependencies: (callback) => {
    db.all('SELECT * FROM tasks', (err, tasks) => {
      if (err) return callback(err);
      
      const tasksMap = new Map();
      tasks.forEach(task => {
        tasksMap.set(task.id, { ...task, dependencies: [], dependents: [] });
      });

      db.all('SELECT * FROM dependencies', (err, dependencies) => {
        if (err) return callback(err);
        
        dependencies.forEach(dep => {
          const task = tasksMap.get(dep.task_id);
          const dependentTask = tasksMap.get(dep.dependent_task_id);
          
          if (task && dependentTask) {
            task.dependencies.push(dependentTask.id);
            dependentTask.dependents.push(task.id);
          }
        });

        callback(null, Array.from(tasksMap.values()));
      });
    });
  }
};

module.exports = TaskModel;
