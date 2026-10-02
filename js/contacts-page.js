import { createContact, deleteContact, getOwnBoardId, listContacts, updateContact } from './api/contacts.js';
import { handleLogout, loadShellUser } from './shell-init.js';
import { clearMessage, showMessage, showToast } from './ui/formFeedback.js';
import { buildAvatar, renderContactDetail, renderContactList } from './ui/contacts.js';
import { mountShell } from './ui/shell.js';
import { pickColor } from './utils/contacts.js';
import {
  isValidEmail, isValidName, isValidPhone, normalizeEmail, normalizeName, normalizePhone,
} from './utils/validation.js';

const $ = (id) => document.getElementById(id);

const state = { boardId: null, contacts: [], selectedId: null, editingId: null };

const MESSAGES = {
  load: 'Could not load your contacts. Please try again later.',
  save: 'Could not save the contact. Please try again.',
  duplicate: 'A contact with this email already exists.',
  remove: 'Could not delete the contact. Please try again.',
  name: 'Please enter a name (max. 100 characters).',
  email: 'Please enter a valid email address.',
  phone: 'Phone may only contain digits and + ( ) / . - (max. 30 characters).',
};

function selected() {
  return state.contacts.find((contact) => contact.id === state.selectedId) ?? null;
}

function render() {
  const current = selected();
  $('contacts-empty').hidden = state.contacts.length > 0;
  renderContactList($('contact-list'), state.contacts, state.selectedId, select);
  renderContactDetail($('contact-detail'), current, { onEdit: openEdit, onDelete: removeSelected });
  // On small screens the detail view replaces the list.
  document.querySelector('.contacts-content').classList.toggle('contacts-content--detail', current !== null);
}

function select(id) {
  state.selectedId = id;
  render();
}

function flash(text) {
  const toast = showToast(text);
  window.setTimeout(() => toast.remove(), 3000);
}

// --- Dialog (add + edit share one form) ---
const dialog = $('contact-dialog');
const form = $('contact-form');

function openDialog({ mode, title, subtitle, avatar, secondary, submit }) {
  dialog.dataset.mode = mode;
  $('dialog-title').textContent = title;
  $('dialog-subtitle').textContent = subtitle;
  $('dialog-subtitle').hidden = !subtitle;
  $('dialog-avatar').replaceChildren(avatar);
  $('form-secondary').textContent = secondary;
  $('form-submit-label').textContent = submit;
  clearMessage($('form-error'));
  dialog.showModal();
  $('contact-name').focus();
}

function openAdd() {
  state.editingId = null;
  form.reset();
  const placeholder = document.createElement('img');
  placeholder.src = 'assets/img/Group 13.svg';
  placeholder.alt = '';
  placeholder.width = 134;
  placeholder.height = 134;
  openDialog({
    mode: 'add', title: 'Add contact', subtitle: 'Tasks are better with a team!',
    avatar: placeholder, secondary: 'Cancel', submit: 'Create contact',
  });
}

function openEdit() {
  const contact = selected();
  if (!contact) return;
  state.editingId = contact.id;
  $('contact-name').value = contact.name;
  $('contact-email').value = contact.email;
  $('contact-phone').value = contact.phone;
  openDialog({
    mode: 'edit', title: 'Edit contact', subtitle: '',
    avatar: buildAvatar(contact, 'contact-avatar--large'), secondary: 'Delete', submit: 'Save',
  });
}

function readForm() {
  return {
    name: normalizeName($('contact-name').value),
    email: normalizeEmail($('contact-email').value),
    phone: normalizePhone($('contact-phone').value),
  };
}

function validate({ name, email, phone }) {
  if (!isValidName(name)) return MESSAGES.name;
  if (!isValidEmail(email)) return MESSAGES.email;
  if (!isValidPhone(phone)) return MESSAGES.phone;
  return null;
}

async function submitForm(event) {
  event.preventDefault();
  const values = readForm();
  const problem = validate(values);
  if (problem) {
    showMessage($('form-error'), problem, 'error');
    return;
  }

  const submitButton = $('form-submit');
  submitButton.disabled = true;
  const editing = state.editingId !== null;
  const existing = state.contacts.find((contact) => contact.id === state.editingId);
  const result = editing
    ? await updateContact(state.editingId, { ...values, color: existing.color })
    : await createContact(state.boardId, { ...values, color: pickColor(values.email) });
  submitButton.disabled = false;

  if (!result.ok) {
    showMessage($('form-error'), result.reason === 'duplicate' ? MESSAGES.duplicate : MESSAGES.save, 'error');
    return;
  }

  state.contacts = editing
    ? state.contacts.map((contact) => (contact.id === result.contact.id ? result.contact : contact))
    : [...state.contacts, result.contact];
  state.selectedId = result.contact.id;
  dialog.close();
  render();
  if (!editing) flash('Contact successfully created');
}

async function removeById(id) {
  if (!window.confirm('Delete this contact?')) return false;
  const result = await deleteContact(id);
  if (!result.ok) {
    showMessage($('contacts-error'), MESSAGES.remove, 'error');
    return false;
  }
  clearMessage($('contacts-error'));
  state.contacts = state.contacts.filter((contact) => contact.id !== id);
  if (state.selectedId === id) state.selectedId = null;
  render();
  return true;
}

async function removeSelected() {
  if (state.selectedId) await removeById(state.selectedId);
}

async function onSecondary() {
  if (state.editingId === null) {
    dialog.close();
    return;
  }
  if (await removeById(state.editingId)) dialog.close();
}

(async () => {
  const user = await loadShellUser();
  if (!user) {
    window.location.replace('index.html');
    return;
  }
  mountShell({ active: 'contacts', initials: user.initials, onLogout: handleLogout });

  $('add-contact').addEventListener('click', openAdd);
  $('detail-back').addEventListener('click', () => select(null));
  $('dialog-close').addEventListener('click', () => dialog.close());
  $('form-secondary').addEventListener('click', onSecondary);
  form.addEventListener('submit', submitForm);
  // Click on the backdrop (the dialog element itself) closes it.
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });

  const [boardId, contacts] = await Promise.all([getOwnBoardId(), listContacts()]);
  if (boardId === null || contacts === null) {
    showMessage($('contacts-error'), MESSAGES.load, 'error');
    $('add-contact').disabled = true;
    return;
  }
  state.boardId = boardId;
  state.contacts = contacts;
  render();
})();
