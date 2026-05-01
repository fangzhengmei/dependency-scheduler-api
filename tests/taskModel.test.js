require('./setup');
const TaskModel = require('../src/models/taskModel');

describe('TaskModel', () => {
  describe('create', () => {
    it('should create a new task', (done) => {
      TaskModel.create('Test Task', 'Test Description', (err, task) => {
        expect(err).toBeNull();
        expect(task).toHaveProperty('id');
        expect(task.name).toBe('Test Task');
        expect(task.description).toBe('Test Description');
        expect(task.status).toBe('pending');
        done();
      });
    });
  });

  describe('findById', () => {
    it('should find a task by id', (done) => {
      TaskModel.create('Find Test', 'Find Description', (err, createdTask) => {
        expect(err).toBeNull();
        
        TaskModel.findById(createdTask.id, (err, foundTask) => {
          expect(err).toBeNull();
          expect(foundTask.id).toBe(createdTask.id);
          expect(foundTask.name).toBe('Find Test');
          done();
        });
      });
    });

    it('should return null for non-existent task', (done) => {
      TaskModel.findById(9999, (err, task) => {
        expect(err).toBeNull();
        expect(task).toBeUndefined();
        done();
      });
    });
  });

  describe('findAll', () => {
    it('should find all tasks', (done) => {
      TaskModel.create('Task 1', 'Desc 1', (err) => {
        expect(err).toBeNull();
        
        TaskModel.create('Task 2', 'Desc 2', (err) => {
          expect(err).toBeNull();
          
          TaskModel.findAll((err, tasks) => {
            expect(err).toBeNull();
            expect(tasks.length).toBeGreaterThanOrEqual(2);
            done();
          });
        });
      });
    });
  });

  describe('update', () => {
    it('should update a task', (done) => {
      TaskModel.create('Old Name', 'Old Description', (err, createdTask) => {
        expect(err).toBeNull();
        
        TaskModel.update(createdTask.id, {
          name: 'New Name',
          description: 'New Description',
          status: 'running'
        }, (err, updatedTask) => {
          expect(err).toBeNull();
          expect(updatedTask.name).toBe('New Name');
          expect(updatedTask.description).toBe('New Description');
          expect(updatedTask.status).toBe('running');
          done();
        });
      });
    });
  });

  describe('delete', () => {
    it('should delete a task', (done) => {
      TaskModel.create('Delete Test', 'Delete Description', (err, createdTask) => {
        expect(err).toBeNull();
        
        TaskModel.delete(createdTask.id, (err, deleted) => {
          expect(err).toBeNull();
          expect(deleted).toBe(true);
          
          TaskModel.findById(createdTask.id, (err, task) => {
            expect(err).toBeNull();
            expect(task).toBeUndefined();
            done();
          });
        });
      });
    });
  });

  describe('dependencies', () => {
    it('should add and retrieve dependencies', (done) => {
      TaskModel.create('Task A', 'Depends on B', (err, taskA) => {
        expect(err).toBeNull();
        
        TaskModel.create('Task B', 'Dependency', (err, taskB) => {
          expect(err).toBeNull();
          
          TaskModel.addDependency(taskA.id, taskB.id, (err, result) => {
            expect(err).toBeNull();
            expect(result.exists).toBe(false);
            
            TaskModel.getDependencies(taskA.id, (err, dependencies) => {
              expect(err).toBeNull();
              expect(dependencies.length).toBe(1);
              expect(dependencies[0].id).toBe(taskB.id);
              done();
            });
          });
        });
      });
    });

    it('should get dependents', (done) => {
      TaskModel.create('Task X', 'Dependent', (err, taskX) => {
        expect(err).toBeNull();
        
        TaskModel.create('Task Y', 'Depends on X', (err, taskY) => {
          expect(err).toBeNull();
          
          TaskModel.addDependency(taskY.id, taskX.id, (err) => {
            expect(err).toBeNull();
            
            TaskModel.getDependents(taskX.id, (err, dependents) => {
              expect(err).toBeNull();
              expect(dependents.length).toBe(1);
              expect(dependents[0].id).toBe(taskY.id);
              done();
            });
          });
        });
      });
    });

    it('should remove dependency', (done) => {
      TaskModel.create('Task 1', '', (err, task1) => {
        TaskModel.create('Task 2', '', (err, task2) => {
          TaskModel.addDependency(task1.id, task2.id, (err) => {
            expect(err).toBeNull();
            
            TaskModel.removeDependency(task1.id, task2.id, (err, removed) => {
              expect(err).toBeNull();
              expect(removed).toBe(true);
              
              TaskModel.getDependencies(task1.id, (err, dependencies) => {
                expect(err).toBeNull();
                expect(dependencies.length).toBe(0);
                done();
              });
            });
          });
        });
      });
    });
  });
});
