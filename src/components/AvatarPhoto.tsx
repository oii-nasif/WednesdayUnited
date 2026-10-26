import { AvatarImage } from "@/components/ui/avatar";
import { useAvatarUrl } from "@/lib/avatar";

// Drop-in for AvatarImage that understands photos stored in the private avatars bucket.
export function AvatarPhoto({ src, className }: { src: string | null | undefined; className?: string }) {
  const url = useAvatarUrl(src);
  return <AvatarImage src={url} alt="" className={className} />;
}
