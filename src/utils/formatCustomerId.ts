export function formatCustomerId(customerId: string | number): string {
  // Ensure string
  let s = String(customerId);
  // Remove any non-digit characters
  s = s.replace(/\D+/g, "");
  // Pad to 10 digits
  return s.padStart(10, "0");
}
