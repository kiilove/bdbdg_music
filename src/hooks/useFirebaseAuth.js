import { useState, useEffect } from "react";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
} from "firebase/auth";

const useFirebaseAuth = () => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(
      auth,
      (user) => {
        setUser(user);
        setIsLoading(false);
      },
      (error) => {
        setError(error);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const signInWithEmail = async (email, password) => {
    const auth = getAuth();
    try {
      const userCredential = await signInWithEmailAndPassword(
        auth,
        email,
        password
      );
      setUser(userCredential.user);
    } catch (error) {
      setError(error);
      switch (error.code) {
        case "auth/user-not-found":
          setError({ message: "사용자를 찾을 수 없습니다." });
          break;
        case "auth/wrong-password":
          setError({ message: "잘못된 비밀번호입니다." });
          break;
        case "auth/network-request-failed":
          setError({ message: "네트워크 오류가 발생했습니다." });
          break;
        default:
          console.error(error);
          break;
      }
    }
  };

  const signUpWithEmail = async (email, password) => {
    const auth = getAuth();
    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );
      setUser(userCredential.user);
    } catch (error) {
      setError(error);
      switch (error.code) {
        case "auth/email-already-in-use":
          setError({ message: "이미 사용 중인 이메일입니다." });
          break;
        case "auth/invalid-email":
          setError({ message: "유효하지 않은 이메일 주소입니다." });
          break;
        case "auth/weak-password":
          setError({ message: "보안 수준이 낮은 비밀번호입니다." });
          break;
        case "auth/network-request-failed":
          setError({ message: "네트워크 오류가 발생했습니다." });
          break;
        default:
          console.error(error);
          break;
      }
    }
  };

  const signOut = async () => {
    const auth = getAuth();
    try {
      await signOut(auth);
      setUser(null);
    } catch (error) {
      setError(error);
      console.error(error);
    }
  };

  return {
    user,
    isLoading,
    error,
    signInWithEmail,
    signUpWithEmail,
    signOut,
  };
};

export default useFirebaseAuth;
