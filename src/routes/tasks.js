const express = require('express');
const TaskController = require('../controllers/taskController');

const router = express.Router();

router.get('/', TaskController.getAllTasks);
router.post('/', TaskController.createTask);

router.get('/executable-queue', TaskController.getExecutableQueue);

router.get('/history', TaskController.getAllHistory);

router.get('/:id', TaskController.getTaskById);
router.put('/:id', TaskController.updateTask);
router.delete('/:id', TaskController.deleteTask);

router.post('/:id/start', TaskController.startTask);
router.post('/:id/complete', TaskController.completeTask);
router.post('/:id/fail', TaskController.failTask);

router.get('/:id/history', TaskController.getTaskHistory);

router.post('/:taskId/dependencies/:dependentTaskId', TaskController.addDependency);
router.delete('/:taskId/dependencies/:dependentTaskId', TaskController.removeDependency);

module.exports = router;
