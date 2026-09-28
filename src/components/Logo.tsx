import Link from "next/link";

export default function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="inline-flex items-baseline gap-0.5 text-2xl font-extrabold tracking-tight">
      <span className="text-navy">강원</span>
      <span className="text-brand">크루</span>
    </Link>
  );
}
