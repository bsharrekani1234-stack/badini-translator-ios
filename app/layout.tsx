import type { Metadata, Viewport } from 'next';
import { Amiri, Noto_Naskh_Arabic } from 'next/font/google';
import './globals.css';

const amiri = Amiri({
  weight: ['400', '700'],
  subsets: ['arabic'],
  variable: '--font-amiri',
  display: 'swap',
});

const notoNaskh = Noto_Naskh_Arabic({
  weight: ['400', '500', '600', '700'],
  subsets: ['arabic'],
  variable: '--font-noto-naskh',
  display: 'swap',
});

export const viewport: Viewport = {
  themeColor: '#9A3412',
  width: 'device-width',
  initialScale: 1,
};

export const metadata: Metadata = {
  title: 'وەرگێرانا پەرتووکێ بۆ بادینی - چاپا PDF',
  description:
    'وەرگێرانا تەماما پەرتووکا (فتنة تصوير العلماء والظهور في القنوات الفضائية) بۆ شێوەزارێ بادینی ب هەمان دیزاین و قەبارەیێ لاپەر و فۆنتێ پەرتووکا رەسەن ل گەل داگرتنا راستەوخۆ ب شێوەیێ PDF.',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'پەرتووکا بادینی',
  },
  icons: {
    icon: '/icon.svg',
    apple: '/apple-touch-icon.png',
  },
  openGraph: {
    title: 'وەرگێرانا پەرتووکێ بۆ بادینی - چاپا PDF',
    description:
      'وەرگێرانا تەماما پەرتووکا (فتنة تصوير العلماء والظهور في القنوات الفضائية) بۆ شێوەزارێ بادینی ب هەمان دیزاین و قەبارەیێ لاپەر و فۆنتێ پەرتووکا رەسەن ل گەل داگرتنا راستەوخۆ ب شێوەیێ PDF.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'وەرگێرانا پەرتووکێ بۆ بادینی - چاپا PDF',
    description:
      'وەرگێرانا تەماما پەرتووکا (فتنة تصوير العلماء والظهور في القنوات الفضائية) بۆ شێوەزارێ بادینی ب هەمان دیزاین و قەبارەیێ لاپەر و فۆنتێ پەرتووکا رەسەن ل گەل داگرتنا راستەوخۆ ب شێوەیێ PDF.',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ku" dir="rtl" className={`${amiri.variable} ${notoNaskh.variable}`}>
      <body
        suppressHydrationWarning
        className="bg-[#F7F4EE] text-[#1C1917] antialiased selection:bg-[#9A3412]/15 selection:text-[#9A3412]"
      >
        {children}
      </body>
    </html>
  );
}
