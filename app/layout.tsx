import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/components/AuthContext';
import { CartProvider } from '@/components/CartContext';
import { ToastProvider } from '@/components/ToastContext';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://school-bite.vercel.app'),
  title: {
    default: 'School Bite - School Meal Pre-Ordering Platform | S.B. Patil School',
    template: '%s | School Bite',
  },
  description:
    'School Bite is a school meal pre-ordering platform that allows parents to select fresh, wholesome canteen meals for their children at S.B. Patil School and make online payments.',
  keywords: [
    'School Bite',
    'School-Bite',
    'S.B. Patil School',
    'school canteen',
    'school meal pre-ordering',
    'student lunch order',
    'pure vegetarian school meal',
    'Ravet Pune',
  ],
  manifest: '/manifest.json',
  openGraph: {
    title: 'School Bite - School Meal Pre-Ordering Platform',
    description:
      'School meal pre-ordering made simple for parents of S.B. Patil School students.',
    type: 'website',
    images: [
      {
        url: '/logo.png',
        width: 512,
        height: 512,
        alt: 'School Bite Logo',
      },
    ],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full scroll-smooth">
      <body className={`${inter.className} min-h-full flex flex-col bg-slate-50/50 text-slate-800 antialiased`}>
        <AuthProvider>
          <CartProvider>
            <ToastProvider>
              <Navbar />
              <main className="flex-1">{children}</main>
              <Footer />
            </ToastProvider>
          </CartProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
