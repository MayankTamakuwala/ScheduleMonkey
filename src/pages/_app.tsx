// src/pages/_app.tsx
import '@/styles/globals.css';
import { ClerkProvider } from '@clerk/nextjs';
import type { AppProps } from "next/app";
import Head from 'next/head';

export default function App({ Component, pageProps }: AppProps) {

    return (
        <ClerkProvider>
            <Head>
                <meta charSet="utf-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
            </Head>
            <div className="min-h-screen flex flex-col relative">
                <main className="flex-grow">
                    <Component {...pageProps} />
                </main>
            </div>
        </ClerkProvider>
    )
}