import React from 'react';
import Head from 'next/head';
import ChatAssistant from '@/components/ChatAssistant';
import SignInForm from '@/components/SignInForm';
import { useAuth } from '@/app/authContext';
import { signOutUser } from '@/hooks/auth';

const Home: React.FC = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="flex justify-center items-center h-screen">Loading...</div>;
  }

  return (
    <div className="min-h-screen py-6 flex flex-col justify-center sm:py-12">
      <Head>
        <title>ScheduleMonkey</title>
        <link rel="icon" href="./monkey_cursor.svg" />
      </Head>

      <div className="relative py-3 w-3/4 sm:mx-auto">
        <div className="absolute inset-0 bg-gradient-to-r from-yellow-900 to-yellow-200 shadow-lg transform -skew-y-6 sm:skew-y-0 sm:-rotate-6 sm:rounded-3xl"></div>
        <div className="relative px-4 py-10 bg-white shadow-lg sm:rounded-3xl sm:p-20">
          <div className="flex justify-center mb-8">
            <h1 className="text-4xl font-bold text-center text-yellow-300">Schedule</h1>
            <h1 className="text-4xl font-bold text-center text-yellow-900">Monkey</h1>
          </div>

          {user ? (
            <>
              <ChatAssistant /> {/* Show ChatAssistant if the user is authenticated */}
              <button
                onClick={signOutUser}
                className="mt-4 bg-red-500 text-white font-bold py-2 px-4 rounded hover:bg-red-600 transition duration-300"
              >
                Sign Out
              </button>
            </>
          ) : (
            <SignInForm /> // Show SignInForm if the user is not authenticated
          )}
        </div>
      </div>
    </div>
  );
};

export default Home;
