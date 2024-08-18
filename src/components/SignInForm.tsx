import React from 'react';
import { signInWithGoogle } from '@/hooks/auth';

const SignInForm: React.FC = () => {
  return (
    <div>
      <button
        onClick={signInWithGoogle}
        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition duration-200 w-full"
      >
        Sign In with Google
      </button>
    </div>
  );
};

export default SignInForm;
