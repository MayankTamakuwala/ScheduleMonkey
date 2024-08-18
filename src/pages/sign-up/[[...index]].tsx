import Head from "next/head";
import { SignUp } from "@clerk/nextjs";

export default function Page() {
  return (
    <div className="w-screen h-screen flex justify-center items-center">
      <Head>
        <title>Sign Up</title>
      </Head>
      <SignUp />
    </div>
  );
}