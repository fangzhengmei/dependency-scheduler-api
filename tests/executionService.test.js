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
        ExecutionService.startTask(task.id, (err) => {
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
                ExecutionService.startTask(taskA.id, (err) => {
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
                    
                    ExecutionService.startTask(taskA.id, (err) => {
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

  describe('status transition validation', () => {
    it('should NOT complete a task directly from pending state', (done) => {
      TaskModel.create('Pending Task', '', (err, task) => {
        expect(err).toBeNull();
        expect(task.status).toBe('pending');
        
        ExecutionService.completeTask(task.id, (err, result) => {
          expect(err).toBeNull();
          expect(result.error).toContain('Cannot complete task from status');
          expect(result.error).toContain('pending');
          expect(result.currentStatus).toBe('pending');
          
          TaskModel.findById(task.id, (err, updatedTask) => {
            expect(err).toBeNull();
            expect(updatedTask.status).toBe('pending');
            done();
          });
        });
      });
    });

    it('should NOT fail a task directly from pending state', (done) => {
      TaskModel.create('Pending Task', '', (err, task) => {
        expect(err).toBeNull();
        expect(task.status).toBe('pending');
        
        ExecutionService.failTask(task.id, 'Test failure', (err, result) => {
          expect(err).toBeNull();
          expect(result.error).toContain('Cannot fail task from status');
          expect(result.error).toContain('pending');
          expect(result.currentStatus).toBe('pending');
          
          TaskModel.findById(task.id, (err, updatedTask) => {
            expect(err).toBeNull();
            expect(updatedTask.status).toBe('pending');
            done();
          });
        });
      });
    });

    it('should NOT complete a task directly from completed state', (done) => {
      TaskModel.create('Completed Task', '', (err, task) => {
        TaskModel.updateStatus(task.id, 'completed', (err) => {
          expect(err).toBeNull();
          
          ExecutionService.completeTask(task.id, (err, result) => {
            expect(err).toBeNull();
            expect(result.error).toContain('Cannot complete task from status');
            expect(result.currentStatus).toBe('completed');
            done();
          });
        });
      });
    });

    it('should NOT complete a task directly from failed state', (done) => {
      TaskModel.create('Failed Task', '', (err, task) => {
        TaskModel.updateStatus(task.id, 'failed', (err) => {
          expect(err).toBeNull();
          
          ExecutionService.completeTask(task.id, (err, result) => {
            expect(err).toBeNull();
            expect(result.error).toContain('Cannot complete task from status');
            expect(result.currentStatus).toBe('failed');
            done();
          });
        });
      });
    });

    it('should follow correct flow: pending -> running -> completed', (done) => {
      TaskModel.create('Flow Task', '', (err, task) => {
        expect(err).toBeNull();
        expect(task.status).toBe('pending');
        
        ExecutionService.startTask(task.id, (err, result) => {
          expect(err).toBeNull();
          expect(result.task.status).toBe('running');
          
          ExecutionService.completeTask(task.id, (err, result) => {
            expect(err).toBeNull();
            expect(result.task.status).toBe('completed');
            
            TaskModel.findById(task.id, (err, finalTask) => {
              expect(err).toBeNull();
              expect(finalTask.status).toBe('completed');
              done();
            });
          });
        });
      });
    });

    it('should follow correct flow: pending -> running -> failed', (done) => {
      TaskModel.create('Flow Task', '', (err, task) => {
        expect(err).toBeNull();
        expect(task.status).toBe('pending');
        
        ExecutionService.startTask(task.id, (err, result) => {
          expect(err).toBeNull();
          expect(result.task.status).toBe('running');
          
          ExecutionService.failTask(task.id, 'Test failure', (err, result) => {
            expect(err).toBeNull();
            expect(result.task.status).toBe('failed');
            
            TaskModel.findById(task.id, (err, finalTask) => {
              expect(err).toBeNull();
              expect(finalTask.status).toBe('failed');
              done();
            });
          });
        });
      });
    });
  });

  describe('execution history integrity', () => {
    it('should create a new history entry for each status change', (done) => {
      TaskModel.create('History Integrity', '', (err, task) => {
        expect(err).toBeNull();
        
        ExecutionService.startTask(task.id, (err) => {
          expect(err).toBeNull();
          
          ExecutionService.completeTask(task.id, (err) => {
            expect(err).toBeNull();
            
            ExecutionHistoryModel.findByTaskId(task.id, (err, history) => {
              expect(err).toBeNull();
              expect(history.length).toBe(2);
              
              const runningEntry = history.find(h => h.status === 'running');
              const completedEntry = history.find(h => h.status === 'completed');
              
              expect(runningEntry).toBeDefined();
              expect(completedEntry).toBeDefined();
              expect(completedEntry.completed_at).toBeDefined();
              done();
            });
          });
        });
      });
    });

    it('should create a new history entry when task fails', (done) => {
      TaskModel.create('Fail History', '', (err, task) => {
        ExecutionService.startTask(task.id, (err) => {
          ExecutionService.failTask(task.id, 'Test error', (err) => {
            expect(err).toBeNull();
            
            ExecutionHistoryModel.findByTaskId(task.id, (err, history) => {
              expect(err).toBeNull();
              expect(history.length).toBe(2);
              
              const failedEntry = history.find(h => h.status === 'failed');
              expect(failedEntry).toBeDefined();
              expect(failedEntry.error_message).toBe('Test error');
              expect(failedEntry.completed_at).toBeDefined();
              done();
            });
          });
        });
      });
    });

    it('should NOT create history entry when status transition is invalid', (done) => {
      TaskModel.create('Invalid Transition', '', (err, task) => {
        expect(err).toBeNull();
        expect(task.status).toBe('pending');
        
        ExecutionService.completeTask(task.id, 'Test', (err, result) => {
          expect(err).toBeNull();
          expect(result.error).toBeDefined();
          
          ExecutionHistoryModel.findByTaskId(task.id, (err, history) => {
            expect(err).toBeNull();
            expect(history.length).toBe(0);
            done();
          });
        });
      });
    });

    it('should create history entries for blocked tasks during failure propagation', (done) => {
      TaskModel.create('Task A', '', (err, taskA) => {
        TaskModel.create('Task B', 'Depends on A', (err, taskB) => {
          TaskModel.create('Task C', 'Depends on B', (err, taskC) => {
            TaskModel.addDependency(taskB.id, taskA.id, (err) => {
              TaskModel.addDependency(taskC.id, taskB.id, (err) => {
                ExecutionService.startTask(taskA.id, (err) => {
                  ExecutionService.failTask(taskA.id, 'Test failure', (err, result) => {
                    expect(err).toBeNull();
                    expect(result.blockedTasks.length).toBeGreaterThan(0);
                    
                    ExecutionHistoryModel.findByTaskId(taskB.id, (err, historyB) => {
                      expect(err).toBeNull();
                      expect(historyB.length).toBe(1);
                      expect(historyB[0].status).toBe('blocked');
                      expect(historyB[0].error_message).toContain('Blocked due to upstream');
                      
                      ExecutionHistoryModel.findByTaskId(taskC.id, (err, historyC) => {
                        expect(err).toBeNull();
                        expect(historyC.length).toBe(1);
                        expect(historyC[0].status).toBe('blocked');
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

    it('should have complete history for full task lifecycle', (done) => {
      TaskModel.create('Full Lifecycle', '', (err, task) => {
        expect(err).toBeNull();
        
        ExecutionService.startTask(task.id, (err, startResult) => {
          expect(err).toBeNull();
          expect(startResult.history).toBeDefined();
          
          ExecutionService.completeTask(task.id, (err, completeResult) => {
            expect(err).toBeNull();
            expect(completeResult.history).toBeDefined();
            
            ExecutionHistoryModel.findByTaskId(task.id, (err, history) => {
              expect(err).toBeNull();
              expect(history.length).toBe(2);
              
              const statuses = history.map(h => h.status);
              expect(statuses).toContain('running');
              expect(statuses).toContain('completed');
              
              const completedEntry = history.find(h => h.status === 'completed');
              expect(completedEntry.started_at).toBeDefined();
              expect(completedEntry.completed_at).toBeDefined();
              done();
            });
          });
        });
      });
    });
  });
});
