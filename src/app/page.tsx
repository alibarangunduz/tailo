import Link from "next/link";
import { UserNav } from "@/components/user-nav";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-950 px-4">
      {/* Top-right account control: renders only when signed in. */}
      <div className="absolute right-4 top-4">
        <UserNav />
      </div>
      <div className="max-w-lg text-center">
        <h1 className="text-4xl font-bold tracking-tight text-white">
          CV Tailor
        </h1>
        <p className="mt-4 text-lg text-gray-400">
          Paste your master CV and a job description. Get a tailored version in
          seconds — honest, reframed, and optimized for the role.
        </p>
        <div className="mt-8 flex items-center justify-center gap-4">
          <Link
            href="/tailor"
            className="rounded-xl bg-white px-6 py-3 text-sm font-semibold text-gray-900 transition hover:bg-gray-100"
          >
            Start tailoring
          </Link>
          <Link
            href="/history"
            className="rounded-xl border border-white/10 px-6 py-3 text-sm font-semibold text-gray-300 transition hover:border-white/20 hover:text-white"
          >
            History
          </Link>
        </div>
        <div className="mt-6">
          <Link
            href="/settings"
            className="text-sm text-gray-500 transition hover:text-gray-300"
          >
            Settings
          </Link>
        </div>
      </div>
    </div>
  );
}
