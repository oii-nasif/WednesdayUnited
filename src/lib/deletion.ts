import { supabase } from "@/integrations/supabase/client";

export function deletionError(entity: "match" | "venue", code?: string, message?: string) {
  if (code === "23503") return entity === "match"
    ? "This match has payment records and cannot be deleted. Cancel it instead to preserve payment history."
    : "This venue is used by a match. Edit those matches to choose another venue before deleting it.";
  return message ?? `Could not delete this ${entity}.`;
}

export async function deleteEntity(entity: "match" | "venue", id: string) {
  const { data, error } = await supabase.from(entity === "match" ? "matches" : "locations").delete().eq("id", id).select("id");
  if (error) throw new Error(deletionError(entity, error.code, error.message));
  if (!data?.length) throw new Error(`This ${entity} was not deleted. It may already be removed, or you may not have permission.`);
}