// Set test environment variables before loading index.js
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_secret_key_for_hivemind_2026';
process.env.DB_USER = 'test_user';
process.env.DB_HOST = 'localhost';
process.env.DB_DATABASE = 'test_db';
process.env.DB_PASSWORD = 'test_password';
process.env.DB_PORT = '5432';

const request = require('supertest');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// Mock PG Driver BEFORE importing app
const mockQuery = jest.fn();
jest.mock('pg', () => {
  return {
    Pool: jest.fn(() => ({
      query: mockQuery,
      on: jest.fn(),
      end: jest.fn(),
    })),
  };
});

const { app } = require('../index');

describe('HiveMind Backend API - Integration & Edge Cases Suite', () => {
  let authToken;
  const testUserId = 42;
  const testUserEmail = 'bee@hive.com';

  beforeEach(() => {
    jest.clearAllMocks();
    // Generate valid token for authenticated routes
    authToken = jwt.sign({ id: testUserId, email: testUserEmail }, process.env.JWT_SECRET, { expiresIn: '1h' });
  });

  describe('Authentication Endpoints', () => {
    describe('POST /auth/signup', () => {
      it('should sign up a user successfully', async () => {
        // Mock query for check existing user: empty array (no duplicate)
        mockQuery.mockResolvedValueOnce({ rows: [] });
        // Mock query for insert: returns new user id and email
        mockQuery.mockResolvedValueOnce({ rows: [{ id: testUserId, email: testUserEmail }] });

        const res = await request(app)
          .post('/auth/signup')
          .send({
            email: testUserEmail,
            password: 'securePassword123',
            confirmPassword: 'securePassword123'
          });

        expect(res.status).toBe(201);
        expect(res.body).toHaveProperty('token');
        expect(res.body.user).toEqual({ id: testUserId, email: testUserEmail });
      });

      it('should fail if email is malformed', async () => {
        const res = await request(app)
          .post('/auth/signup')
          .send({
            email: 'malformed_email',
            password: 'securePassword123',
            confirmPassword: 'securePassword123'
          });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Invalid email format.');
      });

      it('should fail if passwords do not match', async () => {
        const res = await request(app)
          .post('/auth/signup')
          .send({
            email: testUserEmail,
            password: 'securePassword123',
            confirmPassword: 'differentPassword'
          });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Passwords do not match.');
      });

      it('should fail if password is too short', async () => {
        const res = await request(app)
          .post('/auth/signup')
          .send({
            email: testUserEmail,
            password: '123',
            confirmPassword: '123'
          });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Password must be at least 6 characters.');
      });

      it('should return 409 Conflict if email is already registered', async () => {
        // Mock check existing: user exists
        mockQuery.mockResolvedValueOnce({ rows: [{ id: 99 }] });

        const res = await request(app)
          .post('/auth/signup')
          .send({
            email: testUserEmail,
            password: 'securePassword123',
            confirmPassword: 'securePassword123'
          });

        expect(res.status).toBe(409);
        expect(res.body.error).toBe('Email already registered.');
      });

      it('should return 400 Bad Request if parameters are not strings (Type Safety Edge Case)', async () => {
        const res = await request(app)
          .post('/auth/signup')
          .send({
            email: 12345, // number instead of string
            password: ['password'], // array instead of string
            confirmPassword: 'password'
          });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Email and password must be strings.');
      });
    });

    describe('POST /auth/login', () => {
      it('should log in a user successfully', async () => {
        const hashedPassword = await bcrypt.hash('myPassword', 10);
        mockQuery.mockResolvedValueOnce({
          rows: [{ id: testUserId, email: testUserEmail, password_hash: hashedPassword }]
        });

        const res = await request(app)
          .post('/auth/login')
          .send({ email: testUserEmail, password: 'myPassword' });

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('token');
        expect(res.body.user).toEqual({ id: testUserId, email: testUserEmail });
      });

      it('should reject invalid passwords', async () => {
        const hashedPassword = await bcrypt.hash('myPassword', 10);
        mockQuery.mockResolvedValueOnce({
          rows: [{ id: testUserId, email: testUserEmail, password_hash: hashedPassword }]
        });

        const res = await request(app)
          .post('/auth/login')
          .send({ email: testUserEmail, password: 'wrongPassword' });

        expect(res.status).toBe(401);
        expect(res.body.error).toBe('Invalid email or password.');
      });

      it('should return 401 if user is not found', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [] });

        const res = await request(app)
          .post('/auth/login')
          .send({ email: 'nonexistent@hive.com', password: 'password' });

        expect(res.status).toBe(401);
        expect(res.body.error).toBe('Invalid email or password.');
      });

      it('should return 400 Bad Request if arguments are not strings', async () => {
        const res = await request(app)
          .post('/auth/login')
          .send({ email: { test: 1 }, password: 'password' });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Email and password must be strings.');
      });
    });
  });

  describe('Todo API Endpoints (Protected)', () => {
    describe('Security checks', () => {
      it('should reject requests without a token', async () => {
        const res = await request(app).get('/api/todos');
        expect(res.status).toBe(401);
      });

      it('should reject requests with invalid token', async () => {
        const res = await request(app)
          .get('/api/todos')
          .set('Authorization', 'Bearer invalid_token_xyz');
        expect(res.status).toBe(403);
      });
    });

    describe('GET /api/todos', () => {
      it('should fetch user todos and correctly format date and overdue fields', async () => {
        const mockDbTodos = [
          {
            id: 1,
            title: 'Task 1',
            completed: false,
            flair: 'Work',
            priority: 'High',
            dueDate: '2026-07-10',
            userId: testUserId
          }
        ];
        mockQuery.mockResolvedValueOnce({ rows: mockDbTodos });

        const res = await request(app)
          .get('/api/todos')
          .set('Authorization', `Bearer ${authToken}`);

        expect(res.status).toBe(200);
        expect(res.body).toBeInstanceOf(Array);
        expect(res.body[0]).toHaveProperty('isOverdue');
      });
    });

    describe('POST /api/todos', () => {
      it('should insert a new todo successfully', async () => {
        const mockNewTodo = {
          id: 101,
          title: 'New Task',
          completed: false,
          flair: 'Work',
          priority: 'High',
          dueDate: '2026-07-20',
          userId: testUserId
        };
        mockQuery.mockResolvedValueOnce({ rows: [mockNewTodo] });

        const res = await request(app)
          .post('/api/todos')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            title: 'New Task',
            flair: 'Work',
            priority: 'High',
            dueDate: '2026-07-20'
          });

        expect(res.status).toBe(201);
        expect(res.body.title).toBe('New Task');
        expect(res.body.flair).toBe('Work');
      });

      it('should fail when input validation checks are triggered', async () => {
        const res = await request(app)
          .post('/api/todos')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            title: '', // empty title
            flair: 'InvalidFlair', // invalid flair
            priority: 'Low', // invalid priority backend-side
            dueDate: '2026-07-20'
          });

        expect(res.status).toBe(400);
        expect(res.body.errors).toContain('Title is required.');
        expect(res.body.errors).toContain("Flair must be one of: Coursework, Sport/Athleticism, Home/Personal, Commitments, Research, Work");
        expect(res.body.errors).toContain("Priority must be either 'High' or 'Medium'.");
      });
    });

    describe('PATCH /api/todos/:id (Ownership & Updates)', () => {
      it('should update todo successfully if owner calls it', async () => {
        // Step 1 check ownership query returns owner's user_id
        mockQuery.mockResolvedValueOnce({ rows: [{ user_id: testUserId }] });
        // Step 2 update query returns updated todo
        mockQuery.mockResolvedValueOnce({
          rows: [{ id: 1, title: 'Updated Title', completed: true, userId: testUserId }]
        });

        const res = await request(app)
          .patch('/api/todos/1')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ title: 'Updated Title', completed: true });

        expect(res.status).toBe(200);
        expect(res.body.title).toBe('Updated Title');
        expect(res.body.completed).toBe(true);
      });

      it('should return 403 Forbidden if user B tries to update user A todo (Isolation Boundary Check)', async () => {
        // Step 1 checks ownership -> returns user_id = 99 (not testUserId = 42)
        mockQuery.mockResolvedValueOnce({ rows: [{ user_id: 99 }] });

        const res = await request(app)
          .patch('/api/todos/1')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ title: 'Hacked Title' });

        expect(res.status).toBe(403);
        expect(res.body.error).toBe('Unauthorized.');
      });

      it('should return 404 if todo ID does not exist', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [] });

        const res = await request(app)
          .patch('/api/todos/999')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ title: 'Not existing' });

        expect(res.status).toBe(404);
        expect(res.body.error).toBe('Task not found.');
      });
    });

    describe('DELETE /api/todos/:id (Ownership & Purging)', () => {
      it('should delete todo successfully if owner calls it', async () => {
        // Step 1: Check ownership query
        mockQuery.mockResolvedValueOnce({ rows: [{ user_id: testUserId }] });
        // Step 2: Delete query
        mockQuery.mockResolvedValueOnce({ rows: [{ id: 1, title: 'To Delete' }] });

        const res = await request(app)
          .delete('/api/todos/1')
          .set('Authorization', `Bearer ${authToken}`);

        expect(res.status).toBe(200);
        expect(res.body.message).toBe('Task purged successfully');
        expect(res.body.id).toBe(1);
      });

      it('should block deletion if user is unauthorized', async () => {
        // Step 1: Check ownership -> belongs to user 99
        mockQuery.mockResolvedValueOnce({ rows: [{ user_id: 99 }] });

        const res = await request(app)
          .delete('/api/todos/1')
          .set('Authorization', `Bearer ${authToken}`);

        expect(res.status).toBe(403);
        expect(res.body.error).toBe('Unauthorized.');
      });
    });
  });

  describe('Timezone & isOverdue Edge Cases', () => {
    it('should NOT mark a task due TODAY as overdue (Timezone Fix verification)', async () => {
      const todayString = new Date().toISOString().split('T')[0];
      const mockDbTodo = {
        id: 5,
        title: 'Due today',
        completed: false,
        flair: 'Work',
        priority: 'High',
        dueDate: todayString,
        userId: testUserId
      };
      mockQuery.mockResolvedValueOnce({ rows: [mockDbTodo] });

      const res = await request(app)
        .get('/api/todos')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body[0].isOverdue).toBe(false);
    });

    it('should mark a task due YESTERDAY as overdue', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayString = yesterday.toISOString().split('T')[0];
      const mockDbTodo = {
        id: 6,
        title: 'Due yesterday',
        completed: false,
        flair: 'Work',
        priority: 'High',
        dueDate: yesterdayString,
        userId: testUserId
      };
      mockQuery.mockResolvedValueOnce({ rows: [mockDbTodo] });

      const res = await request(app)
        .get('/api/todos')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body[0].isOverdue).toBe(true);
    });

    it('should NOT mark a task due TOMORROW as overdue', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowString = tomorrow.toISOString().split('T')[0];
      const mockDbTodo = {
        id: 7,
        title: 'Due tomorrow',
        completed: false,
        flair: 'Work',
        priority: 'High',
        dueDate: tomorrowString,
        userId: testUserId
      };
      mockQuery.mockResolvedValueOnce({ rows: [mockDbTodo] });

      const res = await request(app)
        .get('/api/todos')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body[0].isOverdue).toBe(false);
    });
  });
});
