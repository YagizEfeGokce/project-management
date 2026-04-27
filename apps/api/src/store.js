import { readFile, writeFile, mkdir, access } from 'fs/promises';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = resolve(__dirname, 'data');
const seedFile = resolve(dataDir, 'seed.json');
const stateFile = resolve(dataDir, 'state.json');

export async function loadState() {
  try {
    await access(stateFile);
    return JSON.parse(await readFile(stateFile, 'utf8'));
  } catch {
    const seed = JSON.parse(await readFile(seedFile, 'utf8'));
    await mkdir(dataDir, { recursive: true });
    await writeFile(stateFile, JSON.stringify(seed, null, 2));
    return seed;
  }
}

export async function saveState(state) {
  await mkdir(dataDir, { recursive: true });
  await writeFile(stateFile, JSON.stringify(state, null, 2));
}

export function nextTaskId(tasks) {
  return tasks.reduce((max, task) => Math.max(max, Number(task.id) || 0), 0) + 1;
}

export function nextCommentId(comments) {
  return comments.reduce((max, comment) => Math.max(max, Number(comment.id) || 0), 0) + 1;
}

export function nextActivityId(items) {
  return items.reduce((max, item) => Math.max(max, Number(item.id) || 0), 0) + 1;
}

export function nextNotificationId(items) {
  return items.reduce((max, item) => Math.max(max, Number(item.id) || 0), 0) + 1;
}

export function buildSummary(state) {
  const totalTasks = state.tasks.length;
  const normalize = value => String(value || '').trim().toLowerCase();
  const doneTasks = state.tasks.filter(task => normalize(task.status) === 'done').length;
  const delayedTasks = state.tasks.filter(task => ['delayed', 'late'].includes(normalize(task.status))).length;

  return {
    completionRate: totalTasks ? Math.round((doneTasks / totalTasks) * 100) : 0,
    delayedTasks,
    activeMembers: state.summary?.activeMembers ?? 6,
    totalTasks,
    uptime: state.summary?.uptime ?? 99.94,
    responseTime: state.summary?.responseTime ?? 124
  };
}
