const TaskModel = require('../models/taskModel');
const ExecutionHistoryModel = require('../models/executionHistoryModel');
const TopologyService = require('./topologyService');

const ExecutionService = {
  startTask: (taskId, callback) => {
    TaskModel.findById(taskId, (err, task) => {
      if (err) return callback(err);
      if (!task) return callback(null, { error: 'Task not found' });

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
          
          ExecutionHistoryModel.create(taskId, 'running', (err, history) => {
            if (err) return callback(err);
            callback(null, { task: updatedTask, history });
          });
        });
      });
    });
  },

  completeTask: (taskId, callback) => {
    TaskModel.updateStatus(taskId, 'completed', (err, updatedTask) => {
      if (err) return callback(err);
      if (!updatedTask) return callback(null, { error: 'Task not found' });

      ExecutionHistoryModel.getLatestByTaskId(taskId, (err, latestHistory) => {
        if (err) return callback(err);
        
        if (latestHistory) {
          ExecutionHistoryModel.update(latestHistory.id, {
            status: 'completed',
            completedAt: new Date().toISOString()
          }, () => {});
        }

        TaskModel.getDependents(taskId, (err, dependents) => {
          if (err) return callback(err);
          callback(null, { task: updatedTask, affectedDependents: dependents });
        });
      });
    });
  },

  failTask: (taskId, errorMessage, callback) => {
    TaskModel.updateStatus(taskId, 'failed', (err, updatedTask) => {
      if (err) return callback(err);
      if (!updatedTask) return callback(null, { error: 'Task not found' });

      ExecutionHistoryModel.getLatestByTaskId(taskId, (err, latestHistory) => {
        if (err) return callback(err);
        
        if (latestHistory) {
          ExecutionHistoryModel.update(latestHistory.id, {
            status: 'failed',
            completedAt: new Date().toISOString(),
            errorMessage
          }, () => {});
        }

        ExecutionService.propagateBlock(taskId, (err, blockedTasks) => {
          if (err) return callback(err);
          callback(null, { task: updatedTask, blockedTasks });
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
                
                ExecutionHistoryModel.create(dependent.id, 'blocked', (err, history) => {
                  if (err) console.error('Failed to create history:', err);
                  
                  ExecutionHistoryModel.getLatestByTaskId(dependent.id, (err, latestHistory) => {
                    if (err) console.error('Failed to get latest history:', err);
                    
                    if (latestHistory && latestHistory.status !== 'blocked') {
                      ExecutionHistoryModel.update(latestHistory.id, {
                        status: 'blocked',
                        completedAt: new Date().toISOString(),
                        errorMessage: 'Blocked due to upstream task failure'
                      }, () => {});
                    }
                    
                    blockDependents(dependent.id, (err) => {
                      if (err) return done(err);
                      processed++;
                      if (processed === total) done(null);
                    });
                  });
                });
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
