import type { Metadata, Viewport } from 'next';
import './globals.css';

export const viewport: Viewport = {
  themeColor: '#1c1510',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
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
    <html lang="ku" dir="rtl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Cairo:wght@400;600;700&family=Lateef:wght@400;700&family=Noto+Kufi+Arabic:wght@500;600;700;800&family=Noto+Naskh+Arabic:wght@400;500;600;700&family=Scheherazade+New:wght@400;700&family=Vazirmatn:wght@400;500;600;700&display=swap"
        />
      </head>
      <body
        suppressHydrationWarning
        className="bg-[#1c1510] text-white antialiased selection:bg-amber-500/30 selection:text-amber-100"
      >
        {children}
      </body>
    </html>
  );
}
