import type { AppProps } from 'next/app';
import { RouteProgressBar } from '@/components/RouteProgressBar';
import '@/styles/globals.css';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 font-sans">
      <RouteProgressBar />
      <Component {...pageProps} />
    </div>
  );
}

