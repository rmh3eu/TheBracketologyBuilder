
// Utility helpers (cleaned — no duplicate exports)

export function normalizeEmail(email) {
  if (!email) return "";
  return email.trim().toLowerCase();
}

export function isValidEmail(email) {
  const normalized = normalizeEmail(email);
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(normalized);
}

export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
