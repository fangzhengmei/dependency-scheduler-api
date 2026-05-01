const TaskModel = require('../models/taskModel');
const ExecutionHistoryModel = require('../models/executionHistoryModel');
const TopologyService = require('./topologyService');

const VALID_TRANSITIONS = {
  pending: ['running'],
  running: ['completed', 'failed'],
  completed: [],
  failed: [],
  blocked: ['pending']
};

const ExecutionService = {
  canTransition: (currentStatus, targetStatus) => {
    const validTransitions = VALID_TRANSITIONS[currentStatus] || [];
    return validTransitions.includes(targetStatus);
  },

  createHistoryEntry: (taskId, status, errorMessage, callback) => {
    ExecutionHistoryModel.create(taskId, status, (err, history) => {
      if (err) return callback(err);
      
      if (status === 'completed' || status === 'failed' || status === 'blocked') {
        ExecutionHistoryModel.update(history.id, {
          status,
          completedAt: new Date().toISOString(),
          errorMessage
        }, (err, updatedHistory) => {
          if (err) return callback(err);
          callback(null, updatedHistory);
        });
      } else {
        callback(null, history);
      }
    });
  },

  startTask: (taskId, callback) => {
    TaskModel.findById(taskId, (err, task) => {
      if (err) return callback(err);
      if (!task) return callback(null, { error: 'Task not found' });

      if (!ExecutionService.canTransition(task.status, 'running')) {
        return callback(null, { 
          error: `Cannot start task from status '${task.status}'`,
          currentStatus: task.status 
        });
      }

      TaskModel.getDependencies(taskId, (err, dependencies) => {
        if (err) return callback(err);

        const failedDeps = dependencies.filter(dep => dep.status === 'failed');
        if (failedDeps.length > 0) {
          return callback(null, { 
            error: 'Task is blocked due to failed dependencies',
            failedDependencies: failedDeps 
          });
        }

        const incompleteDeps = dependencies.filter(dep => dep.status !== 'completed');
        if (incompleteDeps.length > 0) {
          return callback(null, { 
            error: 'Task dependencies not yet completed',
            incompleteDependencies: incompleteDeps 
          });
        }

        TaskModel.updateStatus(taskId, 'running', (err, updatedTask) => {
          if (err) return callback(err);
          
          ExecutionService.createHistoryEntry(taskId, 'running', null, (err, history) => {
            if (err) return callback(err);
            callback(null, { task: updatedTask, history });
          });
        });
      });
    });
  },

  completeTask: (taskId, callback) => {
    TaskModel.findById(taskId, (err, task) => {
      if (err) return callback(err);
      if (!task) return callback(null, { error: 'Task not found' });

      if (!ExecutionService.canTransition(task.status, 'completed')) {
        return callback(null, { 
          error: `Cannot complete task from status '${task.status}'. Task must be 'running' first.`,
          currentStatus: task.status 
        });
      }

      TaskModel.updateStatus(taskId, 'completed', (err, updatedTask) => {
        if (err) return callback(err);

        ExecutionService.createHistoryEntry(taskId, 'completed', null, (err, history) => {
          if (err) return callback(err);

          TaskModel.getDependents(taskId, (err, dependents) => {
            if (err) return callback(err);
            callback(null, { task: updatedTask, history, affectedDependents: dependents });
          });
        });
      });
    });
  },

  failTask: (taskId, errorMessage, callback) => {
    TaskModel.findById(taskId, (err, task) => {
      if (err) return callback(err);
      if (!task) return callback(null, { error: 'Task not found' });

      if (!ExecutionService.canTransition(task.status, 'failed')) {
        return callback(null, { 
          error: `Cannot fail task from status '${task.status}'. Task must be 'running' first.`,
          currentStatus: task.status 
        });
      }

      TaskModel.updateStatus(taskId, 'failed', (err, updatedTask) => {
        if (err) return callback(err);

        ExecutionService.createHistoryEntry(taskId, 'failed', errorMessage || 'Task failed', (err, history) => {
          if (err) return callback(err);

          ExecutionService.propagateBlock(taskId, (err, blockedTasks) => {
            if (err) return callback(err);
            callback(null, { task: updatedTask, history, blockedTasks });
          });
        });
      });
    });
  },

  propagateBlock: (failedTaskId, callback) => {
    const blockedTasks = [];
    
    const blockDependents = (taskId, done) => {
      TaskModel.getDependents(taskId, (err, dependents) => {
        if (err) return done(err);
        
        if (dependents.length === 0) return done(null);

        let processed = 0;
        const total = dependents.length;

        dependents.forEach(dependent => {
          if (dependent.status === 'pending' || dependent.status === 'running') {
            TaskModel.updateStatus(dependent.id, 'blocked', (err, blockedTask) => {
              if (err) return done(err);
              
              if (blockedTask) {
                blockedTasks.push(blockedTask);
                
                ExecutionService.createHistoryEntry(
                  dependent.id, 
                  'blocked', 
                  'Blocked due to upstream task failure',
                  (err, history) => {
                    if (err) console.error('Failed to create history:', err);
                    
                    blockDependents(dependent.id, (err) => {
                      if (err) return done(err);
                      processed++;
                      if (processed === total) done(null);
                    });
                  }
                );
              } else {
                processed++;
                if (processed === total) done(null);
              }
            });
          } else {
            processed++;
            if (processed === total) done(null);
          }
        });
      });
    };

    blockDependents(failedTaskId, (err) => {
      if (err) return callback(err);
      callback(null, blockedTasks);
    });
  },

  getExecutableTasks: (callback) => {
    TopologyService.getExecutableQueue(callback);
  }
};

module.exports = ExecutionService;
