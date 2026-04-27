import { useEffect, useMemo, useState } from 'react';

const tabs = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'tasks', label: 'Tasks' },
  { key: 'projects', label: 'Projects' },
  { key: 'risks', label: 'Risks' },
  { key: 'stakeholders', label: 'Stakeholders' },
  { key: 'activity', label: 'Activity' },
  { key: 'notifications', label: 'Notifications' }
];

const fallbackSummary = {
  completionRate: 78,
  delayedTasks: 7,
  activeMembers: 6,
  totalTasks: 42,
  uptime: 99.94,
  responseTime: 124
};

const sectionMeta = {
  dashboard: {
    title: 'Project Dashboard',
    copy: 'Track delivery, risk, and system health from one live view.'
  },
  tasks: {
    title: 'Tasks',
    copy: 'Find, update, and prioritize work without losing context.'
  },
  projects: {
    title: 'Projects',
    copy: 'Review delivery progress and spot stalled work quickly.'
  },
  risks: {
    title: 'Risks',
    copy: 'Keep blockers visible before they affect the sprint.'
  },
  stakeholders: {
    title: 'Stakeholders',
    copy: 'Understand what each stakeholder needs and where concerns are rising.'
  },
  activity: {
    title: 'Activity',
    copy: 'Audit the latest changes, comments, and system events.'
  },
  notifications: {
    title: 'Notifications',
    copy: 'Keep team alerts organized and make unread items easy to resolve.'
  }
};

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [authToken, setAuthToken] = useState(() => localStorage.getItem('taskflow_token') || '');
  const [authUser, setAuthUser] = useState(() => {
    try {
      const raw = localStorage.getItem('taskflow_user');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const [loginForm, setLoginForm] = useState({ email: 'admin@taskflow.local', password: 'admin123' });
  const [loginError, setLoginError] = useState('');
  const [authReady, setAuthReady] = useState(false);
  const [summary, setSummary] = useState(fallbackSummary);
  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [risks, setRisks] = useState([]);
  const [stakeholders, setStakeholders] = useState([]);
  const [activities, setActivities] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [activityQuery, setActivityQuery] = useState('');
  const [activityActor, setActivityActor] = useState('all');
  const [activityKind, setActivityKind] = useState('all');
  const [activityFrom, setActivityFrom] = useState('');
  const [activityTo, setActivityTo] = useState('');
  const [taskQuery, setTaskQuery] = useState('');
  const [taskStatusFilter, setTaskStatusFilter] = useState('all');
  const [status, setStatus] = useState('connecting');
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [taskForm, setTaskForm] = useState(emptyTaskForm);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [taskComments, setTaskComments] = useState([]);
  const [commentForm, setCommentForm] = useState('');
  const [projectDetailOpen, setProjectDetailOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);
  const canManageTasks = ['admin', 'manager'].includes(authUser?.role);

  useEffect(() => {
    boot();
  }, []);

  async function boot() {
    if (!authToken) {
      setAuthReady(true);
      return;
    }

    try {
      const response = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${authToken}` }
      });

      if (!response.ok) throw new Error('unauthorized');
      setAuthUser(await response.json());
      await loadData(authToken);
    } catch {
      logout();
    } finally {
      setAuthReady(true);
    }
  }

  async function loadData(token = authToken) {
    try {
      const [summaryRes, tasksRes, projectsRes, risksRes, stakeholdersRes, activitiesRes, notificationsRes] = await Promise.all([
        authedFetch('/api/dashboard/summary', token),
        authedFetch('/api/tasks', token),
        authedFetch('/api/projects', token),
        authedFetch('/api/risks', token),
        authedFetch('/api/stakeholders', token),
        authedFetch('/api/activities', token),
        authedFetch('/api/notifications', token)
      ]);

      setSummary(await summaryRes.json());
      setTasks(await tasksRes.json());
      setProjects(await projectsRes.json());
      setRisks(await risksRes.json());
      setStakeholders(await stakeholdersRes.json());
      setActivities(await activitiesRes.json());
      setNotifications(await notificationsRes.json());
      setStatus('live');
    } catch {
      setStatus('offline');
    }
  }

  async function login(event) {
    event.preventDefault();
    setLoginError('');

    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(loginForm)
    });

    if (!response.ok) {
      setLoginError('Sign in failed. Check your details.');
      return;
    }

    const data = await response.json();
    localStorage.setItem('taskflow_token', data.token);
    localStorage.setItem('taskflow_user', JSON.stringify(data.user));
    setAuthToken(data.token);
    setAuthUser(data.user);
    setAuthReady(true);
    await loadData(data.token);
  }

  function logout() {
    localStorage.removeItem('taskflow_token');
    localStorage.removeItem('taskflow_user');
    setAuthToken('');
    setAuthUser(null);
    setTasks([]);
    setProjects([]);
    setRisks([]);
    setStakeholders([]);
    setActivities([]);
    setNotifications([]);
    setStatus('connecting');
  }

  function authedFetch(url, token = authToken, options = {}) {
    return fetch(url, {
      ...options,
      headers: {
        ...(options.headers || {}),
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
  }

  const delayedTasks = useMemo(() => tasks.filter(task => String(task.status).toLowerCase() === 'delayed').slice(0, 3), [tasks]);
  const projectOptions = projects.map(project => project.name);
  const unreadNotifications = notifications.filter(note => !note.isRead).length;
  const needsAttentionCount = delayedTasks.length + unreadNotifications;
  const activeSection = sectionMeta[activeTab] || sectionMeta.dashboard;
  const projectStats = useMemo(() => ({
    total: projects.length,
    active: projects.filter(project => String(project.status).toLowerCase() === 'active').length,
    planned: projects.filter(project => String(project.status).toLowerCase() === 'planned').length,
    completed: projects.filter(project => String(project.status).toLowerCase() === 'completed').length
  }), [projects]);
  const riskStats = useMemo(() => ({
    total: risks.length,
    high: risks.filter(risk => String(risk.severity).toLowerCase() === 'high').length,
    medium: risks.filter(risk => String(risk.severity).toLowerCase() === 'medium').length,
    low: risks.filter(risk => String(risk.severity).toLowerCase() === 'low').length
  }), [risks]);
  const filteredTasks = useMemo(() => {
    const query = taskQuery.trim().toLowerCase();
    return tasks.filter(task => {
      const matchesQuery = !query || [task.title, task.project, task.priority, task.status, task.assignee]
        .filter(Boolean)
        .some(value => String(value).toLowerCase().includes(query));
      const matchesStatus = taskStatusFilter === 'all' || String(task.status).toLowerCase() === taskStatusFilter;
      return matchesQuery && matchesStatus;
    });
  }, [tasks, taskQuery, taskStatusFilter]);
  const taskStats = useMemo(() => ({
    total: tasks.length,
    inProgress: tasks.filter(task => String(task.status).toLowerCase() === 'in progress').length,
    delayed: tasks.filter(task => String(task.status).toLowerCase() === 'delayed').length,
    done: tasks.filter(task => String(task.status).toLowerCase() === 'done').length
  }), [tasks]);
  const activityActors = useMemo(() => [...new Set(activities.map(item => item.actor).filter(Boolean))], [activities]);
  const filteredActivities = useMemo(() => {
    const query = activityQuery.trim().toLowerCase();
    const from = activityFrom ? new Date(`${activityFrom}T00:00:00`) : null;
    const to = activityTo ? new Date(`${activityTo}T23:59:59.999`) : null;

    return activities.filter(item => {
      const kind = getActivityKind(item.action);
      const createdAt = item.createdAt ? new Date(item.createdAt) : null;
      const matchesQuery = !query || [item.action, item.actor, item.target, item.meta]
        .filter(Boolean)
        .some(value => String(value).toLowerCase().includes(query));
      const matchesActor = activityActor === 'all' || item.actor === activityActor;
      const matchesKind = activityKind === 'all' || kind === activityKind;
      const matchesFrom = !from || !createdAt || createdAt >= from;
      const matchesTo = !to || !createdAt || createdAt <= to;
      return matchesQuery && matchesActor && matchesKind && matchesFrom && matchesTo;
    });
  }, [activities, activityActor, activityKind, activityFrom, activityQuery, activityTo]);

  function openCreateTask() {
    setEditingTask(null);
    setTaskForm(emptyTaskForm);
    setTaskModalOpen(true);
  }

  function openEditTask(task) {
    setEditingTask(task);
    setTaskForm({
      title: task.title || '',
      project: task.project || '',
      status: task.status || 'To Do',
      priority: task.priority || 'Medium',
      assignee: task.assignee || '',
      dueDate: task.dueDate || '',
      description: task.description || ''
    });
    setTaskModalOpen(true);
  }

  async function openProjectDetail(project) {
    const response = await authedFetch(`/api/projects/${project.id}`);
    if (!response.ok) return;
    setSelectedProject(await response.json());
    setProjectDetailOpen(true);
  }

  async function openTaskDetail(task) {
    setSelectedTask(task);
    setDetailOpen(true);
    setTaskComments([]);
    setCommentForm('');

    const response = await authedFetch(`/api/tasks/${task.id}/comments`);
    if (response.ok) {
      setTaskComments(await response.json());
    }
  }

  async function saveComment(event) {
    event.preventDefault();
    if (!selectedTask || !commentForm.trim()) return;

    const response = await authedFetch(`/api/tasks/${selectedTask.id}/comments`, {
      method: 'POST',
      body: JSON.stringify({ body: commentForm })
    });

    if (!response.ok) return;

    setCommentForm('');
    const refreshed = await authedFetch(`/api/tasks/${selectedTask.id}/comments`);
    if (refreshed.ok) setTaskComments(await refreshed.json());
  }

  async function saveTask(event) {
    event.preventDefault();
    const payload = { ...taskForm };
    const method = editingTask ? 'PATCH' : 'POST';
    const url = editingTask ? `/api/tasks/${editingTask.id}` : '/api/tasks';

    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
      body: JSON.stringify(payload)
    });

    if (!response.ok) return;

    setTaskModalOpen(false);
    setEditingTask(null);
    setTaskForm(emptyTaskForm);
    await loadData();
  }

  async function removeTask(id) {
    const response = await fetch(`/api/tasks/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${authToken}` } });
    if (!response.ok && response.status !== 204) return;
    if (selectedTask?.id === id) {
      setDetailOpen(false);
      setSelectedTask(null);
      setTaskComments([]);
    }
    await loadData();
  }

  async function toggleNotification(notification) {
    const response = await authedFetch(`/api/notifications/${notification.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ isRead: !notification.isRead })
    });

    if (!response.ok) return;
    await loadData();
  }

  if (!authReady) {
    return <div className="auth-screen">Loading...</div>;
  }

  if (!authToken) {
    return (
      <div className="auth-screen">
        <form className="auth-card" onSubmit={login}>
          <div className="auth-badge">TaskFlow</div>
          <p className="auth-kicker">Operations workspace</p>
          <h1>Sign in</h1>
          <p className="muted">A cleaner view for tasks, projects, alerts, and team health.</p>
          <div className="auth-features">
            <span>Live task board</span>
            <span>Risk visibility</span>
            <span>Team activity log</span>
          </div>
          <label>
            Email
            <input value={loginForm.email} onChange={e => setLoginForm({ ...loginForm, email: e.target.value })} />
          </label>
          <label>
            Password
            <input type="password" value={loginForm.password} onChange={e => setLoginForm({ ...loginForm, password: e.target.value })} />
          </label>
          {loginError && <div className="auth-error">{loginError}</div>}
          <button className="primary-btn" type="submit">Sign in</button>
          <div className="auth-hint">Demo: <code>admin@taskflow.local</code> / <code>admin123</code></div>
        </form>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">T</div>
          <div>
            <div className="brand-title">TaskFlow</div>
            <div className="brand-sub">Team Productivity</div>
          </div>
        </div>
        <nav className="nav-list">
          {tabs.map(tab => (
            <button
              key={tab.key}
              className={activeTab === tab.key ? 'nav-item active' : 'nav-item'}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </nav>
        <div className="status-card">
          <span className={`status-dot ${status}`} />
          <div>
            <div className="status-title">System</div>
            <div className="status-sub">{status}</div>
          </div>
        </div>
        <div className="sidebar-insights">
          <div>
            <span>Completion</span>
            <strong>{summary.completionRate}%</strong>
          </div>
          <div>
            <span>Delayed</span>
            <strong>{summary.delayedTasks}</strong>
          </div>
          <div>
            <span>Unread</span>
            <strong>{unreadNotifications}</strong>
          </div>
        </div>
        <div className="user-card">
          <div>
            <div className="status-title">{authUser?.name || 'User'}</div>
            <div className="status-sub">{authUser?.role || 'member'}</div>
          </div>
          <button className="mini-btn" onClick={logout}>Logout</button>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <h1>{activeSection.title}</h1>
          </div>
        </header>

        {activeTab === 'dashboard' && (
          <>
            <section className="dashboard-intro">
              <div>
                <h2>Your work at a glance.</h2>
              </div>
            </section>

            <section className="hero-panel">
              <div className="hero-copy">
                <div className="hero-kicker">TaskFlow</div>
                <h2>Overview</h2>
                <div className="hero-actions">
                  {canManageTasks && <button className="primary-btn subtle" onClick={openCreateTask}>Create Task</button>}
                  <button className="ghost-btn" onClick={() => setActiveTab('tasks')}>Open Tasks</button>
                </div>
              </div>
              <div className="hero-stack">
                <div className="hero-summary">
                  <div className="hero-summary-head">
                    <span>Today</span>
                    <strong>{needsAttentionCount} items</strong>
                  </div>
                  <div className="hero-summary-list">
                    <div>
                      <span>Open tasks</span>
                      <strong>{summary.totalTasks}</strong>
                    </div>
                    <div>
                      <span>Delayed</span>
                      <strong>{summary.delayedTasks}</strong>
                    </div>
                    <div>
                      <span>Unread</span>
                      <strong>{unreadNotifications}</strong>
                    </div>
                    <div>
                      <span>Active team</span>
                      <strong>{summary.activeMembers}</strong>
                    </div>
                  </div>
                </div>
              </div>
            </section>
            <section className="dashboard-focus">
              <Panel title="Today's focus">
                <p className="panel-subcopy">Start here to keep the team moving.</p>
                <div className="focus-list">
                  <div className="focus-row">
                    <span>Delayed tasks</span>
                    <strong>{delayedTasks.length}</strong>
                  </div>
                  <div className="focus-row">
                    <span>Unread alerts</span>
                    <strong>{unreadNotifications}</strong>
                  </div>
                  <div className="focus-row">
                    <span>Completed</span>
                    <strong>{taskStats.done}</strong>
                  </div>
                </div>
                <div className="hero-actions compact">
                  <button className="ghost-btn" onClick={() => setActiveTab('notifications')}>Open alerts</button>
                  <button className="ghost-btn" onClick={() => setActiveTab('tasks')}>Review tasks</button>
                </div>
              </Panel>

              <Panel title="Recent updates">
                <div className="compact-list">
                  {tasks.slice(0, 5).map(task => (
                    <button key={task.id} className="compact-item" onClick={() => openTaskDetail(task)}>
                      <div>
                        <strong>{task.title}</strong>
                        <span>{task.project}</span>
                      </div>
                      <div className="compact-item-meta">
                        <span>{task.status}</span>
                        <small>{task.assignee}</small>
                      </div>
                    </button>
                  ))}
                </div>
              </Panel>

              <Panel title="Risks">
                <div className="risk-list">
                  {risks.slice(0, 3).map(risk => (
                    <div key={risk.id} className="risk-row compact-risk">
                      <div>
                        <div className="risk-title">{risk.title}</div>
                        <div className="risk-sub">{risk.category}</div>
                      </div>
                      <span className={`risk-pill ${risk.severity.toLowerCase()}`}>{risk.severity}</span>
                    </div>
                  ))}
                  {!risks.length && <div className="empty-state">No active risks right now.</div>}
                </div>
              </Panel>
            </section>
          </>
        )}

        {activeTab === 'tasks' && (
          <Panel title="Task Board">
            <section className="tasks-hero">
              <div>
                <p className="panel-kicker">Manage delivery</p>
                <h2>Tasks</h2>
                <p className="panel-subcopy">A focused view for tracking work by status, assignee, and priority.</p>
              </div>
              <div className="tasks-hero-stats">
                <div>
                  <span>Total</span>
                  <strong>{taskStats.total}</strong>
                </div>
                <div>
                  <span>In progress</span>
                  <strong>{taskStats.inProgress}</strong>
                </div>
                <div>
                  <span>Delayed</span>
                  <strong>{taskStats.delayed}</strong>
                </div>
                <div>
                  <span>Done</span>
                  <strong>{taskStats.done}</strong>
                </div>
              </div>
            </section>
            <div className="task-filter-bar task-filter-shell">
              <input
                className="filter-input task-search"
                value={taskQuery}
                onChange={e => setTaskQuery(e.target.value)}
                placeholder="Search tasks"
              />
              <select className="filter-select task-select" value={taskStatusFilter} onChange={e => setTaskStatusFilter(e.target.value)}>
                <option value="all">All statuses</option>
                <option value="to do">To Do</option>
                <option value="in progress">In Progress</option>
                <option value="done">Done</option>
                <option value="delayed">Delayed</option>
              </select>
              <div className="hero-pill task-count-pill">{filteredTasks.length} shown</div>
            </div>
            <section className="task-grid">
              {filteredTasks.map(task => (
                <article key={task.id} className="task-card">
                  <div className="task-card-head">
                    <div>
                      <button className="task-link" onClick={() => openTaskDetail(task)}>{task.title}</button>
                      <p>{task.project}</p>
                    </div>
                    <span className={`risk-pill ${String(task.status).toLowerCase().replaceAll(' ', '-')}`}>{task.status}</span>
                  </div>
                  <p className="task-card-note">{task.priority} • {task.assignee} • {task.dueDate || 'No due date'}</p>
                  <div className="task-card-actions">
                    <button className="ghost-btn" onClick={() => openTaskDetail(task)}>View</button>
                    {canManageTasks && <button className="ghost-btn" onClick={() => openEditTask(task)}>Edit</button>}
                    {canManageTasks && <button className="ghost-btn danger-btn" onClick={() => removeTask(task.id)}>Delete</button>}
                  </div>
                </article>
              ))}
            </section>
            {!filteredTasks.length && <div className="empty-state">No tasks match the current filters.</div>}
          </Panel>
        )}

        {activeTab === 'projects' && (
          <>
            <section className="tasks-hero projects-hero">
              <div>
                <p className="panel-kicker">Portfolio view</p>
                <h2>Projects</h2>
                <p className="panel-subcopy">A clean overview of delivery, status, and overall progress.</p>
              </div>
              <div className="tasks-hero-stats">
                <div>
                  <span>Total</span>
                  <strong>{projectStats.total}</strong>
                </div>
                <div>
                  <span>Active</span>
                  <strong>{projectStats.active}</strong>
                </div>
                <div>
                  <span>Planned</span>
                  <strong>{projectStats.planned}</strong>
                </div>
                <div>
                  <span>Completed</span>
                  <strong>{projectStats.completed}</strong>
                </div>
              </div>
            </section>

            <section className="card-grid projects-grid projects-grid-clean">
              {projects.map(project => (
                <article key={project.id} className="project-card project-card-modern" onClick={() => openProjectDetail(project)}>
                  <div className="project-head">
                    <div>
                      <p className="project-kicker">Project</p>
                      <h3>{project.name}</h3>
                    </div>
                    <span className="project-badge">{project.status}</span>
                  </div>
                  <div className="project-meta">
                    <span>Progress</span>
                    <strong>{project.progress}%</strong>
                  </div>
                  <div className="track project-track">
                    <div className="fill" style={{ width: `${project.progress}%`, background: 'linear-gradient(90deg, #6e49ff, #b05cff 55%, #ff76ac)' }} />
                  </div>
                  <div className="project-foot">
                    <span>{project.taskCount} tasks</span>
                    <span>{project.delayedTasks} delayed</span>
                  </div>
                </article>
              ))}
              {!projects.length && <div className="empty-state full-span">No projects yet.</div>}
            </section>
          </>
        )}

        {activeTab === 'risks' && (
          <>
            <section className="tasks-hero risks-hero">
              <div>
                <p className="panel-kicker">Risk view</p>
                <h2>Risks</h2>
                <p className="panel-subcopy">A focused view of blockers, severity, and what needs attention.</p>
              </div>
              <div className="tasks-hero-stats">
                <div>
                  <span>Total</span>
                  <strong>{riskStats.total}</strong>
                </div>
                <div>
                  <span>High</span>
                  <strong>{riskStats.high}</strong>
                </div>
                <div>
                  <span>Medium</span>
                  <strong>{riskStats.medium}</strong>
                </div>
                <div>
                  <span>Low</span>
                  <strong>{riskStats.low}</strong>
                </div>
              </div>
            </section>

            <section className="card-grid risks-grid">
              {risks.map(risk => (
                <article key={risk.id} className={`risk-card-modern ${risk.severity.toLowerCase()}`}>
                  <div className="risk-card-head">
                    <div>
                      <p className="risk-kicker">{risk.category}</p>
                      <h3>{risk.title}</h3>
                    </div>
                    <span className={`risk-pill ${risk.severity.toLowerCase()}`}>{risk.severity}</span>
                  </div>
                  <p className="risk-card-copy">Track this item before it affects the sprint.</p>
                </article>
              ))}
              {!risks.length && <div className="empty-state full-span">No active risks right now.</div>}
            </section>
          </>
        )}

        {activeTab === 'stakeholders' && (
          <>
            <section className="tasks-hero stakeholders-hero">
              <div className="tasks-hero-stats">
                <div>
                  <span>Total</span>
                  <strong>{stakeholders.length}</strong>
                </div>
                <div>
                  <span>Aligned</span>
                  <strong>{Math.max(0, stakeholders.length - 1)}</strong>
                </div>
                <div>
                  <span>Watching</span>
                  <strong>{stakeholders.length ? 1 : 0}</strong>
                </div>
                <div>
                  <span>Open items</span>
                  <strong>{stakeholders.length}</strong>
                </div>
              </div>
            </section>

            <section className="card-grid stakeholders-grid">
              {stakeholders.map(person => (
                <article
                  key={person.id}
                  className={`project-card stakeholder-card-modern stakeholder-tone-${person.id % 4}`}
                >
                  <div className="project-head">
                    <h3>{person.name}</h3>
                  </div>
                  <p className="stakeholder-copy">{person.concern}</p>
                </article>
              ))}
              {!stakeholders.length && <div className="empty-state full-span">No stakeholders yet.</div>}
            </section>
          </>
        )}

        {activeTab === 'activity' && (
          <Panel title="Activity Log">
            <section className="tasks-hero activity-hero">
              <div>
                <h2>Timeline</h2>
              </div>
              <div className="tasks-hero-stats">
                <div>
                  <span>Shown</span>
                  <strong>{filteredActivities.length}</strong>
                </div>
                <div>
                  <span>Actors</span>
                  <strong>{activityActors.length}</strong>
                </div>
                <div>
                  <span>Task</span>
                  <strong>{filteredActivities.filter(item => getActivityKind(item.action) === 'task').length}</strong>
                </div>
                <div>
                  <span>System</span>
                  <strong>{filteredActivities.filter(item => getActivityKind(item.action) === 'system').length}</strong>
                </div>
              </div>
            </section>

            <div className="activity-filters activity-filters-modern">
              <input
                className="filter-input"
                value={activityQuery}
                onChange={e => setActivityQuery(e.target.value)}
                placeholder="Search activity..."
              />
              <input
                className="filter-input"
                type="date"
                value={activityFrom}
                onChange={e => setActivityFrom(e.target.value)}
                aria-label="Activity from date"
              />
              <input
                className="filter-input"
                type="date"
                value={activityTo}
                onChange={e => setActivityTo(e.target.value)}
                aria-label="Activity to date"
              />
              <select className="filter-select" value={activityActor} onChange={e => setActivityActor(e.target.value)}>
                <option value="all">All actors</option>
                {activityActors.map(actor => <option key={actor} value={actor}>{actor}</option>)}
              </select>
              <select className="filter-select" value={activityKind} onChange={e => setActivityKind(e.target.value)}>
                <option value="all">All types</option>
                <option value="task">Task</option>
                <option value="comment">Comment</option>
                <option value="notification">Notification</option>
                <option value="system">System</option>
              </select>
              <button
                className="mini-btn activity-clear"
                type="button"
                onClick={() => {
                  setActivityQuery('');
                  setActivityActor('all');
                  setActivityKind('all');
                  setActivityFrom('');
                  setActivityTo('');
                }}
              >
                Clear
              </button>
            </div>
            <div className="timeline-list">
              {filteredActivities.map(item => (
                <div key={item.id} className="timeline-row timeline-row-modern">
                  <div className="timeline-dot timeline-dot-modern" />
                  <div>
                    <div className="risk-title">{item.action}</div>
                    <div className="risk-sub">{item.actor} · {item.target || 'system'} · {item.createdAt ? new Date(item.createdAt).toLocaleDateString('en-US') : ''}</div>
                  </div>
                  <span className="risk-pill low">{getActivityKind(item.action)}</span>
                </div>
              ))}
              {!filteredActivities.length && <div className="muted">No activities match the current filters.</div>}
            </div>
          </Panel>
        )}

        {activeTab === 'notifications' && (
          <Panel title="Notifications">
            <section className="tasks-hero notifications-hero">
              <div>
                <h2>Inbox</h2>
              </div>
              <div className="tasks-hero-stats">
                <div>
                  <span>Total</span>
                  <strong>{notifications.length}</strong>
                </div>
                <div>
                  <span>Unread</span>
                  <strong>{notifications.filter(note => !note.isRead).length}</strong>
                </div>
              </div>
            </section>

            <div className="toolbar-actions notifications-actions">
              <button className="ghost-btn" type="button" onClick={async () => { await authedFetch('/api/notifications/mark-all-read', { method: 'POST' }); await loadData(); }}>
                Mark all read
              </button>
            </div>

            <div className="notifications-grid">
              {notifications.map(note => (
                <article key={note.id} className={`notification-card ${note.isRead ? 'read' : 'unread'}`}>
                  <div className="notification-head">
                    <div>
                      <div className="notification-title">{note.title}</div>
                      <div className="notification-body">{note.body}</div>
                    </div>
                    <span className={`risk-pill ${note.isRead ? 'low' : 'high'}`}>{note.isRead ? 'Read' : 'New'}</span>
                  </div>
                  <div className="notification-actions">
                    <button className="mini-btn" onClick={() => toggleNotification(note)}>{note.isRead ? 'Mark unread' : 'Mark read'}</button>
                  </div>
                </article>
              ))}
            </div>
            {!notifications.length && <div className="empty-state">No notifications yet.</div>}
          </Panel>
        )}

        {projectDetailOpen && selectedProject && (
          <div className="modal-backdrop" onClick={() => setProjectDetailOpen(false)}>
            <div className="modal-card detail-card project-detail-card" onClick={event => event.stopPropagation()}>
              <div className="modal-head">
                <div>
                  <div className="project-badge">Project Detail</div>
                  <h3 style={{ marginTop: 10 }}>{selectedProject.project?.name || selectedProject.name}</h3>
                </div>
                <button className="mini-btn" onClick={() => setProjectDetailOpen(false)}>Close</button>
              </div>
              <div className="detail-grid">
                <div className="detail-block">
                  <div className="detail-label">Task Count</div>
                  <div className="detail-value">{selectedProject.taskCount}</div>
                </div>
                <div className="detail-block">
                  <div className="detail-label">Completion Rate</div>
                  <div className="detail-value">{selectedProject.completionRate}%</div>
                </div>
                <div className="detail-block full-span">
                  <div className="detail-label">Delayed Tasks</div>
                  <div className="detail-value">{selectedProject.delayedTasks}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {taskModalOpen && (
          <div className="modal-backdrop" onClick={() => setTaskModalOpen(false)}>
            <div className="modal-card" onClick={event => event.stopPropagation()}>
              <div className="modal-head">
                <h3>{editingTask ? 'Edit Task' : 'New Task'}</h3>
                <button className="mini-btn" onClick={() => setTaskModalOpen(false)}>Close</button>
              </div>
              <form className="task-form" onSubmit={saveTask}>
                <label>
                  Title
                  <input value={taskForm.title} onChange={e => setTaskForm({ ...taskForm, title: e.target.value })} />
                </label>
                <label>
                  Project
                  <select value={taskForm.project} onChange={e => setTaskForm({ ...taskForm, project: e.target.value })}>
                    <option value="">Select project</option>
                    {projectOptions.map(option => <option key={option} value={option}>{option}</option>)}
                  </select>
                </label>
                <label>
                  Assignee
                  <input value={taskForm.assignee} onChange={e => setTaskForm({ ...taskForm, assignee: e.target.value })} />
                </label>
                <label>
                  Priority
                  <select value={taskForm.priority} onChange={e => setTaskForm({ ...taskForm, priority: e.target.value })}>
                    <option>Low</option>
                    <option>Medium</option>
                    <option>High</option>
                  </select>
                </label>
                <label>
                  Status
                  <select value={taskForm.status} onChange={e => setTaskForm({ ...taskForm, status: e.target.value })}>
                    <option>To Do</option>
                    <option>In Progress</option>
                    <option>Done</option>
                    <option>Delayed</option>
                  </select>
                </label>
                <label>
                  Due Date
                  <input type="date" value={taskForm.dueDate} onChange={e => setTaskForm({ ...taskForm, dueDate: e.target.value })} />
                </label>
                <label className="full-span">
                  Description
                  <textarea rows="4" value={taskForm.description} onChange={e => setTaskForm({ ...taskForm, description: e.target.value })} />
                </label>
                <div className="form-actions full-span">
                  <button type="button" className="ghost-btn" onClick={() => setTaskModalOpen(false)}>Cancel</button>
                  <button type="submit" className="primary-btn">{editingTask ? 'Save Changes' : 'Create Task'}</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {detailOpen && selectedTask && (
          <div className="modal-backdrop" onClick={() => setDetailOpen(false)}>
            <div className="modal-card detail-card" onClick={event => event.stopPropagation()}>
              <div className="modal-head">
                <div>
                  <div className="project-badge">Task Detail</div>
                  <h3 style={{ marginTop: 10 }}>{selectedTask.title}</h3>
                </div>
                <div className="row-actions">
                  {canManageTasks && <button className="mini-btn" onClick={() => openEditTask(selectedTask)}>Edit</button>}
                  <button className="mini-btn" onClick={() => setDetailOpen(false)}>Close</button>
                </div>
              </div>
              <div className="detail-grid">
                <div className="detail-block">
                  <div className="detail-label">Project</div>
                  <div className="detail-value">{selectedTask.project}</div>
                </div>
                <div className="detail-block">
                  <div className="detail-label">Assignee</div>
                  <div className="detail-value">{selectedTask.assignee}</div>
                </div>
                <div className="detail-block">
                  <div className="detail-label">Priority</div>
                  <div className="detail-value">{selectedTask.priority}</div>
                </div>
                <div className="detail-block">
                  <div className="detail-label">Status</div>
                  <div className="detail-value">{selectedTask.status}</div>
                </div>
                <div className="detail-block full-span">
                  <div className="detail-label">Due Date</div>
                  <div className="detail-value">{selectedTask.dueDate || 'Not set'}</div>
                </div>
                <div className="detail-block full-span">
                  <div className="detail-label">Description</div>
                  <div className="detail-value muted">{selectedTask.description || 'No description provided.'}</div>
                </div>
              </div>

              <div className="comments-head">
                <h4>Comments</h4>
                <span className="muted">{taskComments.length} items</span>
              </div>

              <div className="comment-list">
                {taskComments.length ? taskComments.map(comment => (
                  <div key={comment.id} className="comment-item">
                    <div className="comment-avatar">{String(comment.author || '?').slice(0, 2).toUpperCase()}</div>
                    <div className="comment-body">
                      <div className="comment-meta">
                        <strong>{comment.author}</strong>
                        <span>{comment.createdAt ? new Date(comment.createdAt).toLocaleString('en-US') : ''}</span>
                      </div>
                      <p>{comment.body}</p>
                    </div>
                  </div>
                )) : <div className="muted">No comments yet.</div>}
              </div>

              <form className="comment-form" onSubmit={saveComment}>
                <textarea rows="3" value={commentForm} onChange={e => setCommentForm(e.target.value)} placeholder="Write a comment..." />
                <div className="form-actions">
                  <button type="submit" className="primary-btn">Send Comment</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

const emptyTaskForm = {
  title: '',
  project: '',
  status: 'To Do',
  priority: 'Medium',
  assignee: '',
  dueDate: '',
  description: ''
};

function Metric({ label, value, tone }) {
  return (
    <article className={`metric-card ${tone}`}>
      <span className="metric-label">{label}</span>
      <strong className="metric-value">{value}</strong>
    </article>
  );
}

function Panel({ title, children }) {
  return (
    <section className="panel">
      <header className="panel-header">
        <h2>{title}</h2>
      </header>
      <div className="panel-body">{children}</div>
    </section>
  );
}

function HealthItem({ label, value }) {
  return (
    <div className="health-item">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function BreakdownItem({ label, value, tone }) {
  return (
    <div className={`breakdown-item ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function DataTable({ columns, rows }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>{columns.map(col => <th key={col}>{col}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index}>{row.map((cell, cellIndex) => <td key={`${index}-${cellIndex}`}>{cell}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function getActivityKind(action) {
  const value = String(action || '').toLowerCase();
  if (value.includes('comment')) return 'comment';
  if (value.includes('created')) return 'task';
  if (value.includes('updated') || value.includes('deleted')) return 'task';
  if (value.includes('notification')) return 'notification';
  return 'system';
}
