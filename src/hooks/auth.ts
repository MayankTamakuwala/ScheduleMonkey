import { auth, provider, signInWithPopup } from "../firebaseConfig";
import { signOut } from "firebase/auth";

export const signInWithGoogle = async () => {
	try {
		const result = await signInWithPopup(auth, provider);
		const user = result.user;
		console.log("User Info: ", user);
		// Redirect or perform additional actions
	} catch (error) {
		console.error("Error during sign in: ", error);
	}
};

export const signOutUser = async () => {
	try {
		await signOut(auth);
		console.log("User signed out");
	} catch (error) {
		console.error("Error signing out:", error);
	}
};
