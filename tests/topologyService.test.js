require('./setup');
const TaskModel = require('../src/models/taskModel');
const TopologyService = require('../src/services/topologyService');

describe('TopologyService', () => {
  describe('topologicalSort', () => {
    it('should sort tasks with no dependencies', () => {
      const tasks = [
        { id: 1, dependencies: [] },
        { id: 2, dependencies: [] },
        { id: 3, dependencies: [] }
      ];

      const result = TopologyService.topologicalSort(tasks);
      expect(result.hasCycle).toBe(false);
      expect(result.order.length).toBe(3);
    });

    it('should sort tasks with linear dependencies', () => {
      const tasks = [
        { id: 1, dependencies: [] },
        { id: 2, dependencies: [1] },
        { id: 3, dependencies: [2] }
      ];

      const result = TopologyService.topologicalSort(tasks);
      expect(result.hasCycle).toBe(false);
      expect(result.order.indexOf(1)).toBeLessThan(result.order.indexOf(2));
      expect(result.order.indexOf(2)).toBeLessThan(result.order.indexOf(3));
    });

    it('should detect cycles', () => {
      const tasks = [
        { id: 1, dependencies: [2] },
        { id: 2, dependencies: [1] }
      ];

      const result = TopologyService.topologicalSort(tasks);
      expect(result.hasCycle).toBe(true);
      expect(result.order).toBeNull();
    });
  });

  describe('getExecutableQueue', () => {
    it('should return tasks with no dependencies as executable', (done) => {
      TaskModel.create('Task A', 'No dependencies', (err, taskA) => {
        expect(err).toBeNull();
        
        TopologyService.getExecutableQueue((err, result) => {
          expect(err).toBeNull();
          expect(result.hasCycle).toBe(false);
          expect(result.queue.some(t => t.id === taskA.id)).toBe(true);
          done();
        });
      });
    });

    it('should not return tasks with uncompleted dependencies', (done) => {
      TaskModel.create('Task A', 'Dependency', (err, taskA) => {
        TaskModel.create('Task B', 'Depends on A', (err, taskB) => {
          TaskModel.addDependency(taskB.id, taskA.id, (err) => {
            expect(err).toBeNull();
            
            TopologyService.getExecutableQueue((err, result) => {
              expect(err).toBeNull();
              expect(result.hasCycle).toBe(false);
              
              const taskAInQueue = result.queue.some(t => t.id === taskA.id);
              const taskBInQueue = result.queue.some(t => t.id === taskB.id);
              
              expect(taskAInQueue).toBe(true);
              expect(taskBInQueue).toBe(false);
              done();
            });
          });
        });
      });
    });

    it('should return tasks with completed dependencies', (done) => {
      TaskModel.create('Task A', 'Dependency', (err, taskA) => {
        TaskModel.create('Task B', 'Depends on A', (err, taskB) => {
          TaskModel.addDependency(taskB.id, taskA.id, (err) => {
            TaskModel.updateStatus(taskA.id, 'completed', (err) => {
              expect(err).toBeNull();
              
              TopologyService.getExecutableQueue((err, result) => {
                expect(err).toBeNull();
                const taskBInQueue = result.queue.some(t => t.id === taskB.id);
                expect(taskBInQueue).toBe(true);
                done();
              });
            });
          });
        });
      });
    });

    it('should detect cycles in database', (done) => {
      TaskModel.create('Task 1', '', (err, task1) => {
        TaskModel.create('Task 2', '', (err, task2) => {
          TaskModel.addDependency(task1.id, task2.id, (err) => {
            TaskModel.addDependency(task2.id, task1.id, (err) => {
              expect(err).toBeNull();
              
              TopologyService.checkForCycles((err, hasCycle) => {
                expect(err).toBeNull();
                expect(hasCycle).toBe(true);
                done();
              });
            });
          });
        });
      });
    });
  });
});
