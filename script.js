let tasks = JSON.parse(localStorage.getItem('tasky_tasks') || '[]');
let editingId = null;
let currentFilter = 'all';
let currentCat = 'all';

// ── DOM REFS ──
const taskList      = document.getElementById('taskList');
const emptyState    = document.getElementById('emptyState');
const modalOverlay  = document.getElementById('modalOverlay');
const modalTitle    = document.getElementById('modalTitle');
const openModalBtn  = document.getElementById('openModal');
const closeModalBtn = document.getElementById('closeModal');
const cancelModal   = document.getElementById('cancelModal');
const saveTaskBtn   = document.getElementById('saveTask');
const searchInput   = document.getElementById('searchInput');
const sortSelect    = document.getElementById('sortSelect');
const progressFill  = document.getElementById('progress-fill');
const progressText  = document.getElementById('progress-text');
const toast         = document.getElementById('toast');

// ── HELPERS ──
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function saveTasks() {
  localStorage.setItem('tasky_tasks', JSON.stringify(tasks));
}

function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2500);
}

function formatDate(dateStr) {
  if (!dateStr) return null;
  const date = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((date - today) / 86400000);
  if (diff < 0)  return { label: `${Math.abs(diff)}d overdue`, overdue: true };
  if (diff === 0) return { label: 'Today', overdue: false };
  if (diff === 1) return { label: 'Tomorrow', overdue: false };
  return {
    label: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    overdue: false
  };
}

// ── RENDER ──
function getFilteredTasks() {
  const q = searchInput.value.trim().toLowerCase();
  let list = [...tasks];

  // status filter
  if (currentFilter === 'active')    list = list.filter(t => !t.completed);
  if (currentFilter === 'completed') list = list.filter(t => t.completed);

  // category filter
  if (currentCat !== 'all') list = list.filter(t => t.category === currentCat);

  // search
  if (q) list = list.filter(t =>
    t.title.toLowerCase().includes(q) ||
    (t.desc && t.desc.toLowerCase().includes(q))
  );

  // sort
  const sort = sortSelect.value;
  if (sort === 'newest')   list.sort((a, b) => b.createdAt - a.createdAt);
  if (sort === 'oldest')   list.sort((a, b) => a.createdAt - b.createdAt);
  if (sort === 'priority') {
    const p = { high: 0, medium: 1, low: 2 };
    list.sort((a, b) => p[a.priority] - p[b.priority]);
  }
  if (sort === 'alpha') list.sort((a, b) => a.title.localeCompare(b.title));

  return list;
}

function renderTasks() {
  const list = getFilteredTasks();
  taskList.innerHTML = '';

  if (list.length === 0) {
    taskList.appendChild(emptyState);
    emptyState.style.display = 'block';
    return;
  }
  emptyState.style.display = 'none';

  list.forEach(task => {
    const due = task.due ? formatDate(task.due) : null;
    const card = document.createElement('div');
    card.className = `task-card priority-${task.priority} ${task.completed ? 'completed' : ''}`;
    card.dataset.id = task.id;

    card.innerHTML = `
      <div class="task-check ${task.completed ? 'checked' : ''}" data-id="${task.id}">
        ${task.completed ? '✓' : ''}
      </div>
      <div class="task-body">
        <div class="task-title">${escapeHTML(task.title)}</div>
        ${task.desc ? `<div class="task-desc">${escapeHTML(task.desc)}</div>` : ''}
        <div class="task-meta">
          <span class="tag tag-priority-${task.priority}">${task.priority}</span>
          <span class="tag-cat">${task.category}</span>
          ${due ? `<span class="tag-due ${due.overdue ? 'overdue' : ''}">📅 ${due.label}</span>` : ''}
        </div>
      </div>
      <div class="task-actions">
        <button class="action-btn edit-btn" title="Edit" data-id="${task.id}">✎</button>
        <button class="action-btn delete-btn" title="Delete" data-id="${task.id}">✕</button>
      </div>
    `;
    taskList.appendChild(card);
  });

  updateCounts();
  updateProgress();
}

function escapeHTML(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function updateCounts() {
  document.getElementById('count-all').textContent       = tasks.length;
  document.getElementById('count-active').textContent    = tasks.filter(t => !t.completed).length;
  document.getElementById('count-completed').textContent = tasks.filter(t => t.completed).length;
}

function updateProgress() {
  const total = tasks.length;
  const done  = tasks.filter(t => t.completed).length;
  const pct   = total === 0 ? 0 : Math.round((done / total) * 100);
  progressFill.style.width = pct + '%';
  progressText.textContent = `${done} / ${total} done`;
}

// ── MODAL ──
function openModal(editTask = null) {
  editingId = editTask ? editTask.id : null;
  modalTitle.textContent = editTask ? 'Edit Task' : 'New Task';
  document.getElementById('taskTitle').value    = editTask ? editTask.title    : '';
  document.getElementById('taskDesc').value     = editTask ? editTask.desc     : '';
  document.getElementById('taskPriority').value = editTask ? editTask.priority : 'medium';
  document.getElementById('taskCategory').value = editTask ? editTask.category : 'work';
  document.getElementById('taskDue').value      = editTask ? editTask.due      : '';
  modalOverlay.classList.add('open');
  setTimeout(() => document.getElementById('taskTitle').focus(), 100);
}

function closeModal() {
  modalOverlay.classList.remove('open');
  editingId = null;
}

function saveTask() {
  const title = document.getElementById('taskTitle').value.trim();
  if (!title) {
    document.getElementById('taskTitle').style.borderColor = 'var(--danger)';
    setTimeout(() => document.getElementById('taskTitle').style.borderColor = '', 1500);
    return;
  }

  const taskData = {
    title,
    desc:      document.getElementById('taskDesc').value.trim(),
    priority:  document.getElementById('taskPriority').value,
    category:  document.getElementById('taskCategory').value,
    due:       document.getElementById('taskDue').value,
    completed: false,
    createdAt: Date.now()
  };

  if (editingId) {
    const idx = tasks.findIndex(t => t.id === editingId);
    if (idx !== -1) {
      taskData.completed = tasks[idx].completed;
      taskData.createdAt = tasks[idx].createdAt;
      taskData.id = editingId;
      tasks[idx] = taskData;
      showToast('✎ Task updated!');
    }
  } else {
    taskData.id = generateId();
    tasks.unshift(taskData);
    showToast('✦ Task added!');
  }

  saveTasks();
  closeModal();
  renderTasks();
}

// ── TOGGLE COMPLETE ──
function toggleComplete(id) {
  const task = tasks.find(t => t.id === id);
  if (task) {
    task.completed = !task.completed;
    saveTasks();
    renderTasks();
    showToast(task.completed ? '✓ Task completed!' : '↩ Marked as active');
  }
}

// ── DELETE ──
function deleteTask(id) {
  tasks = tasks.filter(t => t.id !== id);
  saveTasks();
  renderTasks();
  showToast('✕ Task deleted');
}

// ── EVENT DELEGATION ──
taskList.addEventListener('click', e => {
  const checkEl  = e.target.closest('.task-check');
  const editEl   = e.target.closest('.edit-btn');
  const deleteEl = e.target.closest('.delete-btn');

  if (checkEl)  toggleComplete(checkEl.dataset.id);
  if (deleteEl) deleteTask(deleteEl.dataset.id);
  if (editEl) {
    const task = tasks.find(t => t.id === editEl.dataset.id);
    if (task) openModal(task);
  }
});

// ── NAV FILTER ──
document.querySelectorAll('.nav-item').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentFilter = btn.dataset.filter;
    renderTasks();
  });
});

// ── CATEGORY FILTER ──
document.querySelectorAll('.cat-chip').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.cat-chip').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentCat = btn.dataset.cat;
    renderTasks();
  });
});

// ── SEARCH & SORT ──
searchInput.addEventListener('input', renderTasks);
sortSelect.addEventListener('change', renderTasks);

// ── MODAL TRIGGERS ──
openModalBtn.addEventListener('click', () => openModal());
closeModalBtn.addEventListener('click', closeModal);
cancelModal.addEventListener('click', closeModal);
saveTaskBtn.addEventListener('click', saveTask);

// Close on overlay click
modalOverlay.addEventListener('click', e => {
  if (e.target === modalOverlay) closeModal();
});

// Keyboard
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeModal();
  if (e.key === 'Enter' && modalOverlay.classList.contains('open') && e.target.id !== 'taskDesc') {
    saveTask();
  }
});

// ── SEED DEMO TASKS (first run) ──
if (tasks.length === 0) {
  tasks = [
    {
      id: generateId(), title: 'Review internship project requirements',
      desc: 'Go through all 4 project topics and plan timeline.',
      priority: 'high', category: 'work', due: '', completed: false, createdAt: Date.now() - 3000
    },
    {
      id: generateId(), title: 'Build To-Do Task Manager',
      desc: 'Complete the first internship project with HTML, CSS & JS.',
      priority: 'high', category: 'work', due: '', completed: true, createdAt: Date.now() - 2000
    },
    {
      id: generateId(), title: 'Push projects to GitHub',
      desc: 'Create repos and submit links for evaluation.',
      priority: 'medium', category: 'work', due: '', completed: false, createdAt: Date.now() - 1000
    },
    {
      id: generateId(), title: 'Morning workout',
      desc: '30 min run + stretching.',
      priority: 'low', category: 'health', due: '', completed: false, createdAt: Date.now()
    }
  ];
  saveTasks();
}

// ── INIT ──
renderTasks();