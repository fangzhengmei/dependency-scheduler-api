process.env.NODE_ENV = 'test';

const db = require('../src/database/db');

function cleanupDatabase(callback) {
  db.serialize(() => {
    db.run('DELETE FROM execution_history');
    db.run('DELETE FROM dependencies');
    db.run('DELETE FROM tasks', callback);
  });
}

beforeAll((done) => {
  db.initDatabase((err) => {
    if (err) {
      console.error('Failed to initialize database:', err);
      return done(err);
    }
    cleanupDatabase(done);
  });
});

beforeEach((done) => {
  cleanupDatabase(done);
});

afterAll((done) => {
  cleanupDatabase((err) => {
    if (err) {
      console.error('Failed to cleanup database:', err);
      return done(err);
    }
    db.close((closeErr) => {
      done(closeErr);
    });
  });
});
