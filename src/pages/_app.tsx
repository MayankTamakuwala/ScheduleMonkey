// src/pages/_app.tsx
import '@/styles/globals.css';
import type { AppProps } from "next/app";
import Head from 'next/head';
import { AuthProvider } from '@/app/authContext'; // Import the AuthProvider

export default function App({ Component, pageProps }: AppProps) {
    return (
        <>
            <Head>
                <meta charSet="utf-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
            </Head>
            <AuthProvider> {/* Wrap the application in AuthProvider */}
                <div className="min-h-screen flex flex-col relative">
                    <main className="flex-grow">
                        <Component {...pageProps} />
                    </main>
                </div>
            </AuthProvider>
        </>
    )
}
