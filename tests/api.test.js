require('./setup');
const request = require('supertest');
const app = require('../src/app');

describe('API Routes', () => {
  describe('GET /health', () => {
    it('should return health status', async () => {
      const response = await request(app).get('/health');
      expect(response.statusCode).toBe(200);
      expect(response.body.status).toBe('ok');
      expect(response.body.timestamp).toBeDefined();
    });
  });

  describe('Tasks CRUD', () => {
    it('should create a new task', async () => {
      const response = await request(app)
        .post('/api/tasks')
        .send({ name: 'Test Task', description: 'Test Description' });
      
      expect(response.statusCode).toBe(201);
      expect(response.body.name).toBe('Test Task');
      expect(response.body.description).toBe('Test Description');
      expect(response.body.status).toBe('pending');
    });

    it('should get all tasks', async () => {
      await request(app)
        .post('/api/tasks')
        .send({ name: 'Task 1', description: 'Desc 1' });
      
      await request(app)
        .post('/api/tasks')
        .send({ name: 'Task 2', description: 'Desc 2' });

      const response = await request(app).get('/api/tasks');
      expect(response.statusCode).toBe(200);
      expect(response.body.length).toBeGreaterThanOrEqual(2);
    });

    it('should get a task by id', async () => {
      const createResponse = await request(app)
        .post('/api/tasks')
        .send({ name: 'Get Test', description: 'Get Desc' });
      
      const taskId = createResponse.body.id;
      const response = await request(app).get(`/api/tasks/${taskId}`);
      
      expect(response.statusCode).toBe(200);
      expect(response.body.name).toBe('Get Test');
      expect(response.body.dependencies).toBeDefined();
      expect(response.body.dependents).toBeDefined();
    });

    it('should update a task', async () => {
      const createResponse = await request(app)
        .post('/api/tasks')
        .send({ name: 'Old Name', description: 'Old Desc' });
      
      const taskId = createResponse.body.id;
      const response = await request(app)
        .put(`/api/tasks/${taskId}`)
        .send({ name: 'New Name', description: 'New Desc', status: 'running' });
      
      expect(response.statusCode).toBe(200);
      expect(response.body.name).toBe('New Name');
      expect(response.body.description).toBe('New Desc');
      expect(response.body.status).toBe('running');
    });

    it('should delete a task', async () => {
      const createResponse = await request(app)
        .post('/api/tasks')
        .send({ name: 'Delete Test', description: 'Delete Desc' });
      
      const taskId = createResponse.body.id;
      const deleteResponse = await request(app).delete(`/api/tasks/${taskId}`);
      expect(deleteResponse.statusCode).toBe(204);

      const getResponse = await request(app).get(`/api/tasks/${taskId}`);
      expect(getResponse.statusCode).toBe(404);
    });
  });

  describe('Dependencies', () => {
    it('should add a dependency between tasks', async () => {
      const taskAResponse = await request(app)
        .post('/api/tasks')
        .send({ name: 'Task A' });
      
      const taskBResponse = await request(app)
        .post('/api/tasks')
        .send({ name: 'Task B' });

      const taskAId = taskAResponse.body.id;
      const taskBId = taskBResponse.body.id;

      const response = await request(app)
        .post(`/api/tasks/${taskAId}/dependencies/${taskBId}`);
      
      expect(response.statusCode).toBe(201);
      expect(response.body.taskId).toBe(taskAId);
      expect(response.body.dependentTaskId).toBe(taskBId);
    });

    it('should reject self-dependency', async () => {
      const createResponse = await request(app)
        .post('/api/tasks')
        .send({ name: 'Self Task' });
      
      const taskId = createResponse.body.id;
      const response = await request(app)
        .post(`/api/tasks/${taskId}/dependencies/${taskId}`);
      
      expect(response.statusCode).toBe(400);
      expect(response.body.error).toBe('A task cannot depend on itself');
    });

    it('should reject cyclic dependencies', async () => {
      const taskAResponse = await request(app)
        .post('/api/tasks')
        .send({ name: 'Task A' });
      
      const taskBResponse = await request(app)
        .post('/api/tasks')
        .send({ name: 'Task B' });

      const taskAId = taskAResponse.body.id;
      const taskBId = taskBResponse.body.id;

      await request(app)
        .post(`/api/tasks/${taskAId}/dependencies/${taskBId}`);

      const response = await request(app)
        .post(`/api/tasks/${taskBId}/dependencies/${taskAId}`);
      
      expect(response.statusCode).toBe(400);
      expect(response.body.error).toBe('Adding this dependency would create a cycle');
    });

    it('should remove a dependency', async () => {
      const taskAResponse = await request(app)
        .post('/api/tasks')
        .send({ name: 'Task A' });
      
      const taskBResponse = await request(app)
        .post('/api/tasks')
        .send({ name: 'Task B' });

      const taskAId = taskAResponse.body.id;
      const taskBId = taskBResponse.body.id;

      await request(app)
        .post(`/api/tasks/${taskAId}/dependencies/${taskBId}`);

      const removeResponse = await request(app)
        .delete(`/api/tasks/${taskAId}/dependencies/${taskBId}`);
      
      expect(removeResponse.statusCode).toBe(204);
    });
  });

  describe('Execution', () => {
    it('should start a task', async () => {
      const createResponse = await request(app)
        .post('/api/tasks')
        .send({ name: 'Start Test' });
      
      const taskId = createResponse.body.id;
      const response = await request(app)
        .post(`/api/tasks/${taskId}/start`);
      
      expect(response.statusCode).toBe(200);
      expect(response.body.task.status).toBe('running');
    });

    it('should complete a task', async () => {
      const createResponse = await request(app)
        .post('/api/tasks')
        .send({ name: 'Complete Test' });
      
      const taskId = createResponse.body.id;
      await request(app).post(`/api/tasks/${taskId}/start`);
      
      const response = await request(app)
        .post(`/api/tasks/${taskId}/complete`);
      
      expect(response.statusCode).toBe(200);
      expect(response.body.task.status).toBe('completed');
    });

    it('should fail a task', async () => {
      const createResponse = await request(app)
        .post('/api/tasks')
        .send({ name: 'Fail Test' });
      
      const taskId = createResponse.body.id;
      await request(app).post(`/api/tasks/${taskId}/start`);
      
      const response = await request(app)
        .post(`/api/tasks/${taskId}/fail`)
        .send({ errorMessage: 'Test failure' });
      
      expect(response.statusCode).toBe(200);
      expect(response.body.task.status).toBe('failed');
    });
  });

  describe('Executable Queue', () => {
    it('should get executable queue', async () => {
      const response = await request(app).get('/api/tasks/executable-queue');
      expect(response.statusCode).toBe(200);
      expect(response.body.hasCycle).toBeDefined();
      expect(response.body.queue).toBeDefined();
    });

    it('should return tasks with no dependencies in queue', async () => {
      const createResponse = await request(app)
        .post('/api/tasks')
        .send({ name: 'Queue Test' });
      
      const taskId = createResponse.body.id;
      const response = await request(app).get('/api/tasks/executable-queue');
      
      expect(response.statusCode).toBe(200);
      const taskInQueue = response.body.queue.some(t => t.id === taskId);
      expect(taskInQueue).toBe(true);
    });
  });

  describe('Execution History', () => {
    it('should get task execution history', async () => {
      const createResponse = await request(app)
        .post('/api/tasks')
        .send({ name: 'History Test' });
      
      const taskId = createResponse.body.id;
      await request(app).post(`/api/tasks/${taskId}/start`);
      
      const response = await request(app).get(`/api/tasks/${taskId}/history`);
      expect(response.statusCode).toBe(200);
      expect(response.body.length).toBeGreaterThan(0);
    });

    it('should get all execution history', async () => {
      const createResponse = await request(app)
        .post('/api/tasks')
        .send({ name: 'All History Test' });
      
      const taskId = createResponse.body.id;
      await request(app).post(`/api/tasks/${taskId}/start`);
      
      const response = await request(app).get('/api/tasks/history');
      expect(response.statusCode).toBe(200);
      expect(response.body.length).toBeGreaterThan(0);
    });

    it('should filter history by taskId', async () => {
      const task1Response = await request(app)
        .post('/api/tasks')
        .send({ name: 'Task 1' });
      
      const task2Response = await request(app)
        .post('/api/tasks')
        .send({ name: 'Task 2' });
      
      await request(app).post(`/api/tasks/${task1Response.body.id}/start`);
      await request(app).post(`/api/tasks/${task2Response.body.id}/start`);

      const response = await request(app)
        .get(`/api/tasks/history?taskId=${task1Response.body.id}`);
      
      expect(response.statusCode).toBe(200);
      response.body.forEach(item => {
        expect(item.task_id).toBe(task1Response.body.id);
      });
    });
  });
});
