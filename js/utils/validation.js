// Client-side validation is UX only; the real checks are the DB constraints and RLS policies.
export const NAME_MAX_LENGTH = 60;
export const EMAIL_MAX_LENGTH = 254;
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 72; // bcrypt ignores anything beyond this

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeName(value) {
  return value.trim();
}

export function normalizeEmail(value) {
  return value.trim().toLowerCase();
}

export function isValidName(name) {
  return name.length > 0 && name.length <= NAME_MAX_LENGTH;
}

export function isValidEmail(email) {
  return email.length > 0 && email.length <= EMAIL_MAX_LENGTH && EMAIL_PATTERN.test(email);
}

// Passwords are never trimmed: a leading/trailing space is part of what the user typed.
export function isValidPassword(password) {
  return password.length >= PASSWORD_MIN_LENGTH && password.length <= PASSWORD_MAX_LENGTH;
}

// Mirrors the DB check on contacts.phone (digits and + ( ) / . - space, max 30 chars).
export const PHONE_MAX_LENGTH = 30;
const PHONE_PATTERN = /^[0-9+()/. -]*$/;

export function normalizePhone(value) {
  return value.trim();
}

// Phone is optional.
export function isValidPhone(phone) {
  return phone.length <= PHONE_MAX_LENGTH && PHONE_PATTERN.test(phone);
}
