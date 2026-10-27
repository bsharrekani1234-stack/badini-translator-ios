import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.book.translator',
  appName: 'book translator badini',
  webDir: 'public',
  server: {
    url: 'https://ai-studio-applet-ten.vercel.app',
    cleartext: true
  }
};

export default config;