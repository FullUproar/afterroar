import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#0a0a0a] px-4 text-white">
      <img src="/logo-ring.png" alt="Afterroar" className="mb-6 h-20 w-20 object-contain" />
      <h1 className="text-5xl font-bold tracking-tight sm:text-7xl">
        Afterroar
      </h1>
      <p className="mt-4 max-w-md text-center text-lg text-[#94a3b8] sm:text-xl">
        The operating system for friendly local game stores
      </p>
      <div className="mt-8 flex gap-3">
        <Link
          href="/login"
          className="rounded-xl bg-[#FF8200] px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#e67400]"
        >
          Sign In
        </Link>
        <Link
          href="/login"
          className="rounded-xl border border-[#2a2a3e] px-6 py-2.5 text-sm font-medium text-[#94a3b8] transition-colors hover:border-[#FF8200]/50 hover:text-white"
        >
          Create Store
        </Link>
      </div>
      <p className="mt-12 text-xs text-[#4a4a6a]">
        Afterroar Store Ops &mdash; by Full Uproar Games
      </p>
    </div>
  );
}
