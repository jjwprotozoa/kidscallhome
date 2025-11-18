// src/pages/ChildParentsList.tsx
// Child: Parent List / Profile Screen

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Phone } from "lucide-react";
import Navigation from "@/components/Navigation";

interface ChildSession {
  id: string;
  name: string;
  avatar_color: string;
  parent_id: string;
}

interface Parent {
  id: string;
  name: string;
}

const ChildParentsList = () => {
  const [child, setChild] = useState<ChildSession | null>(null);
  const [parent, setParent] = useState<Parent | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const loadData = async () => {
      console.log("🚀 [ChildParentsList] Starting loadData");
      
      // CRITICAL: Ensure we're using anonymous access (not authenticated)
      // Children should use anonymous role, not authenticated
      const { data: authCheck } = await supabase.auth.getSession();
      if (authCheck?.session) {
        console.warn("⚠️ [ChildParentsList] Supabase client has auth session, signing out for anonymous access");
        await supabase.auth.signOut();
        console.log("✅ [ChildParentsList] Signed out, now using anonymous role");
      } else {
        console.log("✅ [ChildParentsList] No auth session, using anonymous role");
      }
      
      const sessionData = localStorage.getItem("childSession");
      console.log("📦 [ChildParentsList] Session data from localStorage:", sessionData ? "exists" : "missing");
      
      if (!sessionData) {
        console.warn("⚠️ [ChildParentsList] No session data, redirecting to login");
        navigate("/child/login");
        return;
      }
      
      let childData;
      try {
        childData = JSON.parse(sessionData);
        console.log("✅ [ChildParentsList] Parsed child data:", {
          id: childData.id,
          name: childData.name,
          parent_id: childData.parent_id,
          has_parent_id: !!childData.parent_id
        });
      } catch (error) {
        console.error("❌ [ChildParentsList] Error parsing session data:", error);
        navigate("/child/login");
        return;
      }
      
      setChild(childData);

      // If parent_id is not in session, fetch it from database
      let parentId = childData.parent_id;
      console.log("🔍 [ChildParentsList] Initial parent_id:", parentId);
      
      if (!parentId && childData.id) {
        console.log("📡 [ChildParentsList] Parent_id missing, fetching from database for child_id:", childData.id);
        try {
          const { data: childRecord, error: childError } = await supabase
            .from("children")
            .select("parent_id")
            .eq("id", childData.id)
            .single();

          console.log("📊 [ChildParentsList] Child record query result:", {
            data: childRecord,
            error: childError,
            has_parent_id: !!childRecord?.parent_id
          });

          if (childError) {
            console.error("❌ [ChildParentsList] Error fetching child record:", childError);
            throw childError;
          }
          
          if (childRecord?.parent_id) {
            parentId = childRecord.parent_id;
            console.log("✅ [ChildParentsList] Got parent_id from database:", parentId);
          } else {
            console.warn("⚠️ [ChildParentsList] Child record found but no parent_id");
          }
        } catch (error) {
          console.error("❌ [ChildParentsList] Error fetching child's parent_id:", error);
        }
      }

      console.log("🎯 [ChildParentsList] Final parent_id to fetch:", parentId);

      if (parentId) {
        console.log("📞 [ChildParentsList] Calling fetchParent with parent_id:", parentId);
        await fetchParent(parentId);
      } else {
        console.error("❌ [ChildParentsList] No parent_id available, cannot fetch parent");
        toast({
          title: "Error",
          description: "Could not find parent information",
          variant: "destructive",
        });
        setLoading(false);
      }
    };

    loadData();
  }, [navigate, toast]);

  const fetchParent = async (parentId: string) => {
    try {
      console.log("🔍 [ChildParentsList] fetchParent called with:", {
        parentId,
        parentIdType: typeof parentId,
        parentIdLength: parentId?.length,
        isValidUUID: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(parentId || "")
      });

      if (!parentId) {
        console.error("❌ [ChildParentsList] Parent ID is missing!");
        throw new Error("Parent ID is required");
      }

      if (parentId === "undefined" || parentId === "null") {
        console.error("❌ [ChildParentsList] Parent ID is string 'undefined' or 'null'");
        throw new Error("Invalid parent ID");
      }

      // Double-check we're anonymous before querying
      const { data: finalAuthCheck } = await supabase.auth.getSession();
      console.log("🔐 [ChildParentsList] Final auth check before query:", {
        hasSession: !!finalAuthCheck?.session,
        userId: finalAuthCheck?.session?.user?.id,
        isAnonymous: !finalAuthCheck?.session
      });

      console.log("📡 [ChildParentsList] Making Supabase query:", {
        table: "parents",
        select: "id, name",
        filter: `id = ${parentId}`,
        expectedRole: "anon (anonymous)"
      });

      // Direct query to parents table (RLS allows children to view parent names)
      console.log("🔧 [ChildParentsList] Fetching parent name from parents table...");
      try {
        const { data: functionData, error: functionError } = await supabase
          .from('parents')
          .select('id, name')
          .eq('id', parentId)
          .maybeSingle();
        
        console.log("🔧 [ChildParentsList] Query result:", {
          data: functionData,
          dataType: Array.isArray(functionData) ? 'array' : typeof functionData,
          dataLength: Array.isArray(functionData) ? functionData.length : 'N/A',
          error: functionError,
          hasData: Array.isArray(functionData) ? functionData.length > 0 : !!functionData,
          functionErrorDetails: functionError ? {
            message: functionError.message,
            code: functionError.code,
            details: functionError.details,
            hint: functionError.hint
          } : null
        });
        
        if (functionData) {
          console.log("✅ [ChildParentsList] Got parent data:", functionData);
          setParent(functionData as { id: string; name: string; });
          setLoading(false);
          return;
        }
        
        if (functionError) {
          console.error("❌ [ChildParentsList] Function error:", functionError);
        }
      } catch (functionErr) {
        console.error("❌ [ChildParentsList] Function call exception:", functionErr);
      }

      const queryStartTime = performance.now();
      const { data, error } = await supabase
        .from("parents")
        .select("id, name")
        .eq("id", parentId)
        .maybeSingle();
      const queryEndTime = performance.now();

      console.log("📊 [ChildParentsList] Query completed:", {
        duration: `${(queryEndTime - queryStartTime).toFixed(2)}ms`,
        hasData: !!data,
        data: data,
        dataType: typeof data,
        dataString: JSON.stringify(data),
        hasError: !!error,
        error: error ? {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint
        } : null,
        errorString: error ? JSON.stringify(error, null, 2) : null,
        fullResponse: { data, error }
      });
      
      // Also log the raw Supabase response
      const { data: testData, error: testError } = await supabase
        .from("parents")
        .select("id, name")
        .eq("id", parentId);
      
      console.log("🔬 [ChildParentsList] Raw query test (without maybeSingle):", {
        data: testData,
        dataLength: testData?.length,
        error: testError,
        isArray: Array.isArray(testData)
      });

      if (error) {
        console.error("❌ [ChildParentsList] Supabase error details:", {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
          fullError: error
        });
        
        // Check for specific error codes
        if (error.code === "PGRST116") {
          console.warn("⚠️ [ChildParentsList] PGRST116: No rows returned (RLS may be blocking)");
        } else if (error.code === "42501") {
          console.error("❌ [ChildParentsList] 42501: Insufficient privilege (RLS blocking)");
        } else if (error.code === "PGRST301") {
          console.error("❌ [ChildParentsList] PGRST301: JWT error (authentication issue)");
        }
        
        throw error;
      }
      
      if (!data) {
        console.warn("⚠️ [ChildParentsList] No data returned (but no error):", {
          parentId,
          possibleReasons: [
            "RLS policy is blocking access",
            "Parent record doesn't exist",
            "Parent ID is incorrect"
          ]
        });
        
        // Try to verify if parent exists by checking children table
        console.log("🔍 [ChildParentsList] Attempting to verify parent exists via children table...");
        const { data: childCheck, error: childCheckError } = await supabase
          .from("children")
          .select("parent_id, id, name")
          .eq("parent_id", parentId)
          .limit(5);
        
        console.log("🔍 [ChildParentsList] Children table check:", {
          foundChildren: childCheck?.length || 0,
          children: childCheck,
          error: childCheckError,
          canReadChildrenTable: !childCheckError && childCheck !== null
        });
        
        // Also test if we can read ANY parent (to test RLS)
        console.log("🧪 [ChildParentsList] Testing if we can read ANY parent...");
        const { data: anyParent, error: anyParentError } = await supabase
          .from("parents")
          .select("id")
          .limit(1);
        
        console.log("🧪 [ChildParentsList] Any parent test:", {
          foundAny: anyParent?.length || 0,
          data: anyParent,
          error: anyParentError,
          canReadAnyParent: !anyParentError && anyParent !== null
        });
        
        throw new Error("Parent not found. The RLS policy may be blocking access.");
      }
      
      console.log("✅ [ChildParentsList] Parent successfully fetched:", {
        id: data.id,
        name: data.name,
        hasName: !!data.name
      });
      setParent(data);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      console.error("❌ [ChildParentsList] Error in fetchParent:", {
        error,
        errorMessage,
        errorType: typeof error,
        errorConstructor: error?.constructor?.name,
        stack: error instanceof Error ? error.stack : null
      });
      toast({
        title: "Error loading parent",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      console.log("🏁 [ChildParentsList] fetchParent completed, setting loading to false");
      setLoading(false);
    }
  };

  const handleSelectParent = (parentId: string) => {
    // Store selected parent in localStorage for the dashboard to use
    localStorage.setItem("selectedParentId", parentId);
    // Navigate to dashboard which will show call/message buttons for this parent
    navigate("/child/dashboard");
  };

  if (loading || !child) {
    return (
      <div className="min-h-[100dvh] bg-background">
        <Navigation />
        <div className="p-4 flex items-center justify-center">
          <div>Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-background">
      <Navigation />
      <div className="p-4">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8 mt-8">
            <h1 className="text-3xl font-bold">Select Parent</h1>
            <p className="text-muted-foreground mt-2">
              Choose a parent to contact
            </p>
          </div>

          {parent ? (
            <Card 
              className="p-6 cursor-pointer hover:shadow-lg transition-all"
              onClick={() => handleSelectParent(parent.id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center text-white font-bold text-2xl">
                    {parent.name?.charAt(0).toUpperCase() || "P"}
                  </div>
                  <div>
                    <h3 className="text-2xl font-semibold">
                      {parent.name || "Parent"}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Tap to call or message
                    </p>
                  </div>
                </div>
                <Button onClick={(e) => {
                  e.stopPropagation();
                  handleSelectParent(parent.id);
                }}>
                  <Phone className="mr-2 h-4 w-4" />
                  Contact
                </Button>
              </div>
            </Card>
          ) : (
            <Card className="p-6">
              <p className="text-muted-foreground">No parent found.</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChildParentsList;

