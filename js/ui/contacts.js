import { el } from './dom.js';
import { getInitials } from '../utils/format.js';
import { groupContacts, safeColor } from '../utils/contacts.js';

// Everything user-controlled (name, email, phone) goes in via textContent only.
export function buildAvatar(contact, className) {
  const avatar = el('span', {
    className: `contact-avatar ${className ?? ''}`.trim(),
    text: getInitials(contact.name),
    attrs: { 'aria-hidden': 'true' },
  });
  // CSSOM assignment (not a style attribute), so the strict style-src CSP stays intact.
  avatar.style.backgroundColor = safeColor(contact.color);
  return avatar;
}

export function renderContactList(container, contacts, selectedId, onSelect) {
  const nodes = groupContacts(contacts).map(([letter, items]) => {
    const list = el('ul', { className: 'contact-group-list' });
    for (const contact of items) {
      const button = el(
        'button',
        { className: 'contact-item', attrs: { type: 'button', 'data-id': contact.id } },
        [
          buildAvatar(contact),
          el('span', { className: 'contact-item-text' }, [
            el('span', { className: 'contact-item-name', text: contact.name }),
            el('span', { className: 'contact-item-email', text: contact.email }),
          ]),
        ],
      );
      if (contact.id === selectedId) button.setAttribute('aria-current', 'true');
      button.addEventListener('click', () => onSelect(contact.id));
      list.append(el('li', {}, [button]));
    }
    return el('section', { className: 'contact-group' }, [
      el('h2', { className: 'contact-letter', text: letter }),
      list,
    ]);
  });
  container.replaceChildren(...nodes);
}

function actionButton(label, iconFile, onClick) {
  const button = el('button', { className: 'contact-action', attrs: { type: 'button' } }, [
    el('img', { attrs: { src: `assets/img/${iconFile}`, alt: '', width: '18', height: '18' } }),
    el('span', { text: label }),
  ]);
  button.addEventListener('click', onClick);
  return button;
}

export function renderContactDetail(container, contact, { onEdit, onDelete }) {
  if (!contact) {
    container.replaceChildren();
    return;
  }
  // mailto:/tel: are built from validated characters only (DB checks), encoded for safety.
  const email = el('a', {
    text: contact.email,
    attrs: { href: `mailto:${encodeURIComponent(contact.email)}` },
  });
  const phoneDigits = contact.phone.replace(/[^0-9+]/g, '');
  const phone = contact.phone
    ? el('a', { className: 'contact-phone', text: contact.phone, attrs: { href: `tel:${phoneDigits}` } })
    : el('span', { text: '-' });

  // Mobile: the actions collapse into a menu opened by a round "more" button (CSS hides it on desktop).
  const actions = el('div', { className: 'contact-actions', attrs: { id: 'contact-actions' } }, [
    actionButton('Edit', 'edit.svg', () => { actions.classList.remove('is-open'); onEdit(); }),
    actionButton('Delete', 'delete.svg', () => { actions.classList.remove('is-open'); onDelete(); }),
  ]);
  const more = el('button', {
    className: 'contact-fab',
    text: '\u22EE',
    attrs: { type: 'button', 'aria-label': 'Contact actions', 'aria-controls': 'contact-actions', 'aria-expanded': 'false' },
  });
  more.addEventListener('click', () => {
    const open = actions.classList.toggle('is-open');
    more.setAttribute('aria-expanded', String(open));
  });

  container.replaceChildren(
    el('div', { className: 'contact-hero' }, [
      buildAvatar(contact, 'contact-avatar--large'),
      el('div', {}, [
        el('h2', { className: 'contact-hero-name', text: contact.name }),
        actions,
      ]),
    ]),
    more,
    el('h3', { className: 'contact-info-title', text: 'Contact Information' }),
    el('dl', { className: 'contact-info' }, [
      el('dt', { text: 'Email' }),
      el('dd', {}, [email]),
      el('dt', { text: 'Phone' }),
      el('dd', {}, [phone]),
    ]),
  );
}
