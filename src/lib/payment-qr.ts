import { supabase } from "@/integrations/supabase/client";
import { validateReceipt } from "@/lib/payment-rules";

export async function uploadPaymentQr(userId: string, file: File) {
  validateReceipt(file);
  const extension = file.type === "image/jpeg" ? "jpg" : file.type === "image/png" ? "png" : "webp";
  const path = `${userId}/${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage.from("payment-qr-codes").upload(path, file, { contentType: file.type });
  if (error) throw error;
  return path;
}

export async function paymentQrUrl(path: string) {
  const { data, error } = await supabase.storage.from("payment-qr-codes").createSignedUrl(path, 600);
  if (error) throw error;
  return data.signedUrl;
}