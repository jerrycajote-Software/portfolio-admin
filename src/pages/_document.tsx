import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <link rel="preconnect" href="https://fonts.cdnfonts.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href="https://fonts.cdnfonts.com/css/futura-pt" />
      </Head>
      <body className="min-h-screen bg-slate-100 text-slate-900 antialiased">
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}

