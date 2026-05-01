import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { logger } from './logger.js';
import { requestLogger, errorHandler, rateLimiter } from './middleware.js';
import { metricsHandler, trackConnections } from './metrics.js';
import { healthCheck, readinessCheck, livenessCheck } from './health.js';
import {
  getSummary,
  listTasks,
  getTaskById,
  createTask,
  updateTask,
  deleteTask,
  listProjects,
  createProject,
  updateProject,
  deleteProject,
  listRisks,
  listStakeholders,
  authenticateUser,
  getUserById,
  listComments,
  createComment,
  listActivities,
  listNotifications,
  updateNotification,
  getProjectById,
  markAllNotificationsRead,
  bulkUpdateNotifications
} from './repository.js';
import { requireAuth, requireRole, signToken } from './auth.js';

const app = express();

// Trust proxy for accurate IP behind reverse proxies
app.set('trust proxy', 1);

// CORS with configurable origin
app.use(cors({
  origin: config.CORS_ORIGIN,
  credentials: true,
  exposedHeaders: ['x-request-id', 'x-ratelimit-limit', 'x-ratelimit-remaining']
}));

app.use(express.json());
app.use(requestLogger);
app.use(rateLimiter({
  windowMs: config.RATE_LIMIT_WINDOW_MS,
  max: config.RATE_LIMIT_MAX
}));

// Health & probe endpoints (public, no auth)
app.get('/health', healthCheck);
app.get('/health/ready', readinessCheck);
app.get('/health/live', livenessCheck);
app.get('/metrics', metricsHandler);

// Authentication
app.post('/api/auth/login', async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ message: 'email and password are required' });
    }

    const user = await authenticateUser(email, password);
    if (!user) {
      logger.warn('Failed login attempt', { email, ip: req.ip });
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    logger.info('User authenticated', { user_id: user.id, email: user.email });
    res.json({
      token: signToken(user),
      user: { id: user.id, name: user.name, email: user.email, role: user.role }
    });
  } catch (err) {
    next(err);
  }
});

app.get('/api/auth/me', requireAuth, async (req, res, next) => {
  try {
    const user = await getUserById(req.auth.sub);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json({ id: user.id, name: user.name, email: user.email, role: user.role });
  } catch (err) {
    next(err);
  }
});

app.use('/api', requireAuth);

// Dashboard
app.get('/api/dashboard/summary', async (_req, res, next) => {
  try {
    res.json(await getSummary());
  } catch (err) {
    next(err);
  }
});

// Projects
app.get('/api/projects', async (_req, res, next) => {
  try {
    res.json(await listProjects());
  } catch (err) {
    next(err);
  }
});

app.get('/api/projects/:id', async (req, res, next) => {
  try {
    const project = await getProjectById(req.params.id);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }
    res.json(project);
  } catch (err) {
    next(err);
  }
});

app.post('/api/projects', requireRole(['admin', 'manager']), async (req, res, next) => {
  try {
    const project = await createProject(req.body || {});
    if (!project) {
      return res.status(400).json({ message: 'name is required' });
    }
    logger.info('Project created', { project_id: project.id, name: project.name });
    res.status(201).json(project);
  } catch (err) {
    next(err);
  }
});

app.patch('/api/projects/:id', requireRole(['admin', 'manager']), async (req, res, next) => {
  try {
    const project = await updateProject(req.params.id, req.body || {});
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }
    logger.info('Project updated', { project_id: project.id });
    res.json(project);
  } catch (err) {
    next(err);
  }
});

app.delete('/api/projects/:id', requireRole(['admin', 'manager']), async (req, res, next) => {
  try {
    const removed = await deleteProject(req.params.id);
    if (!removed) {
      return res.status(404).json({ message: 'Project not found' });
    }
    logger.info('Project deleted', { project_id: req.params.id });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// Tasks
app.get('/api/tasks', async (_req, res, next) => {
  try {
    res.json(await listTasks(_req.query));
  } catch (err) {
    next(err);
  }
});

app.get('/api/tasks/:id', async (req, res, next) => {
  try {
    const task = await getTaskById(req.params.id);
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }
    res.json(task);
  } catch (err) {
    next(err);
  }
});

app.get('/api/tasks/:id/comments', async (req, res, next) => {
  try {
    res.json(await listComments(req.params.id));
  } catch (err) {
    next(err);
  }
});

app.post('/api/tasks/:id/comments', async (req, res, next) => {
  try {
    const body = String(req.body?.body || '').trim();
    if (!body) {
      return res.status(400).json({ message: 'comment body is required' });
    }
    const comment = await createComment(req.params.id, {
      author: req.auth?.name || 'Unknown',
      body
    });
    res.status(201).json(comment);
  } catch (err) {
    next(err);
  }
});

app.post('/api/tasks', requireRole(['admin', 'manager']), async (req, res, next) => {
  try {
    const task = {
      title: req.body.title?.trim(),
      project: req.body.project?.trim(),
      status: req.body.status?.trim() || 'To Do',
      priority: req.body.priority?.trim() || 'Medium',
      assignee: req.body.assignee?.trim() || 'Unassigned',
      dueDate: req.body.dueDate || null,
      description: req.body.description?.trim() || ''
    };

    if (!task.title || !task.project) {
      return res.status(400).json({ message: 'title and project are required' });
    }

    const created = await createTask(task);
    logger.info('Task created', { task_id: created.id, title: created.title });
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

app.patch('/api/tasks/:id', requireRole(['admin', 'manager']), async (req, res, next) => {
  try {
    const existing = await getTaskById(req.params.id);
    if (!existing) {
      return res.status(404).json({ message: 'Task not found' });
    }

    const payload = {
      title: req.body.title?.trim() ?? existing.title,
      project: req.body.project?.trim() ?? existing.project,
      status: req.body.status?.trim() ?? existing.status,
      priority: req.body.priority?.trim() ?? existing.priority,
      assignee: req.body.assignee?.trim() ?? existing.assignee,
      dueDate: req.body.dueDate ?? existing.dueDate,
      description: req.body.description?.trim() ?? existing.description
    };

    const updated = await updateTask(req.params.id, payload);
    logger.info('Task updated', { task_id: updated.id });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

app.delete('/api/tasks/:id', requireRole(['admin', 'manager']), async (req, res, next) => {
  try {
    const removed = await deleteTask(req.params.id);
    if (!removed) {
      return res.status(404).json({ message: 'Task not found' });
    }
    logger.info('Task deleted', { task_id: req.params.id });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// Risks
app.get('/api/risks', async (_req, res, next) => {
  try {
    res.json(await listRisks());
  } catch (err) {
    next(err);
  }
});

// Stakeholders
app.get('/api/stakeholders', async (_req, res, next) => {
  try {
    res.json(await listStakeholders());
  } catch (err) {
    next(err);
  }
});

// Activities
app.get('/api/activities', async (_req, res, next) => {
  try {
    res.json(await listActivities(_req.query));
  } catch (err) {
    next(err);
  }
});

// Notifications
app.get('/api/notifications', async (_req, res, next) => {
  try {
    res.json(await listNotifications());
  } catch (err) {
    next(err);
  }
});

app.patch('/api/notifications/:id', async (req, res, next) => {
  try {
    const notification = await updateNotification(req.params.id, { isRead: req.body?.isRead });
    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }
    res.json(notification);
  } catch (err) {
    next(err);
  }
});

app.post('/api/notifications/mark-all-read', async (_req, res, next) => {
  try {
    res.json(await markAllNotificationsRead());
  } catch (err) {
    next(err);
  }
});

app.patch('/api/notifications/bulk', async (req, res, next) => {
  try {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
    if (!ids.length) {
      return res.status(400).json({ message: 'ids are required' });
    }
    res.json(await bulkUpdateNotifications(ids, req.body?.isRead !== false));
  } catch (err) {
    next(err);
  }
});

// Global error handler
app.use(errorHandler);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ message: 'Not found' });
});

// Graceful shutdown handling
function gracefulShutdown(signal) {
  logger.info(`Received ${signal}, shutting down gracefully`);
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });

  // Force shutdown after 10s
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start server
const server = app.listen(config.PORT, () => {
  logger.info('TaskFlow API started', {
    port: config.PORT,
    environment: config.NODE_ENV,
    node_version: process.version
  });
});

// Track connection metrics
trackConnections(server);
