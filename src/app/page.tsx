import Link from "next/link";

export default function Home() {
  return (
    <section className="card mx-auto max-w-2xl text-center">
      <h1 className="text-3xl font-bold">BoxTag</h1>
      <p className="mt-3 text-navy-soft">
        Pack a box, print one barcode for the box and everything inside it, store it, and ship it
        later.
      </p>
      <div className="mt-6 flex justify-center gap-3">
        <Link href="/pack" className="btn-primary">
          Pack a box
        </Link>
        <Link href="/scan" className="btn-ghost">
          Scan a box
        </Link>
      </div>
    </section>
  );
}
