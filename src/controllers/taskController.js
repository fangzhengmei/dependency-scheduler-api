const TaskModel = require('../models/taskModel');
const ExecutionHistoryModel = require('../models/executionHistoryModel');
const ExecutionService = require('../services/executionService');
const TopologyService = require('../services/topologyService');

const TaskController = {
  createTask: (req, res) => {
    const { name, description } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Task name is required' });
    }

    TaskModel.create(name, description || '', (err, task) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to create task', details: err.message });
      }
      res.status(201).json(task);
    });
  },

  getAllTasks: (req, res) => {
    TaskModel.getAllTasksWithDependencies((err, tasks) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to get tasks', details: err.message });
      }
      res.json(tasks);
    });
  },

  getTaskById: (req, res) => {
    const { id } = req.params;
    
    TaskModel.findById(id, (err, task) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to get task', details: err.message });
      }
      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }
      
      TaskModel.getDependencies(id, (err, dependencies) => {
        if (err) {
          return res.status(500).json({ error: 'Failed to get dependencies', details: err.message });
        }
        
        TaskModel.getDependents(id, (err, dependents) => {
          if (err) {
            return res.status(500).json({ error: 'Failed to get dependents', details: err.message });
          }
          
          res.json({
            ...task,
            dependencies: dependencies.map(d => d.id),
            dependents: dependents.map(d => d.id)
          });
        });
      });
    });
  },

  updateTask: (req, res) => {
    const { id } = req.params;
    const { name, description, status } = req.body;

    TaskModel.findById(id, (err, existingTask) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to get task', details: err.message });
      }
      if (!existingTask) {
        return res.status(404).json({ error: 'Task not found' });
      }

      const updates = {
        name: name || existingTask.name,
        description: description !== undefined ? description : existingTask.description,
        status: status || existingTask.status
      };

      TaskModel.update(id, updates, (err, updatedTask) => {
        if (err) {
          return res.status(500).json({ error: 'Failed to update task', details: err.message });
        }
        res.json(updatedTask);
      });
    });
  },

  deleteTask: (req, res) => {
    const { id } = req.params;
    
    TaskModel.delete(id, (err, deleted) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to delete task', details: err.message });
      }
      if (!deleted) {
        return res.status(404).json({ error: 'Task not found' });
      }
      res.status(204).send();
    });
  },

  addDependency: (req, res) => {
    const { taskId, dependentTaskId } = req.params;

    if (taskId === dependentTaskId) {
      return res.status(400).json({ error: 'A task cannot depend on itself' });
    }

    TaskModel.findById(taskId, (err, task) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to get task', details: err.message });
      }
      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }

      TaskModel.findById(dependentTaskId, (err, dependentTask) => {
        if (err) {
          return res.status(500).json({ error: 'Failed to get dependent task', details: err.message });
        }
        if (!dependentTask) {
          return res.status(404).json({ error: 'Dependent task not found' });
        }

        TaskModel.addDependency(taskId, dependentTaskId, (err, result) => {
          if (err) {
            return res.status(500).json({ error: 'Failed to add dependency', details: err.message });
          }
          
          TopologyService.checkForCycles((err, hasCycle) => {
            if (err) {
              TaskModel.removeDependency(taskId, dependentTaskId, () => {});
              return res.status(500).json({ error: 'Failed to check for cycles', details: err.message });
            }
            
            if (hasCycle) {
              TaskModel.removeDependency(taskId, dependentTaskId, () => {});
              return res.status(400).json({ error: 'Adding this dependency would create a cycle' });
            }
            
            res.status(201).json({
              taskId: parseInt(taskId),
              dependentTaskId: parseInt(dependentTaskId),
              existed: result.exists
            });
          });
        });
      });
    });
  },

  removeDependency: (req, res) => {
    const { taskId, dependentTaskId } = req.params;

    TaskModel.removeDependency(taskId, dependentTaskId, (err, removed) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to remove dependency', details: err.message });
      }
      if (!removed) {
        return res.status(404).json({ error: 'Dependency not found' });
      }
      res.status(204).send();
    });
  },

  startTask: (req, res) => {
    const { id } = req.params;
    
    ExecutionService.startTask(id, (err, result) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to start task', details: err.message });
      }
      if (result.error) {
        return res.status(400).json(result);
      }
      res.json(result);
    });
  },

  completeTask: (req, res) => {
    const { id } = req.params;
    
    ExecutionService.completeTask(id, (err, result) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to complete task', details: err.message });
      }
      if (result.error) {
        return res.status(404).json(result);
      }
      res.json(result);
    });
  },

  failTask: (req, res) => {
    const { id } = req.params;
    const { errorMessage } = req.body;
    
    ExecutionService.failTask(id, errorMessage || 'Task failed', (err, result) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to mark task as failed', details: err.message });
      }
      if (result.error) {
        return res.status(404).json(result);
      }
      res.json(result);
    });
  },

  getExecutableQueue: (req, res) => {
    ExecutionService.getExecutableTasks((err, result) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to get executable queue', details: err.message });
      }
      res.json(result);
    });
  },

  getTaskHistory: (req, res) => {
    const { id } = req.params;
    
    ExecutionHistoryModel.findByTaskId(id, (err, history) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to get task history', details: err.message });
      }
      res.json(history);
    });
  },

  getAllHistory: (req, res) => {
    const { taskId, status, limit, offset } = req.query;
    
    const options = {};
    if (taskId) options.taskId = parseInt(taskId);
    if (status) options.status = status;
    if (limit) options.limit = parseInt(limit);
    if (offset) options.offset = parseInt(offset);
    
    ExecutionHistoryModel.findAll(options, (err, history) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to get execution history', details: err.message });
      }
      res.json(history);
    });
  }
};

module.exports = TaskController;
