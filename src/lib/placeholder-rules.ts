import { z } from "zod";

// Mirrors create_placeholder_player / update_placeholder_player in migration 0022.
export const placeholderSchema = z.object({
  full_name: z.string().trim().min(2, "Enter their name").max(80, "Use at most 80 characters"),
  phone: z
    .string()
    .trim()
    .max(30, "Use at most 30 characters")
    .refine((v) => v === "" || /^\+?[0-9][0-9 ()-]*$/.test(v), "Enter a valid phone number"),
});
export type PlaceholderInput = z.input<typeof placeholderSchema>;

type Member = { id: string; placeholder: boolean; approval_status: string; roles: string[] };
// A placeholder can only be merged into a signed-up account that is approved (staff count as approved).
export const mergeTargets = <T extends Member>(members: T[]) =>
  members.filter((m) => !m.placeholder && (m.approval_status === "approved" || m.roles.includes("moderator") || m.roles.includes("super_admin")));
