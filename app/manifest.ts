import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'وەرگێرانا پەرتووکێ بۆ بادینی',
    short_name: 'پەرتووکا بادینی',
    description:
      'وەرگێرانا تەماما پەرتووکێن عەرەبی بۆ شێوەزارێ بادینی ب هەمان دیزاین و قەبارەیێ لاپەر و فۆنتێ پەرتووکا رەسەن.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#EFF3FB',
    theme_color: '#EFF3FB',
    icons: [
      {
        src: '/pwa-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa-maskable-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
