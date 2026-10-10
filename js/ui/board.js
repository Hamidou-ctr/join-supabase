import { el } from './dom.js';
import { buildAvatar } from './contacts.js';
import { formatDeadline } from '../utils/format.js';
import {
  CATEGORY_LABELS, COLUMNS, PRIORITY_LABELS, subtaskProgress,
} from '../utils/board.js';

const MAX_AVATARS = 4;

// Whitelist lookups: values from the DB never become a class name or URL unchecked.
function categoryClass(category) {
  return category === 'user_story' ? 'tag--story' : 'tag--technical';
}

function priorityIcon(priority) {
  return el('span', {
    className: `priority-mark priority-mark--${priority in PRIORITY_LABELS ? priority : 'medium'}`,
    attrs: { role: 'img', 'aria-label': `Priority: ${PRIORITY_LABELS[priority] ?? 'Medium'}` },
  });
}

function categoryTag(task) {
  return el('span', {
    className: `tag ${categoryClass(task.category)}`,
    text: CATEGORY_LABELS[task.category] ?? 'Task',
  });
}

function assigneeContacts(task, contactsById) {
  return task.task_assignees.map((row) => contactsById.get(row.contact_id)).filter(Boolean);
}

const TOUCH_HOLD_MS = 300;
const TOUCH_SLOP_PX = 8;
const MOUSE_SLOP_PX = 6;
const SCROLL_EDGE_PX = 70;
// The fixed bottom navigation covers the lower part of the board on phones.
const NAV_COVER_PX = 80;
const SCROLL_STEP_PX = 14;

// Pointer-based drag (native HTML5 drag is unreliable on cards that contain a button and does
// not exist on touch). Mouse: drag after a few px. Touch: press and hold, so normal swiping
// still scrolls the board. The board (and the hovered column) auto-scrolls near its edges.
function enableDrag(card, taskId, onDrop) {
  card.addEventListener('contextmenu', (event) => event.preventDefault());

  card.addEventListener('pointerdown', (event) => {
    const isTouch = event.pointerType === 'touch';
    if (!isTouch && event.button !== 0) return;

    const startX = event.clientX;
    const startY = event.clientY;
    let x = startX;
    let y = startY;
    let ghost = null;
    let offsetX = 0;
    let offsetY = 0;
    let target = null;
    let holdTimer = null;
    let frame = null;

    const setTarget = (next) => {
      if (target === next) return;
      target?.classList.remove('is-drop-target');
      target = next;
      target?.classList.add('is-drop-target');
    };

    const place = () => {
      ghost.style.left = `${x - offsetX}px`;
      ghost.style.top = `${y - offsetY}px`;
      setTarget(document.elementFromPoint(x, y)?.closest('.column') ?? null);
    };

    // Only the board's own scroll areas scroll, never the page.
    const edgeScroll = (scroller, cover) => {
      if (!scroller || scroller.scrollHeight <= scroller.clientHeight) return;
      const rect = scroller.getBoundingClientRect();
      if (y < rect.top + SCROLL_EDGE_PX) scroller.scrollTop -= SCROLL_STEP_PX;
      else if (y > rect.bottom - cover - SCROLL_EDGE_PX) scroller.scrollTop += SCROLL_STEP_PX;
    };

    const autoScroll = () => {
      if (!ghost) return;
      const mobile = window.matchMedia('(max-width: 47.99rem)').matches;
      edgeScroll(document.querySelector('.board-columns'), mobile ? NAV_COVER_PX : 0);
      edgeScroll(target?.querySelector('.column-list'), 0);
      place();
      frame = window.requestAnimationFrame(autoScroll);
    };

    const start = () => {
      const rect = card.getBoundingClientRect();
      offsetX = x - rect.left;
      offsetY = y - rect.top;
      ghost = card.cloneNode(true);
      ghost.classList.add('card--ghost');
      ghost.setAttribute('aria-hidden', 'true');
      ghost.style.width = `${rect.width}px`;
      document.body.append(ghost);
      card.classList.add('is-dragging');
      if (isTouch && navigator.vibrate) navigator.vibrate(15);
      place();
      frame = window.requestAnimationFrame(autoScroll);
    };

    // Once a drag runs, touch scrolling must be suppressed (needs a non-passive listener).
    const blockScroll = (touch) => {
      if (ghost) touch.preventDefault();
    };

    const finish = (end) => {
      window.clearTimeout(holdTimer);
      window.cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', finish);
      window.removeEventListener('touchmove', blockScroll);
      if (!ghost) return;
      ghost.remove();
      card.classList.remove('is-dragging');
      const status = target?.dataset.status;
      setTarget(null);
      ghost = null;
      // The click that follows a drag must not open the task.
      const swallow = (click) => click.stopPropagation();
      window.addEventListener('click', swallow, { capture: true, once: true });
      window.setTimeout(() => window.removeEventListener('click', swallow, { capture: true }), 0);
      if (end.type === 'pointerup' && status) onDrop(taskId, status);
    };

    function onMove(move) {
      x = move.clientX;
      y = move.clientY;
      if (ghost) {
        place();
        return;
      }
      const moved = Math.hypot(x - startX, y - startY);
      if (isTouch) {
        // Moving before the hold elapsed means the user is scrolling, not dragging.
        if (moved > TOUCH_SLOP_PX) finish({ type: 'pointercancel' });
      } else if (moved >= MOUSE_SLOP_PX) {
        start();
      }
    }

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', finish);
    window.addEventListener('touchmove', blockScroll, { passive: false });
    if (isTouch) holdTimer = window.setTimeout(start, TOUCH_HOLD_MS);
  });
}

function buildCard(task, contactsById, { onOpen, onDrop }) {
  const { total, done } = subtaskProgress(task);
  const contacts = assigneeContacts(task, contactsById);
  const children = [
    categoryTag(task),
    el('h3', { className: 'card-title', text: task.title }),
  ];
  if (task.description) children.push(el('p', { className: 'card-description', text: task.description }));

  if (total > 0) {
    const bar = el('progress', {
      className: 'card-progress',
      attrs: { max: String(total), value: String(done), 'aria-label': 'Subtask progress' },
    });
    children.push(el('div', { className: 'card-subtasks' }, [
      bar,
      el('span', { text: `${done}/${total} Subtasks` }),
    ]));
  }

  const avatars = contacts.slice(0, MAX_AVATARS).map((contact) => buildAvatar(contact));
  if (contacts.length > MAX_AVATARS) {
    avatars.push(el('span', { className: 'contact-avatar contact-avatar--more', text: `+${contacts.length - MAX_AVATARS}` }));
  }
  children.push(el('div', { className: 'card-footer' }, [
    el('div', { className: 'card-avatars' }, avatars),
    priorityIcon(task.priority),
  ]));

  const card = el('li', { className: 'card', attrs: { 'data-id': task.id } });
  const open = el('button', {
    className: 'card-button',
    attrs: { type: 'button', 'aria-label': `Open task: ${task.title}` },
  }, children);
  open.addEventListener('click', () => onOpen(task.id));
  card.append(open);
  enableDrag(card, task.id, onDrop);
  return card;
}

// groups: { [status]: task[] }. All task text is rendered with textContent only.
export function renderBoard(container, groups, contactsById, handlers) {
  const columns = COLUMNS.map(({ status, title }) => {
    const tasks = groups[status];
    const list = el('ul', { className: 'column-list', attrs: { 'data-status': status, 'aria-label': title } });
    if (tasks.length === 0) {
      list.append(el('li', { className: 'column-empty', text: `No tasks ${title}` }));
    }
    for (const task of tasks) list.append(buildCard(task, contactsById, handlers));

    const add = el('button', {
      className: 'column-add',
      attrs: { type: 'button', 'aria-label': `Add task to ${title}` },
    });
    add.addEventListener('click', () => handlers.onAdd(status));
    return el('section', { className: 'column', attrs: { 'data-status': status } }, [
      el('header', { className: 'column-header' }, [el('h2', { text: title }), add]),
      list,
    ]);
  });
  container.replaceChildren(...columns);
}

// Detail overlay content. `handlers`: onClose, onDelete, onEdit, onToggleSubtask(id, done), onMove(status).
export function renderTaskDetail(container, task, contactsById, handlers) {
  const close = el('button', {
    className: 'detail-close',
    attrs: { type: 'button', 'aria-label': 'Close' },
  }, [el('img', { attrs: { src: 'assets/img/close.svg', alt: '', width: '14', height: '14' } })]);
  close.addEventListener('click', handlers.onClose);

  const contacts = assigneeContacts(task, contactsById);
  const rows = [
    el('div', { className: 'detail-top' }, [categoryTag(task), close]),
    el('h2', { className: 'detail-title', attrs: { id: 'detail-title' }, text: task.title }),
  ];
  if (task.description) rows.push(el('p', { className: 'detail-description', text: task.description }));

  rows.push(el('dl', { className: 'detail-meta' }, [
    el('dt', { text: 'Due date:' }),
    el('dd', { text: formatDeadline(task.due_date) }),
    el('dt', { text: 'Priority:' }),
    el('dd', { className: 'detail-priority' }, [
      el('span', { text: PRIORITY_LABELS[task.priority] ?? 'Medium' }),
      priorityIcon(task.priority),
    ]),
  ]));

  rows.push(el('p', { className: 'detail-label', text: 'Assigned To:' }));
  rows.push(contacts.length
    ? el('ul', { className: 'detail-assignees' }, contacts.map((contact) => el('li', {}, [
      buildAvatar(contact),
      el('span', { text: contact.name }),
    ])))
    : el('p', { className: 'detail-none', text: 'Nobody assigned' }));

  rows.push(el('p', { className: 'detail-label', text: 'Subtasks' }));
  const subtasks = [...task.subtasks].sort((a, b) => a.created_at.localeCompare(b.created_at));
  rows.push(subtasks.length
    ? el('ul', { className: 'detail-subtasks' }, subtasks.map((subtask) => {
      const box = el('input', { attrs: { type: 'checkbox', id: `subtask-${subtask.id}` } });
      box.checked = subtask.done;
      box.addEventListener('change', () => handlers.onToggleSubtask(subtask.id, box.checked));
      return el('li', {}, [
        box,
        el('label', { text: subtask.title, attrs: { for: `subtask-${subtask.id}` } }),
      ]);
    }))
    : el('p', { className: 'detail-none', text: 'No subtasks' }));

  // Keyboard-accessible alternative to drag & drop.
  const select = el('select', { attrs: { id: 'detail-status' } }, COLUMNS.map(({ status, title }) => {
    const option = el('option', { text: title, attrs: { value: status } });
    option.selected = status === task.status;
    return option;
  }));
  select.addEventListener('change', () => handlers.onMove(select.value));
  rows.push(el('div', { className: 'detail-move' }, [
    el('label', { text: 'Move to', attrs: { for: 'detail-status' } }),
    select,
  ]));

  const remove = el('button', { className: 'detail-delete', attrs: { type: 'button' } }, [
    el('img', { attrs: { src: 'assets/img/delete.svg', alt: '', width: '18', height: '18' } }),
    el('span', { text: 'Delete' }),
  ]);
  remove.addEventListener('click', handlers.onDelete);
  const edit = el('button', { className: 'detail-delete detail-edit', attrs: { type: 'button' } }, [
    el('img', { attrs: { src: 'assets/img/edit.svg', alt: '', width: '18', height: '18' } }),
    el('span', { text: 'Edit' }),
  ]);
  edit.addEventListener('click', handlers.onEdit);
  rows.push(el('div', { className: 'detail-actions' }, [remove, edit]));

  container.replaceChildren(...rows);
}
