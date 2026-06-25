// Szybki kontakt z klientem: telefon / SMS przez systemowe intencje.

export function callNumber(phone: string) {
  const clean = phone.replace(/[^+\d]/g, '');
  if (!clean) return;
  window.location.href = `tel:${clean}`;
}

export function smsNumber(phone: string, body?: string) {
  const clean = phone.replace(/[^+\d]/g, '');
  if (!clean) return;
  const b = body ? `?body=${encodeURIComponent(body)}` : '';
  window.location.href = `sms:${clean}${b}`;
}
