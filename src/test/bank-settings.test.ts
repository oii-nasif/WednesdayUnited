import { describe, expect, it } from "vitest";
import { bankSettingsInput, type BankForm } from "@/lib/bank-settings-rules";
const form: BankForm = { payment_method: "bank", bank_name: "Bank", account_name: "Name", account_number: "123", instructions: "", qr_code_path: "old/qr.png" };
describe("one payment instruction method", () => {
  it("bank mode removes the QR target", () => {
    expect(bankSettingsInput(form, "new/qr.png").qr_code_path).toBeNull();
  });
  it("QR mode works without bank details", () => {
    expect(bankSettingsInput({ ...form, payment_method: "qr", bank_name: "", account_name: "", account_number: "" }, "new/qr.png")).toMatchObject({ payment_method: "qr", qr_code_path: "new/qr.png", bank_name: "" });
  });
  it("QR mode requires an image", () => {
    expect(() => bankSettingsInput({ ...form, payment_method: "qr", qr_code_path: null })).toThrow("Upload a payment QR code");
  });
  it("bank mode requires complete account details", () => {
    expect(() => bankSettingsInput({ ...form, account_number: " " })).toThrow("Complete the bank details");
  });
});