// Malaysian numbers are stored as digits with the country code, e.g.
// 60123456789, which is also the form wa.me links expect.

export function normalizeMalaysianPhone(input: string): string | null {
  let digits = input.replace(/[^0-9]/g, "");
  if (digits.startsWith("0")) digits = `6${digits}`;
  if (!digits.startsWith("60")) digits = `60${digits}`;
  return /^60[0-9]{8,10}$/.test(digits) ? digits : null;
}

// 60123456789 -> +60 12-345 6789
export function formatMalaysianPhone(phone: string): string {
  const local = phone.slice(2);
  if (!local.startsWith("1")) {
    // Landline: one-digit area code (3 for Klang Valley).
    return `+60 ${local.slice(0, 1)}-${local.slice(1, local.length - 4)} ${local.slice(-4)}`;
  }
  return `+60 ${local.slice(0, 2)}-${local.slice(2, local.length - 4)} ${local.slice(-4)}`;
}

// 60123456789 -> +6012•••6789, for telling a claimant where the code went.
export function maskPhone(phone: string): string {
  return `+${phone.slice(0, 4)}•••${phone.slice(-4)}`;
}
