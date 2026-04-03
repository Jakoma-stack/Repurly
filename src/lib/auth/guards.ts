import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export async function requireUser() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  return userId;
}

export async function getViewer() {
  const user = await currentUser();
  if (!user) redirect("/sign-in");
  return user;
}
