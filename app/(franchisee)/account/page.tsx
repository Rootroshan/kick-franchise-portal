import { redirect } from "next/navigation";

/** /account is an alias — the My Account page lives at /profile (BottomNav target). */
export default function AccountPage() {
  redirect("/profile");
}
