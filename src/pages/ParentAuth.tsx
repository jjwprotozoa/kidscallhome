import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { LogIn, UserPlus } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const ParentAuth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [staySignedIn, setStaySignedIn] = useState(true);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  // Load saved preference on mount
  useEffect(() => {
    const savedPreference = localStorage.getItem("staySignedIn");
    if (savedPreference !== null) {
      setStaySignedIn(savedPreference === "true");
    }
  }, []);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Store preference for session persistence
      localStorage.setItem("staySignedIn", staySignedIn.toString());
      
      // If "Stay signed in" is unchecked, use sessionStorage for this session
      // Note: Supabase client uses localStorage by default, but we'll handle clearing on unload
      if (!staySignedIn) {
        // Store a flag to clear session on browser close
        sessionStorage.setItem("clearSessionOnClose", "true");
      } else {
        sessionStorage.removeItem("clearSessionOnClose");
      }

      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        toast({ title: "Welcome back!" });
        navigate("/parent/dashboard");
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { name },
            emailRedirectTo: `${window.location.origin}/parent/dashboard`,
          },
        });
        if (error) throw error;
        toast({ title: "Account created! Welcome!" });
        navigate("/parent/dashboard");
      }
    } catch (error: unknown) {
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md p-8 space-y-6">
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <img 
              src="/icon-192x192.png" 
              alt="Kids Call Home" 
              className="h-12 w-12"
            />
          </div>
          <h1 className="text-3xl font-bold">Kids Call Home</h1>
          <p className="text-muted-foreground">
            {isLogin ? "Welcome back, parent!" : "Create your parent account"}
          </p>
        </div>

        <form onSubmit={handleAuth} className="space-y-4">
          {!isLogin && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Your Name</label>
              <Input
                type="text"
                placeholder="Mom / Dad / Guardian"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required={!isLogin}
              />
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium">Email</label>
            <Input
              type="email"
              placeholder="parent@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Password</label>
            <Input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>

          {isLogin && (
            <div className="flex items-center space-x-2">
              <Checkbox
                id="staySignedIn"
                checked={staySignedIn}
                onCheckedChange={(checked) => setStaySignedIn(checked === true)}
              />
              <Label
                htmlFor="staySignedIn"
                className="text-sm font-normal cursor-pointer"
              >
                Stay signed in
              </Label>
            </div>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? (
              "Processing..."
            ) : isLogin ? (
              <>
                <LogIn className="mr-2 h-4 w-4" />
                Sign In
              </>
            ) : (
              <>
                <UserPlus className="mr-2 h-4 w-4" />
                Create Account
              </>
            )}
          </Button>
        </form>

        <div className="text-center">
          <button
            type="button"
            onClick={() => setIsLogin(!isLogin)}
            className="text-sm text-primary hover:underline"
          >
            {isLogin
              ? "Need an account? Sign up"
              : "Already have an account? Sign in"}
          </button>
        </div>
      </Card>
    </div>
  );
};

export default ParentAuth;
