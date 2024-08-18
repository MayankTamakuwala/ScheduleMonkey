// src/pages/index.tsx
import React from 'react';
import Head from 'next/head';
import ChatAssistant from '@/components/ChatAssistant';

const Home: React.FC = () => {
    return (
        <div className="min-h-screen bg-gray-100 py-6 flex flex-col justify-center sm:py-12">
            <Head>
                <title>AI Chat Assistant</title>
                <link rel="icon" href="/favicon.ico" />
            </Head>

            <div className="relative py-3 sm:max-w-xl sm:mx-auto">
                <div className="absolute inset-0 bg-gradient-to-r from-cyan-400 to-light-blue-500 shadow-lg transform -skew-y-6 sm:skew-y-0 sm:-rotate-6 sm:rounded-3xl"></div>
                <div className="relative px-4 py-10 bg-white shadow-lg sm:rounded-3xl sm:p-20">
                    <h1 className="text-4xl font-bold mb-8 text-center text-gray-800">AI Chat Assistant</h1>
                    <ChatAssistant />
                </div>
            </div>
        </div>
    );
};

export default Home;