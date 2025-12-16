// src/pages/ParentAuth/useAuthState.ts
// Purpose: Shared auth state management hook

import { useState, useEffect } from "react";
import { getCookie } from "@/utils/cookies";
import { AuthState } from "./types";

export const useAuthState = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [staySignedIn, setStaySignedIn] = useState(true);
  const [loading, setLoading] = useState(false);
  const [parentName, setParentName] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [needsFamilySetup, setNeedsFamilySetup] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  // Load saved preference and parent name from cookie
  useEffect(() => {
    const savedPreference = localStorage.getItem("staySignedIn");
    if (savedPreference !== null) {
      setStaySignedIn(savedPreference === "true");
    }

    const savedParentName = getCookie("parentName");
    if (savedParentName) {
      setParentName(savedParentName);
    }
  }, []);

  return {
    isLogin,
    setIsLogin,
    email,
    setEmail,
    password,
    setPassword,
    name,
    setName,
    staySignedIn,
    setStaySignedIn,
    loading,
    setLoading,
    parentName,
    setParentName,
    captchaToken,
    setCaptchaToken,
    needsFamilySetup,
    setNeedsFamilySetup,
    userId,
    setUserId,
  };
};








