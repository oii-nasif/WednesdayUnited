// Signs avatar paths for the browser. The avatars bucket is locked to owners and staff at the storage layer,
// so signed links are created by the server instead; the visibility rules live in avatar-sign.server.ts.
import { createServerFn } from "@tanstack/react-start";

const MAX_PATHS = 50;
// Avatar paths are "<user id>/<timestamp>.<ext>" inside the avatars bucket. Anything else is rejected
// before any database or storage call happens.
const PATH_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[\w-]+\.\w{3,4}$/;

export const signAvatarLinks = createServerFn({ method: "POST" })
  .inputValidator((input: { paths: string[] }) => {
    const paths = (input as { paths?: unknown } | null | undefined)?.paths;
    if (!Array.isArray(paths) || paths.length === 0 || paths.length > MAX_PATHS || paths.some((p) => typeof p !== "string" || !PATH_RE.test(p))) {
      throw new Error("Invalid photo path");
    }
    return { paths };
  })
  .handler(async ({ data }) => {
    const { signAvatarLinksImpl } = await import("./avatar-sign.server");
    return { urls: await signAvatarLinksImpl(data.paths) };
  });
