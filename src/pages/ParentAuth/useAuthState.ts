// src/pages/ParentAuth/useAuthState.ts
// Purpose: Shared auth state management hook

import { useState, useEffect, useRef } from "react";
import { getCookie } from "@/utils/cookies";
import { AuthState } from "./types";
import { FamilyRole } from "./SignupForm";

const SIGNUP_DRAFT_KEY = "kch_signup_draft";

interface SignupDraft {
  name: string;
  email: string;
  confirmEmail: string;
  familyRole: FamilyRole;
}

export const useAuthState = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [confirmEmail, setConfirmEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [familyRole, setFamilyRole] = useState<FamilyRole>("parent");
  const [staySignedIn, setStaySignedIn] = useState(true);
  const [loading, setLoading] = useState(false);
  const [parentName, setParentName] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [needsFamilySetup, setNeedsFamilySetup] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  
  // Track if we've loaded the draft to avoid overwriting user input
  const hasLoadedDraft = useRef(false);
  // Track if component has mounted to prevent saving before draft is loaded
  const isInitialized = useRef(false);

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

  // Load signup draft from localStorage when switching to signup mode
  useEffect(() => {
    if (!isLogin) {
      if (!hasLoadedDraft.current) {
        try {
          const draftJson = localStorage.getItem(SIGNUP_DRAFT_KEY);
          if (draftJson) {
            const draft: SignupDraft = JSON.parse(draftJson);
            if (draft.name) setName(draft.name);
            if (draft.email) setEmail(draft.email);
            if (draft.confirmEmail) setConfirmEmail(draft.confirmEmail);
            if (draft.familyRole) setFamilyRole(draft.familyRole);
            hasLoadedDraft.current = true;
          }
        } catch (error) {
          console.warn("Failed to load signup draft:", error);
          // Clear corrupted draft
          localStorage.removeItem(SIGNUP_DRAFT_KEY);
        }
      }
      // Mark as initialized when in signup mode (whether draft was loaded or not)
      isInitialized.current = true;
    } else {
      // Reset flags when switching to login mode
      hasLoadedDraft.current = false;
      isInitialized.current = false;
    }
  }, [isLogin]);

  // Save signup draft to localStorage when in signup mode and fields change
  // Only save after initialization and if there's actual data (user has typed something)
  useEffect(() => {
    if (!isLogin && isInitialized.current && (name || email || confirmEmail)) {
      try {
        const draft: SignupDraft = {
          name,
          email,
          confirmEmail,
          familyRole,
        };
        localStorage.setItem(SIGNUP_DRAFT_KEY, JSON.stringify(draft));
      } catch (error) {
        console.warn("Failed to save signup draft:", error);
      }
    }
  }, [isLogin, name, email, confirmEmail, familyRole]);

  // Clear signup draft on successful signup
  const clearSignupDraft = () => {
    localStorage.removeItem(SIGNUP_DRAFT_KEY);
    hasLoadedDraft.current = false;
  };

  return {
    isLogin,
    setIsLogin,
    email,
    setEmail,
    confirmEmail,
    setConfirmEmail,
    password,
    setPassword,
    confirmPassword,
    setConfirmPassword,
    name,
    setName,
    familyRole,
    setFamilyRole,
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
    clearSignupDraft,
  };
};












