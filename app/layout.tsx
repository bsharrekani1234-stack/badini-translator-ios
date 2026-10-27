import type { Metadata, Viewport } from 'next';
import {
  Amiri,
  Noto_Naskh_Arabic,
  Vazirmatn,
  Scheherazade_New,
  Lateef,
  Cairo,
  Noto_Kufi_Arabic,
} from 'next/font/google';
import './globals.css';

const vazirmatn = Vazirmatn({
  weight: ['400', '500', '600', '700', '800'],
  subsets: ['arabic'],
  variable: '--font-vazirmatn',
  display: 'swap',
});

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

const scheherazade = Scheherazade_New({
  weight: ['400', '700'],
  subsets: ['arabic'],
  variable: '--font-scheherazade',
  display: 'swap',
});

const lateef = Lateef({
  weight: ['400', '700'],
  subsets: ['arabic'],
  variable: '--font-lateef',
  display: 'swap',
});

const cairo = Cairo({
  weight: ['400', '600', '700'],
  subsets: ['arabic'],
  variable: '--font-cairo',
  display: 'swap',
});

const notoKufi = Noto_Kufi_Arabic({
  weight: ['400', '600', '700'],
  subsets: ['arabic'],
  variable: '--font-noto-kufi',
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
    <html
      lang="ku"
      dir="rtl"
      className={`${vazirmatn.variable} ${amiri.variable} ${notoNaskh.variable} ${scheherazade.variable} ${lateef.variable} ${cairo.variable} ${notoKufi.variable}`}
    >
      <body
        suppressHydrationWarning
        className="bg-[#F7F4EE] text-[#1C1917] antialiased selection:bg-[#9A3412]/15 selection:text-[#9A3412]"
      >
        {children}
      </body>
    </html>
  );
}
