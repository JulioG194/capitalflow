import type { Metadata } from "next";
import { ProfileForm } from "@/components/auth/ProfileForm";

// Not indexable (robots.ts disallows /app/*, spec 001 AC12) — a minimal
// title is enough, no OG/canonical boilerplate needed here.
export const metadata: Metadata = {
  title: "Mi perfil",
};

export default function ProfilePage() {
  return (
    <section className="mx-auto flex max-w-md flex-col gap-6">
      <h1 className="text-3xl font-bold tracking-tight text-ink">Mi perfil</h1>
      <ProfileForm />
    </section>
  );
}
