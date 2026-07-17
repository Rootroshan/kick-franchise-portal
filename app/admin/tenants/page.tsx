import { redirect } from "next/navigation";

// Old route → clean URL. Kept so existing bookmarks/links don't 404.
export default function TenantsRedirect() {
  redirect("/admin/brands");
}
