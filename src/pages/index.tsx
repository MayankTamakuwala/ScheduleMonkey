// src/pages/index.tsx
import React from 'react';
import Head from 'next/head';
import ChatAssistant from '@/components/ChatAssistant';

const Home: React.FC = () => {
    return (
        <div className="min-h-screen py-6 flex flex-col justify-center sm:py-12">
            <Head>
                <title>ScheduleMonkey</title>
                <link rel="icon" href="./monkey_cursor.svg" />
            </Head>

            <div className="relative py-3 sm:max-w-xl sm:mx-auto">
                <div className="absolute inset-0 bg-gradient-to-r from-yellow-900 to-yellow-200 shadow-lg transform -skew-y-6 sm:skew-y-0 sm:-rotate-6 sm:rounded-3xl"></div>
                <div className="relative px-4 py-10 bg-white shadow-lg sm:rounded-3xl sm:p-20">
                    <div className="flex">
                        <h1 className="text-4xl font-bold mb-8 text-center text-yellow-300">Schedule</h1>
                        <h1 className="text-4xl font-bold mb-8 text-center text-yellow-900">Monkey</h1>
                    </div>
                    <ChatAssistant />
                </div>
            </div>
        </div>
    );
};

export default Home;