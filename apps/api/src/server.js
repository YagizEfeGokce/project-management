import express from 'express';
import cors from 'cors';
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
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'taskflow-api' });
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ message: 'email and password are required' });
  }

  const user = await authenticateUser(email, password);
  if (!user) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  res.json({
    token: signToken(user),
    user: { id: user.id, name: user.name, email: user.email, role: user.role }
  });
});

app.get('/api/auth/me', requireAuth, async (req, res) => {
  const user = await getUserById(req.auth.sub);
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  res.json({ id: user.id, name: user.name, email: user.email, role: user.role });
});

app.use('/api', requireAuth);

app.get('/api/dashboard/summary', async (_req, res) => {
  res.json(await getSummary());
});

app.get('/api/projects', async (_req, res) => {
  res.json(await listProjects());
});

app.get('/api/projects/:id', async (req, res) => {
  const project = await getProjectById(req.params.id);
  if (!project) {
    return res.status(404).json({ message: 'Project not found' });
  }

  res.json(project);
});

app.post('/api/projects', requireRole(['admin', 'manager']), async (req, res) => {
  const project = await createProject(req.body || {});
  if (!project) {
    return res.status(400).json({ message: 'name is required' });
  }

  res.status(201).json(project);
});

app.patch('/api/projects/:id', requireRole(['admin', 'manager']), async (req, res) => {
  const project = await updateProject(req.params.id, req.body || {});
  if (!project) {
    return res.status(404).json({ message: 'Project not found' });
  }

  res.json(project);
});

app.delete('/api/projects/:id', requireRole(['admin', 'manager']), async (req, res) => {
  const removed = await deleteProject(req.params.id);
  if (!removed) {
    return res.status(404).json({ message: 'Project not found' });
  }

  res.status(204).send();
});

app.get('/api/tasks', async (_req, res) => {
  res.json(await listTasks(_req.query));
});

app.get('/api/tasks/:id', async (req, res) => {
  const task = await getTaskById(req.params.id);
  if (!task) {
    return res.status(404).json({ message: 'Task not found' });
  }
  res.json(task);
});

app.get('/api/tasks/:id/comments', async (req, res) => {
  res.json(await listComments(req.params.id));
});

app.post('/api/tasks/:id/comments', async (req, res) => {
  const body = String(req.body?.body || '').trim();
  if (!body) {
    return res.status(400).json({ message: 'comment body is required' });
  }

  res.status(201).json(await createComment(req.params.id, {
    author: req.auth?.name || 'Unknown',
    body
  }));
});

app.post('/api/tasks', requireRole(['admin', 'manager']), async (req, res) => {
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

  res.status(201).json(await createTask(task));
});

app.patch('/api/tasks/:id', requireRole(['admin', 'manager']), async (req, res) => {
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

  res.json(await updateTask(req.params.id, payload));
});

app.delete('/api/tasks/:id', requireRole(['admin', 'manager']), async (req, res) => {
  const removed = await deleteTask(req.params.id);
  if (!removed) {
    return res.status(404).json({ message: 'Task not found' });
  }
  res.status(204).send();
});

app.get('/api/risks', async (_req, res) => {
  res.json(await listRisks());
});

app.get('/api/stakeholders', async (_req, res) => {
  res.json(await listStakeholders());
});

app.get('/api/activities', async (_req, res) => {
  res.json(await listActivities(_req.query));
});

app.get('/api/notifications', async (_req, res) => {
  res.json(await listNotifications());
});

app.patch('/api/notifications/:id', async (req, res) => {
  const notification = await updateNotification(req.params.id, { isRead: req.body?.isRead });
  if (!notification) {
    return res.status(404).json({ message: 'Notification not found' });
  }

  res.json(notification);
});

app.post('/api/notifications/mark-all-read', async (_req, res) => {
  res.json(await markAllNotificationsRead());
});

app.patch('/api/notifications/bulk', async (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
  if (!ids.length) {
    return res.status(400).json({ message: 'ids are required' });
  }

  res.json(await bulkUpdateNotifications(ids, req.body?.isRead !== false));
});

app.listen(port, () => {
  console.log(`TaskFlow API running on http://localhost:${port}`);
});
