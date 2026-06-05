// Klar Control · Antworten — merged into the unified Inbox. Kept as a redirect
// so old bookmarks/links keep working.
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function RepliesPage(): never {
  redirect("/admin/inbox");
}
