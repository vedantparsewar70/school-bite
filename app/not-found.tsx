import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center px-4 text-center">
      <img
        src="/logo.png"
        alt="School Bite"
        className="w-16 h-16 rounded-2xl shadow-lg shadow-amber-500/25 object-contain mb-4"
      />
      <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">404 - Page Not Found</h1>
      <p className="text-sm text-slate-500 mt-2 max-w-sm">
        The page you are looking for does not exist or has been moved.
      </p>
      <Link
        href="/"
        className="mt-6 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold rounded-xl text-sm shadow-md shadow-amber-500/20 transition-all"
      >
        Return to Home
      </Link>
    </div>
  );
}
