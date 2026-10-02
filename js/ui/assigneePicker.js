import { el } from './dom.js';
import { buildAvatar } from './contacts.js';

// Multi-select combobox for contacts. Contact names are user input: textContent only.
// Keyboard: ArrowUp/Down move, Enter toggles, Escape closes. Typing filters by name.
export function createAssigneePicker({ root, input, toggle, list, chips, onChange }) {
  let contacts = [];
  const selected = new Set();
  let visible = [];
  let activeIndex = -1;

  const isOpen = () => !list.hidden;

  function setOpen(open) {
    list.hidden = !open;
    input.setAttribute('aria-expanded', String(open));
    toggle.classList.toggle('is-open', open);
    if (!open) {
      activeIndex = -1;
      input.removeAttribute('aria-activedescendant');
    }
  }

  function toggleContact(id) {
    if (selected.has(id)) selected.delete(id);
    else selected.add(id);
    renderList();
    renderChips();
    onChange();
  }

  function renderChips() {
    chips.replaceChildren(
      ...contacts
        .filter((contact) => selected.has(contact.id))
        .map((contact) => el('li', { attrs: { title: contact.name } }, [buildAvatar(contact)])),
    );
  }

  function renderList() {
    const query = input.value.trim().toLowerCase();
    visible = contacts.filter((contact) => contact.name.toLowerCase().includes(query));
    if (visible.length === 0) {
      list.replaceChildren(el('li', { className: 'assignee-empty', text: 'No contacts found' }));
      return;
    }
    list.replaceChildren(
      ...visible.map((contact, index) => {
        const checked = selected.has(contact.id);
        const option = el('li', {
          className: 'assignee-option',
          attrs: { role: 'option', id: `assignee-option-${index}`, 'aria-selected': String(checked) },
        }, [
          buildAvatar(contact),
          el('span', { className: 'assignee-name', text: contact.name }),
          el('span', { className: 'assignee-check', attrs: { 'aria-hidden': 'true' } }),
        ]);
        if (index === activeIndex) option.classList.add('is-active');
        // mousedown keeps focus in the input so the list does not close before the click lands.
        option.addEventListener('mousedown', (event) => event.preventDefault());
        option.addEventListener('click', () => toggleContact(contact.id));
        return option;
      }),
    );
  }

  function moveActive(step) {
    if (visible.length === 0) return;
    activeIndex = (activeIndex + step + visible.length) % visible.length;
    renderList();
    const option = document.getElementById(`assignee-option-${activeIndex}`);
    input.setAttribute('aria-activedescendant', option.id);
    option.scrollIntoView({ block: 'nearest' });
  }

  input.addEventListener('focus', () => { renderList(); setOpen(true); });
  input.addEventListener('click', () => { if (!isOpen()) { renderList(); setOpen(true); } });
  input.addEventListener('input', () => { activeIndex = -1; renderList(); setOpen(true); });
  input.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (!isOpen()) { renderList(); setOpen(true); }
      moveActive(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      moveActive(-1);
    } else if (event.key === 'Enter' && isOpen()) {
      // Enter must never submit the whole form from inside the picker.
      event.preventDefault();
      if (activeIndex >= 0) toggleContact(visible[activeIndex].id);
    } else if (event.key === 'Escape' && isOpen()) {
      event.stopPropagation();
      setOpen(false);
    }
  });
  // Keeps focus in the input while scrolling/clicking inside the list.
  list.addEventListener('mousedown', (event) => event.preventDefault());
  toggle.addEventListener('mousedown', (event) => event.preventDefault());
  toggle.addEventListener('click', () => {
    if (isOpen()) {
      setOpen(false);
    } else {
      input.focus();
      renderList();
      setOpen(true);
    }
  });
  document.addEventListener('click', (event) => {
    if (isOpen() && !root.contains(event.target)) {
      input.value = '';
      setOpen(false);
    }
  });
  input.addEventListener('blur', () => {
    input.value = '';
    setOpen(false);
  });

  return {
    setContacts(next) {
      contacts = next;
      renderList();
      renderChips();
    },
    getSelectedIds() {
      return [...selected];
    },
    reset() {
      selected.clear();
      input.value = '';
      setOpen(false);
      renderList();
      renderChips();
    },
  };
}
