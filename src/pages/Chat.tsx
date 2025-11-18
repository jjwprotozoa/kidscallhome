import { useEffect, useState, useRef } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Send } from "lucide-react";
import { useBadgeStore } from "@/stores/badgeStore";
import { safeLog, sanitizeObject, sanitizeError } from "@/utils/security";

interface Message {
  id: string;
  sender_type: "parent" | "child";
  content: string;
  created_at: string;
  read_at?: string | null;
}

interface ChildSession {
  id: string;
  name: string;
  avatar_color: string;
}

const Chat = () => {
  const { childId } = useParams();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isChild, setIsChild] = useState(false);
  const [childData, setChildData] = useState<ChildSession | null>(null);
  const [parentData, setParentData] = useState<{ name: string; id?: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [parentName, setParentName] = useState<string>("Mom/Dad");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const initializeChat = async () => {
      let targetChildId: string | null = null;
      
      // CRITICAL: Check auth session FIRST - parents have auth session, children don't
      // This prevents parents from being misidentified as children due to stale childSession
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user) {
          // Has auth session = parent (even if childSession exists)
          setIsChild(false);
          
          // Parent accessing chat via /chat/:childId route
          if (childId) {
            targetChildId = childId;
            fetchMessages(childId);
            fetchChildData(childId);
          } else {
            navigate("/parent/children");
            return;
          }
        } else {
          // No auth session - check if we have childSession
          const childSession = localStorage.getItem("childSession");
          if (childSession) {
            try {
              const data = JSON.parse(childSession);
              setIsChild(true);
              setChildData(data);
              targetChildId = data.id;
              fetchMessages(data.id);
              // Fetch parent data for child users - get parent_id from database
              supabase
                .from("children")
                .select("parent_id")
                .eq("id", data.id)
                .single()
                .then(({ data: childRecord, error: childError }) => {
                  if (childError || !childRecord) {
                    console.error("Error fetching child record:", childError);
                    return;
                  }
                  // Now fetch parent data
                  return supabase
                    .from("parents")
                    .select("id, name")
                    .eq("id", childRecord.parent_id)
                    .maybeSingle();
                })
                .then((result) => {
                  if (result?.data) {
                    setParentName(result.data.name);
                    setParentData({ name: result.data.name, id: result.data.id });
                  } else if (result?.error) {
                    console.error("Error fetching parent data:", result.error);
                  }
                })
                .catch((error) => {
                  console.error("Error fetching parent data:", error);
                });
            } catch (error) {
              console.error("Error parsing childSession:", error);
              navigate("/");
              return;
            }
          } else if (childId) {
            // No childSession but has childId param - this shouldn't happen for children
            // But could be a parent accessing without auth? Redirect to home
            navigate("/");
            return;
          } else {
            navigate("/");
            return;
          }
        }
      } catch (error) {
        console.error("Error checking auth session:", error);
        navigate("/");
        return;
      }

      // Set up realtime subscription
      if (targetChildId) {
        console.log("📡 [CHAT] Setting up realtime subscription for messages", {
          childId: targetChildId,
          isChild,
          timestamp: new Date().toISOString(),
        });

        const channelName = `messages-${targetChildId}`;
        console.log("📡 [CHAT] Creating realtime channel:", {
          channelName,
          targetChildId,
          filter: `child_id=eq.${targetChildId}`,
          isChild,
        });

        channelRef.current = supabase
          .channel(channelName)
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "messages",
              filter: `child_id=eq.${targetChildId}`,
            },
            (payload) => {
              console.log("📨 [CHAT] Received new message via realtime:", {
                messageId: payload.new.id,
                senderType: payload.new.sender_type,
                childId: payload.new.child_id,
                filterChildId: targetChildId,
                matches: payload.new.child_id === targetChildId,
                timestamp: new Date().toISOString(),
              });
              
              // Double-check the message matches our filter (should always be true, but safety check)
              if (payload.new.child_id === targetChildId) {
                setMessages((current) => {
                  // Check for duplicates (shouldn't happen, but safety check)
                  const exists = current.some((m) => m.id === payload.new.id);
                  if (exists) {
                    console.warn("⚠️ [CHAT] Duplicate message detected, ignoring:", payload.new.id);
                    return current;
                  }
                  return [...current, payload.new as Message];
                });
              } else {
                console.warn("⚠️ [CHAT] Received message for different child_id, ignoring:", {
                  received: payload.new.child_id,
                  expected: targetChildId,
                });
              }
            }
          )
          .subscribe((status, err) => {
            console.log("📡 [CHAT] Realtime subscription status:", {
              status,
              channel: channelName,
              childId: targetChildId,
              isChild,
              error: err,
              timestamp: new Date().toISOString(),
            });
            
            if (status === "SUBSCRIBED") {
              console.log("✅ [CHAT] Successfully subscribed to messages");
              console.log("✅ [CHAT] Will receive INSERT events for child_id:", targetChildId);
            } else if (status === "CHANNEL_ERROR") {
              console.error("❌ [CHAT] Realtime subscription error:", err);
              console.error("❌ [CHAT] This usually means:");
              console.error("   1. RLS policies are blocking SELECT access");
              console.error("   2. Realtime is not enabled for messages table");
              console.error("   3. WebSocket connection failed");
              console.error("❌ [CHAT] Falling back to polling (checking every 3 seconds)");
            } else if (status === "TIMED_OUT") {
              console.warn("⚠️ [CHAT] Realtime subscription timed out - using polling fallback");
            } else if (status === "CLOSED") {
              console.warn("⚠️ [CHAT] Realtime subscription closed - using polling fallback");
            } else {
              console.log("ℹ️ [CHAT] Realtime subscription status:", status);
            }
          });
      }
    };

    initializeChat();

    return () => {
      if (channelRef.current) {
        console.log("🧹 [CHAT] Cleaning up realtime subscription");
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [childId, navigate]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Mark messages as read when chat is viewed
  useEffect(() => {
    if (!childData) return;

    const markMessagesAsRead = async () => {
      try {
        const childSession = localStorage.getItem("childSession");
        const isChild = !!childSession;
        const targetChildId = isChild ? childData.id : childId;

        if (!targetChildId) {
          console.log("⚠️ [CHAT READ] No targetChildId, skipping mark as read");
          return;
        }

        console.log("📖 [CHAT READ] Starting mark as read process", {
          targetChildId,
          isChild,
          timestamp: new Date().toISOString(),
        });

        // Get ALL unread messages for this conversation (no limit)
        let query = supabase
          .from("messages")
          .select("id, sender_type, read_at")
          .eq("child_id", targetChildId)
          .is("read_at", null);

        if (isChild) {
          // Child: mark parent messages as read
          query = query.eq("sender_type", "parent");
        } else {
          // Parent: mark child messages as read
          query = query.eq("sender_type", "child");
        }

        const { data: unreadMessages, error: fetchError } = await query;

        if (fetchError) {
          console.error("❌ [CHAT READ] Error fetching unread messages:", fetchError);
          return;
        }

        if (!unreadMessages || unreadMessages.length === 0) {
          console.log("✅ [CHAT READ] No unread messages found");
          // Clear badge anyway to ensure UI is in sync
          useBadgeStore.getState().clearUnreadForChild(targetChildId);
          return;
        }

        const unreadMessageIds = unreadMessages.map((msg) => msg.id);
        console.log(`📖 [CHAT READ] Found ${unreadMessageIds.length} unread messages to mark as read`, {
          messageIds: unreadMessageIds.slice(0, 5), // Log first 5 IDs
          totalCount: unreadMessageIds.length,
        });

        // Mark messages as read immediately in database
        const readAt = new Date().toISOString();
        const { error } = await supabase
          .from("messages")
          .update({ read_at: readAt })
          .in("id", unreadMessageIds);

        if (error) {
          console.error("❌ [CHAT READ] Error marking messages as read:", error);
          return;
        }

        console.log(`✅ [CHAT READ] Successfully marked ${unreadMessageIds.length} messages as read`, {
          readAt,
        });

        // Update local state to reflect read status immediately
        setMessages((prev) =>
          prev.map((msg) =>
            unreadMessageIds.includes(msg.id)
              ? { ...msg, read_at: readAt }
              : msg
          )
        );

        // IMMEDIATELY clear badge count optimistically (before realtime events)
        // This ensures instant UI feedback when user navigates away
        useBadgeStore.getState().clearUnreadForChild(targetChildId);
        console.log(`✅ [CHAT READ] Badge cleared immediately for child ${targetChildId}`);

        // Note: Realtime subscription (useBadgeRealtime) will also handle decrements
        // This ensures all devices receive the update and badge counts stay in sync
        // The immediate clear above provides instant feedback, realtime syncs across devices
      } catch (error) {
        console.error("❌ [CHAT READ] Error in markMessagesAsRead:", error);
      }
    };

    // Mark messages as read immediately when chat page loads
    markMessagesAsRead();
  }, [childData, childId]); // Run when childData or childId changes (page loads)

  // Cleanup: Ensure badge is cleared when navigating away from chat
  useEffect(() => {
    return () => {
      // This cleanup runs when component unmounts (user navigates away)
      const childSession = localStorage.getItem("childSession");
      const isChild = !!childSession;
      const targetChildId = isChild ? (childData?.id || null) : childId;

      if (targetChildId) {
        console.log("🧹 [CHAT CLEANUP] Clearing badge on chat exit", { targetChildId });
        // Force clear badge on exit to ensure UI reflects cleared state
        useBadgeStore.getState().clearUnreadForChild(targetChildId);
      }
    };
  }, [childData, childId]);

  // Fallback polling for messages (in case realtime fails)
  useEffect(() => {
    if (!childData) return;
    
    const targetChildId = isChild ? childData.id : childId;
    if (!targetChildId) return;

    // Poll every 15 seconds as fallback if realtime isn't working (more frequent than global since user is actively viewing chat)
    const pollInterval = setInterval(async () => {
      try {
        const { data, error } = await supabase
          .from("messages")
          .select("*")
          .eq("child_id", targetChildId)
          .order("created_at", { ascending: true });

        if (!error && data) {
          setMessages((current) => {
            // Only update if we have new messages (check by comparing IDs)
            const currentIds = new Set(current.map((m) => m.id));
            const newMessages = data.filter((m) => !currentIds.has(m.id));
            
            if (newMessages.length > 0) {
              console.log("📨 [CHAT] Polling found new messages:", newMessages.length);
              return [...current, ...newMessages] as Message[];
            }
            return current;
          });
        }
      } catch (error) {
        console.error("❌ [CHAT] Polling error:", error);
      }
    }, 15000); // Poll every 15 seconds (fallback for realtime)

    return () => clearInterval(pollInterval);
  }, [childData, childId, isChild]);

  const fetchChildData = async (id: string) => {
    const { data } = await supabase
      .from("children")
      .select("*")
      .eq("id", id)
      .single();
    if (data) setChildData(data);
  };

  const fetchMessages = async (id: string) => {
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("child_id", id)
      .order("created_at", { ascending: true });

    if (error) {
      toast({
        title: "Error loading messages",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    setMessages((data as Message[]) || []);
  };


  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !childData) return;

    setLoading(true);
    try {
      const targetChildId = isChild ? childData.id : childId;
      
      // Get sender_id - for parents, must be auth.uid()
      let senderId: string | undefined;
      let authUid: string | undefined;
      
      if (isChild) {
        senderId = childData.id;
        authUid = undefined; // Children are anonymous
      } else {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
          throw new Error("Not authenticated. Please log in again.");
        }
        senderId = user.id;
        authUid = user.id; // For parents, sender_id must equal auth.uid()
      }

      // Validate all required fields
      if (!senderId) {
        throw new Error("Missing sender_id");
      }
      if (!targetChildId) {
        throw new Error("Missing child_id");
      }

      // Build payload matching RLS requirements
      const payload = {
        child_id: targetChildId,
        sender_id: senderId,
        sender_type: isChild ? "child" : "parent",
        content: newMessage.trim(),
      };

      // DEBUG: Log payload to console (sanitized)
      // SECURITY: Never log message content - only metadata
      safeLog.log("📤 [MESSAGE INSERT] Payload:", {
        child_id: payload.child_id,
        sender_id: payload.sender_id,
        sender_type: payload.sender_type,
        content_length: payload.content.length,
        isChild,
        auth_uid: authUid,
        sender_id_matches_auth_uid: isChild ? "N/A (anon)" : (senderId === authUid),
      });

      const { data, error } = await supabase.from("messages").insert(payload).select().single();

      if (error) {
        // SECURITY: Sanitize error and payload before logging
        safeLog.error("❌ [MESSAGE INSERT] Error:", {
          message: error.message,
          code: error.code,
          details: error.details ? sanitizeObject(error.details) : undefined,
          hint: error.hint,
          // Never log full payload - only metadata
          payload_metadata: {
            child_id: payload.child_id,
            sender_type: payload.sender_type,
            content_length: payload.content.length,
          },
        });
        throw error;
      }

      safeLog.log("✅ [MESSAGE INSERT] Success", { messageId: data?.id });

      // Optimistic update: Add message to local state immediately
      // This ensures the message appears right away, even if realtime is slow
      // The realtime subscription will handle duplicates (we check for duplicates in the subscription handler)
      if (data) {
        const newMessage: Message = {
          id: data.id,
          sender_type: data.sender_type as "parent" | "child",
          content: data.content,
          created_at: data.created_at,
        };
        
        setMessages((current) => {
          // Check for duplicates (shouldn't happen, but safety check)
          const exists = current.some((m) => m.id === newMessage.id);
          if (exists) {
            safeLog.log("ℹ️ [MESSAGE INSERT] Message already in state (realtime beat us), skipping optimistic update");
            return current;
          }
          safeLog.log("✅ [MESSAGE INSERT] Adding message to local state (optimistic update)");
          return [...current, newMessage];
        });
      }

      setNewMessage("");
    } catch (error: any) {
      // SECURITY: Sanitize error before logging
      safeLog.error("❌ [MESSAGE INSERT] Exception:", sanitizeError(error));
      toast({
        title: "Error sending message",
        description: error.message || "Failed to send message",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const goBack = () => {
    navigate(isChild ? "/child/dashboard" : "/parent/children");
  };

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background relative">
      <div className="bg-chat-accent p-4 flex items-center gap-4 fixed top-0 left-0 right-0 z-10">
        <Button onClick={goBack} variant="ghost" size="sm" className="text-white">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-3">
          {isChild ? (
            parentData && (
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold bg-primary"
              >
                {parentData.name[0].toUpperCase()}
              </div>
            )
          ) : (
            childData && (
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
                style={{ backgroundColor: childData.avatar_color }}
              >
                {childData.name[0]}
              </div>
            )
          )}
          <h1 className="text-xl font-bold text-white">
            {isChild ? parentName : childData?.name}
          </h1>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4" style={{ paddingTop: '80px', paddingBottom: '100px' }}>
        {messages.map((message) => {
          const isMine = isChild
            ? message.sender_type === "child"
            : message.sender_type === "parent";

          return (
            <div
              key={message.id}
              className={`flex ${isMine ? "justify-end" : "justify-start"}`}
            >
              <Card
                className={`max-w-xs p-3 ${
                  isMine ? "bg-chat-accent text-chat-accent-foreground" : "bg-muted"
                }`}
              >
                <p className="break-words">{message.content}</p>
                <p
                  className={`text-xs mt-1 ${
                    isMine ? "text-white/70" : "text-muted-foreground"
                  }`}
                >
                  {new Date(message.created_at).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </Card>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={sendMessage} className="p-4 bg-card border-t fixed bottom-0 left-0 right-0 z-10">
        <div className="flex gap-2">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            disabled={loading}
            className="flex-1"
          />
          <Button 
            type="submit" 
            disabled={loading || !newMessage.trim()}
            className="bg-chat-accent text-chat-accent-foreground hover:bg-chat-accent/90"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </div>
  );
};

export default Chat;
