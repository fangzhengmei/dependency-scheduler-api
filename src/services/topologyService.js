const TaskModel = require('../models/taskModel');

const TopologyService = {
  topologicalSort: (tasks) => {
    const inDegree = new Map();
    const adjacencyList = new Map();
    
    tasks.forEach(task => {
      inDegree.set(task.id, task.dependencies.length);
      adjacencyList.set(task.id, []);
    });

    tasks.forEach(task => {
      task.dependencies.forEach(depId => {
        if (adjacencyList.has(depId)) {
          adjacencyList.get(depId).push(task.id);
        }
      });
    });

    const queue = [];
    const result = [];

    inDegree.forEach((degree, taskId) => {
      if (degree === 0) {
        queue.push(taskId);
      }
    });

    while (queue.length > 0) {
      const current = queue.shift();
      result.push(current);

      const neighbors = adjacencyList.get(current) || [];
      neighbors.forEach(neighbor => {
        inDegree.set(neighbor, inDegree.get(neighbor) - 1);
        if (inDegree.get(neighbor) === 0) {
          queue.push(neighbor);
        }
      });
    }

    if (result.length !== tasks.length) {
      return { hasCycle: true, order: null };
    }

    return { hasCycle: false, order: result };
  },

  getExecutableQueue: (callback) => {
    TaskModel.getAllTasksWithDependencies((err, tasks) => {
      if (err) return callback(err);

      const { hasCycle, order } = TopologyService.topologicalSort(tasks);
      
      if (hasCycle) {
        return callback(null, { hasCycle: true, queue: [] });
      }

      const tasksMap = new Map();
      tasks.forEach(task => tasksMap.set(task.id, task));

      const executableQueue = order
        .map(taskId => tasksMap.get(taskId))
        .filter(task => {
          if (task.status === 'completed' || task.status === 'failed' || task.status === 'blocked') {
            return false;
          }
          
          const dependencies = task.dependencies || [];
          return dependencies.every(depId => {
            const depTask = tasksMap.get(depId);
            return depTask && depTask.status === 'completed';
          });
        });

      callback(null, { hasCycle: false, queue: executableQueue });
    });
  },

  checkForCycles: (callback) => {
    TaskModel.getAllTasksWithDependencies((err, tasks) => {
      if (err) return callback(err);
      const { hasCycle } = TopologyService.topologicalSort(tasks);
      callback(null, hasCycle);
    });
  }
};

module.exports = TopologyService;
