// Klar Control · Mailer — now a drawer action inside the unified Inbox. Kept as
// a redirect so old bookmarks/links keep working. (MailerClient + run route stay.)
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function MailerPage(): never {
  redirect("/admin/inbox");
}
