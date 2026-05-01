import { hasDatabaseUrl, getPrisma } from './prisma.js';
import { loadState, saveState, nextTaskId, nextCommentId, nextActivityId, nextNotificationId } from './store.js';
import bcrypt from 'bcryptjs';

function normalizeTask(task) {
  return {
    id: task.id,
    title: task.title,
    project: task.project,
    status: task.status,
    priority: task.priority,
    assignee: task.assignee,
    dueDate: task.dueDate ?? null,
    description: task.description ?? ''
  };
}

function aggregateDashboard(tasks, extras = {}) {
  const totalTasks = tasks.length;
  const normalize = value => String(value || '').trim().toLowerCase();
  const completed = tasks.filter(task => ['done', 'completed'].includes(normalize(task.status))).length;
  const delayed = tasks.filter(task => ['delayed', 'late'].includes(normalize(task.status))).length;
  const inProgress = tasks.filter(task => ['in progress', 'progress', 'doing'].includes(normalize(task.status))).length;
  const todo = tasks.filter(task => ['todo', 'to do', 'backlog'].includes(normalize(task.status))).length;

  const workloadMap = new Map();
  tasks.forEach(task => {
    const key = task.assignee || 'Unassigned';
    workloadMap.set(key, (workloadMap.get(key) || 0) + 1);
  });

  const workloadDistribution = [...workloadMap.entries()]
    .map(([name, count]) => ({ name, count, share: totalTasks ? Math.round((count / totalTasks) * 100) : 0 }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 4);

  return {
    completionRate: totalTasks ? Math.round((completed / totalTasks) * 100) : 0,
    delayedTasks: delayed,
    activeMembers: extras.activeMembers ?? 0,
    totalTasks,
    uptime: extras.uptime ?? 99.94,
    responseTime: extras.responseTime ?? 124,
    unreadNotifications: extras.unreadNotifications ?? 0,
    recentActivityCount: extras.recentActivityCount ?? 0,
    statusBreakdown: {
      completed,
      delayed,
      inProgress,
      todo
    },
    workloadDistribution
  };
}

function normalize(value) {
  return String(value || '').trim().toLowerCase();
}

function parseDate(value, endOfDay = false) {
  if (!value) return null;
  return new Date(`${value}T${endOfDay ? '23:59:59.999' : '00:00:00'}`);
}

function applyPagination(items, page = 1, limit = 25) {
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.max(1, Math.min(100, Number(limit) || 25));
  const offset = (safePage - 1) * safeLimit;

  return {
    items: items.slice(offset, offset + safeLimit),
    page: safePage,
    limit: safeLimit,
    total: items.length,
    totalPages: Math.max(1, Math.ceil(items.length / safeLimit))
  };
}

function sortItems(items, sortBy = 'id', order = 'desc') {
  const direction = order === 'asc' ? 1 : -1;
  const sortable = [...items].sort((a, b) => {
    const av = a?.[sortBy];
    const bv = b?.[sortBy];

    if (sortBy === 'id') return ((Number(av) || 0) - (Number(bv) || 0)) * direction;
    if (sortBy === 'dueDate' || sortBy === 'createdAt') {
      return (new Date(av || 0).getTime() - new Date(bv || 0).getTime()) * direction;
    }

    return String(av || '').localeCompare(String(bv || '')) * direction;
  });

  return sortable;
}

function applyTaskQuery(tasks, query = {}) {
  const q = normalize(query.q);
  const filters = {
    status: normalize(query.status),
    priority: normalize(query.priority),
    project: normalize(query.project),
    assignee: normalize(query.assignee)
  };
  const from = parseDate(query.dueFrom);
  const to = parseDate(query.dueTo, true);

  let result = tasks.filter(task => {
    const matchesQuery = !q || [task.title, task.project, task.status, task.priority, task.assignee, task.description]
      .filter(Boolean)
      .some(value => normalize(value).includes(q));
    const matchesStatus = !filters.status || normalize(task.status) === filters.status;
    const matchesPriority = !filters.priority || normalize(task.priority) === filters.priority;
    const matchesProject = !filters.project || normalize(task.project) === filters.project;
    const matchesAssignee = !filters.assignee || normalize(task.assignee) === filters.assignee;
    const taskDate = task.dueDate ? new Date(task.dueDate) : null;
    const matchesFrom = !from || !taskDate || taskDate >= from;
    const matchesTo = !to || !taskDate || taskDate <= to;

    return matchesQuery && matchesStatus && matchesPriority && matchesProject && matchesAssignee && matchesFrom && matchesTo;
  });

  result = sortItems(result, query.sortBy || 'id', query.order || 'desc');
  return applyPagination(result, query.page, query.limit);
}

function getActivityKind(action) {
  const value = normalize(action);
  if (value.includes('comment')) return 'comment';
  if (value.includes('created') || value.includes('updated') || value.includes('deleted')) return 'task';
  if (value.includes('notification')) return 'notification';
  return 'system';
}

function applyActivityQuery(items, query = {}) {
  const q = normalize(query.q);
  const from = parseDate(query.from);
  const to = parseDate(query.to, true);
  const actor = normalize(query.actor);
  const kind = normalize(query.kind);

  let result = items.filter(item => {
    const matchesQuery = !q || [item.action, item.actor, item.target, item.meta]
      .filter(Boolean)
      .some(value => normalize(value).includes(q));
    const matchesActor = !actor || normalize(item.actor) === actor;
    const matchesKind = !kind || kind === 'all' || getActivityKind(item.action) === kind;
    const createdAt = item.createdAt ? new Date(item.createdAt) : null;
    const matchesFrom = !from || !createdAt || createdAt >= from;
    const matchesTo = !to || !createdAt || createdAt <= to;

    return matchesQuery && matchesActor && matchesKind && matchesFrom && matchesTo;
  });

  result = sortItems(result, query.sortBy || 'createdAt', query.order || 'desc');
  return applyPagination(result, query.page, query.limit);
}

function summarizeProject(project, tasks) {
  const projectTasks = tasks.filter(task => normalize(task.project) === normalize(project.name));
  const totalTasks = projectTasks.length;
  const completed = projectTasks.filter(task => ['done', 'completed'].includes(normalize(task.status))).length;
  const delayed = projectTasks.filter(task => ['delayed', 'late'].includes(normalize(task.status))).length;

  return {
    project,
    taskCount: totalTasks,
    completionRate: totalTasks ? Math.round((completed / totalTasks) * 100) : 0,
    delayedTasks: delayed,
    tasks: projectTasks
  };
}

function appendActivityToState(state, actor, action, target, meta = null) {
  const items = state.activities || [];
  items.unshift({
    id: nextActivityId(items),
    actor,
    action,
    target,
    meta,
    createdAt: new Date().toISOString()
  });
  state.activities = items;
}

function appendNotificationToState(state, title, body, isRead = false) {
  const items = state.notifications || [];
  items.unshift({
    id: nextNotificationId(items),
    title,
    body,
    isRead,
    createdAt: new Date().toISOString()
  });
  state.notifications = items;
}

let seeded = false;
let seedingPromise = null;

const fallbackUsers = [
  {
    id: 1,
    name: 'Ezgi Turan',
    email: 'admin@taskflow.local',
    passwordHash: bcrypt.hashSync('admin123', 10),
    role: 'admin'
  }
];

async function ensureSeeded() {
  const prisma = getPrisma();
  if (!prisma || seeded) return;
  if (seedingPromise) return seedingPromise;

  seedingPromise = (async () => {
    const [taskCount, projectCount, riskCount, stakeholderCount] = await Promise.all([
      prisma.task.count(),
      prisma.project.count(),
      prisma.risk.count(),
      prisma.stakeholder.count()
    ]);

    const userCount = await prisma.user.count();
    const commentCount = await prisma.comment.count();
    const activityCount = await prisma.activityLog.count();
    const notificationCount = await prisma.notification.count();

    if (taskCount || projectCount || riskCount || stakeholderCount || userCount || commentCount || activityCount || notificationCount) {
      seeded = true;
      return;
    }

    const state = await loadState();

    await prisma.project.createMany({
      data: state.projects.map(project => ({
        name: project.name,
        progress: project.progress,
        status: project.status
      }))
    });

    await prisma.task.createMany({
      data: state.tasks.map(task => ({
        title: task.title,
        project: task.project,
        status: task.status,
        priority: task.priority,
        assignee: task.assignee,
        dueDate: task.dueDate,
        description: task.description
      }))
    });

    await prisma.risk.createMany({
      data: state.risks.map(risk => ({
        title: risk.title,
        category: risk.category,
        severity: risk.severity
      }))
    });

    await prisma.stakeholder.createMany({
      data: [
        { name: 'Project Manager', concern: 'Delivery visibility' },
        { name: 'Team Member', concern: 'Workload balance' },
        { name: 'Client', concern: 'Business value' }
      ]
    });

    await prisma.user.createMany({
      data: [
        { name: 'Ezgi Turan', email: 'admin@taskflow.local', passwordHash: bcrypt.hashSync('admin123', 10), role: 'admin' },
        { name: 'Kerem Ozcan', email: 'kerem@taskflow.local', passwordHash: bcrypt.hashSync('member123', 10), role: 'manager' }
      ]
    });

    await prisma.comment.createMany({
      data: [
        { taskId: 1, author: 'Kerem Ozcan', body: 'Please confirm the refresh edge cases before release.' },
        { taskId: 1, author: 'Ezgi Turan', body: 'Working on it now.' },
        { taskId: 3, author: 'Kerem Ozcan', body: 'This is blocking the gateway milestone.' }
      ]
    });

    await prisma.activityLog.createMany({
      data: [
        { actor: 'Ezgi Turan', action: 'Created task', target: 'Auth token refresh logic', meta: 'task create' },
        { actor: 'Kerem Ozcan', action: 'Added comment', target: 'Rate limit middleware', meta: 'comment' },
        { actor: 'Ezgi Turan', action: 'Updated task', target: 'Dashboard UI wireframes', meta: 'status -> In Progress' }
      ]
    });

    await prisma.notification.createMany({
      data: [
        { title: 'Task delayed', body: 'Rate limit middleware is marked delayed.', isRead: false },
        { title: 'New comment', body: 'Kerem commented on Auth token refresh logic.', isRead: false },
        { title: 'Assignment changed', body: 'Dashboard UI wireframes is now in progress.', isRead: true }
      ]
    });

    seeded = true;
  })();

  return seedingPromise;
}

export async function authenticateUser(email, password) {
  if (!hasDatabaseUrl()) {
    const user = fallbackUsers.find(item => item.email.toLowerCase() === String(email || '').toLowerCase());
    if (!user) return null;
    return bcrypt.compare(password, user.passwordHash) ? user : null;
  }

  const prisma = getPrisma();
  await ensureSeeded();
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return null;
  const ok = await bcrypt.compare(password, user.passwordHash);
  return ok ? user : null;
}

export async function getUserById(id) {
  if (!hasDatabaseUrl()) {
    return fallbackUsers.find(user => user.id === Number(id)) ?? null;
  }

  const prisma = getPrisma();
  await ensureSeeded();
  return prisma.user.findUnique({ where: { id: Number(id) } });
}

export async function getSummary() {
  if (!hasDatabaseUrl()) {
    const state = await loadState();
    return aggregateDashboard(state.tasks || [], {
      activeMembers: (state.users || []).length || 2,
      unreadNotifications: (state.notifications || []).filter(note => !note.isRead).length,
      recentActivityCount: (state.activities || []).length,
      uptime: state.summary?.uptime ?? 99.94,
      responseTime: state.summary?.responseTime ?? 124
    });
  }

  const prisma = getPrisma();
  await ensureSeeded();
  const [tasks, activeMembers, unreadNotifications, recentActivityCount] = await Promise.all([
    prisma.task.findMany(),
    prisma.user.count(),
    prisma.notification.count({ where: { isRead: false } }),
    prisma.activityLog.count()
  ]);

  return aggregateDashboard(tasks, {
    activeMembers,
    unreadNotifications,
    recentActivityCount,
    uptime: 99.94,
    responseTime: 124
  });
}

export async function listTasks(query = {}) {
  if (!hasDatabaseUrl()) {
    const state = await loadState();
    const result = applyTaskQuery(state.tasks || [], query);
    return result.items;
  }

  const prisma = getPrisma();
  await ensureSeeded();
  const tasks = await prisma.task.findMany();
  const result = applyTaskQuery(tasks.map(normalizeTask), query);
  return result.items;
}

export async function getTaskById(id) {
  if (!hasDatabaseUrl()) {
    const state = await loadState();
    return state.tasks.find(task => Number(task.id) === Number(id)) ?? null;
  }

  const prisma = getPrisma();
  await ensureSeeded();
  return prisma.task.findUnique({ where: { id: Number(id) } });
}

export async function listComments(taskId) {
  if (!hasDatabaseUrl()) {
    const state = await loadState();
    return (state.comments || []).filter(comment => Number(comment.taskId) === Number(taskId));
  }

  const prisma = getPrisma();
  await ensureSeeded();
  return prisma.comment.findMany({ where: { taskId: Number(taskId) }, orderBy: { id: 'asc' } });
}

export async function createComment(taskId, payload) {
  if (!hasDatabaseUrl()) {
    const state = await loadState();
    const comments = state.comments || [];
    const comment = {
      id: nextCommentId(comments),
      taskId: Number(taskId),
      author: payload.author,
      body: payload.body,
      createdAt: new Date().toISOString()
    };
    comments.push(comment);
    state.comments = comments;
    appendActivityToState(state, payload.author, 'Added comment', state.tasks.find(task => Number(task.id) === Number(taskId))?.title || `Task #${taskId}`, 'comment');
    appendNotificationToState(state, 'New comment', `${payload.author} commented on task #${taskId}.`, false);
    await saveState(state);
    return comment;
  }

  const prisma = getPrisma();
  await ensureSeeded();
  const comment = await prisma.comment.create({ data: { taskId: Number(taskId), author: payload.author, body: payload.body } });
  const task = await prisma.task.findUnique({ where: { id: Number(taskId) } });
  await addActivity(payload.author, 'Added comment', task?.title || `Task #${taskId}`, 'comment');
  await addNotification('New comment', `${payload.author} commented on ${task?.title || `task #${taskId}`}.`, false);
  return comment;
}

async function addActivity(actor, action, target, meta = null) {
  if (!hasDatabaseUrl()) {
    const state = await loadState();
    const items = state.activities || [];
    const entry = {
      id: nextActivityId(items),
      actor,
      action,
      target,
      meta,
      createdAt: new Date().toISOString()
    };
    items.unshift(entry);
    state.activities = items;
    await saveState(state);
    return entry;
  }

  const prisma = getPrisma();
  await ensureSeeded();
  return prisma.activityLog.create({ data: { actor, action, target, meta } });
}

async function addNotification(title, body, isRead = false) {
  if (!hasDatabaseUrl()) {
    const state = await loadState();
    const items = state.notifications || [];
    const entry = {
      id: nextNotificationId(items),
      title,
      body,
      isRead,
      createdAt: new Date().toISOString()
    };
    items.unshift(entry);
    state.notifications = items;
    await saveState(state);
    return entry;
  }

  const prisma = getPrisma();
  await ensureSeeded();
  return prisma.notification.create({ data: { title, body, isRead } });
}

export async function createTask(payload) {
  if (!hasDatabaseUrl()) {
    const state = await loadState();
    const task = { id: nextTaskId(state.tasks), ...payload };
    state.tasks.unshift(task);
    appendActivityToState(state, 'system', 'Created task', task.title, task.project);
    appendNotificationToState(state, 'Task created', `${task.title} was created in ${task.project}.`, false);
    await saveState(state);
    return task;
  }

  const prisma = getPrisma();
  await ensureSeeded();
  const task = await prisma.task.create({ data: payload });
  await addActivity('system', 'Created task', task.title, task.project);
  await addNotification('Task created', `${task.title} was created in ${task.project}.`, false);
  return normalizeTask(task);
}

export async function updateTask(id, payload) {
  if (!hasDatabaseUrl()) {
    const state = await loadState();
    const index = state.tasks.findIndex(task => Number(task.id) === Number(id));
    if (index < 0) return null;
    state.tasks[index] = { ...state.tasks[index], ...payload, id: state.tasks[index].id };
    appendActivityToState(state, 'system', 'Updated task', state.tasks[index].title, `status -> ${state.tasks[index].status}`);
    if (String(payload.status || '').toLowerCase().includes('delayed')) {
      appendNotificationToState(state, 'Task delayed', `${state.tasks[index].title} is now delayed.`, false);
    }
    await saveState(state);
    return state.tasks[index];
  }

  const prisma = getPrisma();
  await ensureSeeded();
  try {
    const task = await prisma.task.update({ where: { id: Number(id) }, data: payload });
    await addActivity('system', 'Updated task', task.title, `status -> ${task.status}`);
    if (String(payload.status || '').toLowerCase().includes('delayed')) {
      await addNotification('Task delayed', `${task.title} is now delayed.`, false);
    }
    return normalizeTask(task);
  } catch (err) {
    if (err.code === 'P2025') return null;
    throw err;
  }
}

export async function deleteTask(id) {
  if (!hasDatabaseUrl()) {
    const state = await loadState();
    const existing = state.tasks.find(task => Number(task.id) === Number(id));
    const nextTasks = state.tasks.filter(task => Number(task.id) !== Number(id));
    if (nextTasks.length === state.tasks.length) return false;
    state.tasks = nextTasks;
    appendActivityToState(state, 'system', 'Deleted task', existing?.title || `Task #${id}`, existing?.project || null);
    appendNotificationToState(state, 'Task deleted', `${existing?.title || `Task #${id}`} was removed.`, false);
    await saveState(state);
    return true;
  }

  const prisma = getPrisma();
  await ensureSeeded();
  try {
    const existing = await prisma.task.findUnique({ where: { id: Number(id) } });
    await prisma.task.delete({ where: { id: Number(id) } });
    await addActivity('system', 'Deleted task', existing?.title || `Task #${id}`, existing?.project || null);
    await addNotification('Task deleted', `${existing?.title || `Task #${id}`} was removed.`, false);
    return true;
  } catch (err) {
    if (err.code === 'P2025') return false;
    throw err;
  }
}

export async function listProjects() {
  if (!hasDatabaseUrl()) {
    const state = await loadState();
    return state.projects;
  }

  const prisma = getPrisma();
  await ensureSeeded();
  return prisma.project.findMany({ orderBy: { id: 'asc' } });
}

export async function createProject(payload) {
  const project = {
    name: String(payload.name || '').trim(),
    progress: Math.max(0, Math.min(100, Number(payload.progress) || 0)),
    status: String(payload.status || 'active').trim() || 'active'
  };

  if (!project.name) return null;

  if (!hasDatabaseUrl()) {
    const state = await loadState();
    const nextId = (state.projects || []).reduce((max, item) => Math.max(max, Number(item.id) || 0), 0) + 1;
    const entry = { id: nextId, ...project };
    state.projects = [entry, ...(state.projects || [])];
    appendActivityToState(state, 'system', 'Created project', entry.name, entry.status);
    await saveState(state);
    return entry;
  }

  const prisma = getPrisma();
  await ensureSeeded();
  const entry = await prisma.project.create({ data: project });
  await addActivity('system', 'Created project', entry.name, entry.status);
  return entry;
}

export async function updateProject(id, payload) {
  const project = {
    name: payload.name !== undefined ? String(payload.name || '').trim() : undefined,
    progress: payload.progress !== undefined ? Math.max(0, Math.min(100, Number(payload.progress) || 0)) : undefined,
    status: payload.status !== undefined ? String(payload.status || '').trim() : undefined
  };

  if (!hasDatabaseUrl()) {
    const state = await loadState();
    const index = (state.projects || []).findIndex(item => Number(item.id) === Number(id));
    if (index < 0) return null;
    state.projects[index] = { ...state.projects[index], ...Object.fromEntries(Object.entries(project).filter(([, value]) => value !== undefined)), id: state.projects[index].id };
    appendActivityToState(state, 'system', 'Updated project', state.projects[index].name, state.projects[index].status);
    await saveState(state);
    return state.projects[index];
  }

  const prisma = getPrisma();
  await ensureSeeded();
  try {
    const entry = await prisma.project.update({ where: { id: Number(id) }, data: Object.fromEntries(Object.entries(project).filter(([, value]) => value !== undefined)) });
    await addActivity('system', 'Updated project', entry.name, entry.status);
    return entry;
  } catch (err) {
    if (err.code === 'P2025') return null;
    throw err;
  }
}

export async function deleteProject(id) {
  if (!hasDatabaseUrl()) {
    const state = await loadState();
    const existing = (state.projects || []).find(item => Number(item.id) === Number(id));
    const nextProjects = (state.projects || []).filter(item => Number(item.id) !== Number(id));
    if (nextProjects.length === (state.projects || []).length) return false;
    state.projects = nextProjects;
    appendActivityToState(state, 'system', 'Deleted project', existing?.name || `Project #${id}`, existing?.status || null);
    await saveState(state);
    return true;
  }

  const prisma = getPrisma();
  await ensureSeeded();
  try {
    const existing = await prisma.project.findUnique({ where: { id: Number(id) } });
    await prisma.project.delete({ where: { id: Number(id) } });
    await addActivity('system', 'Deleted project', existing?.name || `Project #${id}`, existing?.status || null);
    return true;
  } catch (err) {
    if (err.code === 'P2025') return false;
    throw err;
  }
}

export async function listRisks() {
  if (!hasDatabaseUrl()) {
    const state = await loadState();
    return state.risks;
  }

  const prisma = getPrisma();
  await ensureSeeded();
  return prisma.risk.findMany({ orderBy: { id: 'asc' } });
}

export async function listStakeholders() {
  if (!hasDatabaseUrl()) {
    return [
      { id: 1, name: 'Project Manager', concern: 'Delivery visibility' },
      { id: 2, name: 'Team Member', concern: 'Workload balance' },
      { id: 3, name: 'Client', concern: 'Business value' }
    ];
  }

  const prisma = getPrisma();
  await ensureSeeded();
  return prisma.stakeholder.findMany({ orderBy: { id: 'asc' } });
}

export async function listActivities(query = {}) {
  if (!hasDatabaseUrl()) {
    const state = await loadState();
    const result = applyActivityQuery(state.activities || [], query);
    return result.items;
  }

  const prisma = getPrisma();
  await ensureSeeded();
  const items = await prisma.activityLog.findMany();
  const result = applyActivityQuery(items, query);
  return result.items;
}

export async function listNotifications() {
  if (!hasDatabaseUrl()) {
    const state = await loadState();
    return state.notifications || [];
  }

  const prisma = getPrisma();
  await ensureSeeded();
  return prisma.notification.findMany({ orderBy: { id: 'desc' }, take: 20 });
}

export async function getProjectById(id) {
  if (!hasDatabaseUrl()) {
    const state = await loadState();
    const project = state.projects.find(item => Number(item.id) === Number(id));
    if (!project) return null;
    return summarizeProject(project, state.tasks || []);
  }

  const prisma = getPrisma();
  await ensureSeeded();
  const project = await prisma.project.findUnique({ where: { id: Number(id) } });
  if (!project) return null;
  const tasks = await prisma.task.findMany();
  return summarizeProject(project, tasks.map(normalizeTask));
}

export async function markAllNotificationsRead() {
  if (!hasDatabaseUrl()) {
    const state = await loadState();
    const notifications = (state.notifications || []).map(note => ({ ...note, isRead: true }));
    state.notifications = notifications;
    appendActivityToState(state, 'system', 'Marked all notifications read', 'notifications', null);
    await saveState(state);
    return notifications;
  }

  const prisma = getPrisma();
  await ensureSeeded();
  await prisma.notification.updateMany({ data: { isRead: true } });
  await addActivity('system', 'Marked all notifications read', 'notifications', null);
  return prisma.notification.findMany({ orderBy: { id: 'desc' }, take: 20 });
}

export async function bulkUpdateNotifications(ids = [], isRead = true) {
  const normalizedIds = ids.map(id => Number(id)).filter(Number.isFinite);
  if (!normalizedIds.length) return [];

  if (!hasDatabaseUrl()) {
    const state = await loadState();
    const notifications = (state.notifications || []).map(note => normalizedIds.includes(Number(note.id)) ? { ...note, isRead } : note);
    state.notifications = notifications;
    appendActivityToState(state, 'system', `${isRead ? 'Marked' : 'Marked'} notifications ${isRead ? 'read' : 'unread'}`, `notifications: ${normalizedIds.length}`, null);
    await saveState(state);
    return notifications.filter(note => normalizedIds.includes(Number(note.id)));
  }

  const prisma = getPrisma();
  await ensureSeeded();
  await prisma.notification.updateMany({ where: { id: { in: normalizedIds } }, data: { isRead } });
  await addActivity('system', `${isRead ? 'Marked' : 'Marked'} notifications ${isRead ? 'read' : 'unread'}`, `notifications: ${normalizedIds.length}`, null);
  return prisma.notification.findMany({ where: { id: { in: normalizedIds } }, orderBy: { id: 'desc' } });
}

export async function updateNotification(id, payload) {
  if (!hasDatabaseUrl()) {
    const state = await loadState();
    const notifications = state.notifications || [];
    const index = notifications.findIndex(note => Number(note.id) === Number(id));
    if (index < 0) return null;

    notifications[index] = {
      ...notifications[index],
      ...payload,
      id: notifications[index].id
    };
    state.notifications = notifications;
    appendActivityToState(state, 'system', payload.isRead ? 'Marked notification read' : 'Marked notification unread', notifications[index].title, null);
    await saveState(state);
    return notifications[index];
  }

  const prisma = getPrisma();
  await ensureSeeded();
  try {
    const notification = await prisma.notification.update({
      where: { id: Number(id) },
      data: { isRead: Boolean(payload.isRead) }
    });
    await addActivity('system', notification.isRead ? 'Marked notification read' : 'Marked notification unread', notification.title, null);
    return notification;
  } catch (err) {
    if (err.code === 'P2025') return null;
    throw err;
  }
}
