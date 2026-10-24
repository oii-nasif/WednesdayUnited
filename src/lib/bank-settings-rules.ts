export type PaymentMethod = "bank" | "qr";
export type BankForm = { payment_method: PaymentMethod; bank_name: string; account_name: string; account_number: string; instructions: string; qr_code_path: string | null };

export function bankSettingsInput(form: BankForm, uploaded: string | null = null) {
  const qr = form.payment_method === "qr" ? uploaded ?? form.qr_code_path : null;
  if (form.payment_method === "qr" && !qr) throw new Error("Upload a payment QR code");
  if (form.payment_method === "bank" && ![form.bank_name, form.account_name, form.account_number].every((s) => s.trim())) throw new Error("Complete the bank details");
  return { ...form, bank_name: form.bank_name.trim(), account_name: form.account_name.trim(), account_number: form.account_number.trim(), instructions: form.instructions.trim(), qr_code_path: qr };
}