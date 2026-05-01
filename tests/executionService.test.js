require('./setup');
const TaskModel = require('../src/models/taskModel');
const ExecutionHistoryModel = require('../src/models/executionHistoryModel');
const ExecutionService = require('../src/services/executionService');

describe('ExecutionService', () => {
  describe('startTask', () => {
    it('should start a task with no dependencies', (done) => {
      TaskModel.create('Task A', 'No dependencies', (err, task) => {
        expect(err).toBeNull();
        
        ExecutionService.startTask(task.id, (err, result) => {
          expect(err).toBeNull();
          expect(result.task.status).toBe('running');
          expect(result.history.status).toBe('running');
          done();
        });
      });
    });

    it('should not start a task with incomplete dependencies', (done) => {
      TaskModel.create('Task A', 'Dependency', (err, taskA) => {
        TaskModel.create('Task B', 'Depends on A', (err, taskB) => {
          TaskModel.addDependency(taskB.id, taskA.id, (err) => {
            expect(err).toBeNull();
            
            ExecutionService.startTask(taskB.id, (err, result) => {
              expect(err).toBeNull();
              expect(result.error).toBe('Task dependencies not yet completed');
              done();
            });
          });
        });
      });
    });

    it('should start a task with completed dependencies', (done) => {
      TaskModel.create('Task A', 'Dependency', (err, taskA) => {
        TaskModel.create('Task B', 'Depends on A', (err, taskB) => {
          TaskModel.addDependency(taskB.id, taskA.id, (err) => {
            TaskModel.updateStatus(taskA.id, 'completed', (err) => {
              expect(err).toBeNull();
              
              ExecutionService.startTask(taskB.id, (err, result) => {
                expect(err).toBeNull();
                expect(result.task.status).toBe('running');
                done();
              });
            });
          });
        });
      });
    });
  });

  describe('completeTask', () => {
    it('should complete a running task', (done) => {
      TaskModel.create('Task A', '', (err, task) => {
        TaskModel.updateStatus(task.id, 'running', (err) => {
          ExecutionService.completeTask(task.id, (err, result) => {
            expect(err).toBeNull();
            expect(result.task.status).toBe('completed');
            done();
          });
        });
      });
    });
  });

  describe('failTask', () => {
    it('should fail a task and propagate block to dependents', (done) => {
      TaskModel.create('Task A', '', (err, taskA) => {
        TaskModel.create('Task B', 'Depends on A', (err, taskB) => {
          TaskModel.create('Task C', 'Depends on B', (err, taskC) => {
            TaskModel.addDependency(taskB.id, taskA.id, (err) => {
              TaskModel.addDependency(taskC.id, taskB.id, (err) => {
                expect(err).toBeNull();
                
                ExecutionService.failTask(taskA.id, 'Test failure', (err, result) => {
                  expect(err).toBeNull();
                  expect(result.task.status).toBe('failed');
                  expect(result.blockedTasks.length).toBeGreaterThan(0);
                  
                  TaskModel.findById(taskB.id, (err, foundTaskB) => {
                    expect(err).toBeNull();
                    expect(foundTaskB.status).toBe('blocked');
                    
                    TaskModel.findById(taskC.id, (err, foundTaskC) => {
                      expect(err).toBeNull();
                      expect(foundTaskC.status).toBe('blocked');
                      done();
                    });
                  });
                });
              });
            });
          });
        });
      });
    });

    it('should not block already completed or failed tasks', (done) => {
      TaskModel.create('Task A', '', (err, taskA) => {
        TaskModel.create('Task B', 'Depends on A', (err, taskB) => {
          TaskModel.create('Task C', 'Depends on A', (err, taskC) => {
            TaskModel.addDependency(taskB.id, taskA.id, (err) => {
              TaskModel.addDependency(taskC.id, taskA.id, (err) => {
                TaskModel.updateStatus(taskB.id, 'completed', (err) => {
                  TaskModel.updateStatus(taskC.id, 'failed', (err) => {
                    expect(err).toBeNull();
                    
                    ExecutionService.failTask(taskA.id, 'Test failure', (err, result) => {
                      expect(err).toBeNull();
                      
                      TaskModel.findById(taskB.id, (err, foundTaskB) => {
                        expect(err).toBeNull();
                        expect(foundTaskB.status).toBe('completed');
                        
                        TaskModel.findById(taskC.id, (err, foundTaskC) => {
                          expect(err).toBeNull();
                          expect(foundTaskC.status).toBe('failed');
                          done();
                        });
                      });
                    });
                  });
                });
              });
            });
          });
        });
      });
    });
  });

  describe('execution history', () => {
    it('should create history entry when task starts', (done) => {
      TaskModel.create('History Test', '', (err, task) => {
        ExecutionService.startTask(task.id, (err, result) => {
          expect(err).toBeNull();
          
          ExecutionHistoryModel.findByTaskId(task.id, (err, history) => {
            expect(err).toBeNull();
            expect(history.length).toBeGreaterThan(0);
            expect(history[0].status).toBe('running');
            done();
          });
        });
      });
    });

    it('should update history when task completes', (done) => {
      TaskModel.create('Complete History', '', (err, task) => {
        ExecutionService.startTask(task.id, (err) => {
          ExecutionService.completeTask(task.id, (err) => {
            expect(err).toBeNull();
            
            ExecutionHistoryModel.findByTaskId(task.id, (err, history) => {
              expect(err).toBeNull();
              const completedEntry = history.find(h => h.status === 'completed');
              expect(completedEntry).toBeDefined();
              expect(completedEntry.completed_at).toBeDefined();
              done();
            });
          });
        });
      });
    });

    it('should update history with error when task fails', (done) => {
      TaskModel.create('Fail History', '', (err, task) => {
        ExecutionService.startTask(task.id, (err) => {
          ExecutionService.failTask(task.id, 'Test error message', (err) => {
            expect(err).toBeNull();
            
            ExecutionHistoryModel.findByTaskId(task.id, (err, history) => {
              expect(err).toBeNull();
              const failedEntry = history.find(h => h.status === 'failed');
              expect(failedEntry).toBeDefined();
              expect(failedEntry.error_message).toBe('Test error message');
              done();
            });
          });
        });
      });
    });
  });
});
