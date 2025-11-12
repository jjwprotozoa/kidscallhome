import { useEffect, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Send } from "lucide-react";

interface Message {
  id: string;
  sender_type: "parent" | "child";
  content: string;
  created_at: string;
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
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const childSession = localStorage.getItem("childSession");
    if (childSession) {
      const data = JSON.parse(childSession);
      setIsChild(true);
      setChildData(data);
      fetchMessages(data.id);
      subscribeToMessages(data.id);
    } else if (childId) {
      setIsChild(false);
      fetchMessages(childId);
      subscribeToMessages(childId);
      fetchChildData(childId);
    } else {
      navigate("/");
    }
  }, [childId, navigate]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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

  const subscribeToMessages = (id: string) => {
    const channel = supabase
      .channel("messages")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `child_id=eq.${id}`,
        },
        (payload) => {
          setMessages((current) => [...current, payload.new as Message]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !childData) return;

    setLoading(true);
    try {
      const targetChildId = isChild ? childData.id : childId;
      const senderId = isChild ? childData.id : (await supabase.auth.getUser()).data.user?.id;

      const { error } = await supabase.from("messages").insert({
        child_id: targetChildId,
        sender_id: senderId,
        sender_type: isChild ? "child" : "parent",
        content: newMessage.trim(),
      });

      if (error) throw error;
      setNewMessage("");
    } catch (error: any) {
      toast({
        title: "Error sending message",
        description: error.message,
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
    navigate(isChild ? "/child/dashboard" : "/parent/dashboard");
  };

  return (
    <div className="h-screen flex flex-col bg-background">
      <div className="bg-primary p-4 flex items-center gap-4">
        <Button onClick={goBack} variant="ghost" size="sm" className="text-white">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-3">
          {childData && (
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
              style={{ backgroundColor: childData.avatar_color }}
            >
              {childData.name[0]}
            </div>
          )}
          <h1 className="text-xl font-bold text-white">
            {isChild ? "Mom/Dad" : childData?.name}
          </h1>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
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
                  isMine ? "bg-primary text-white" : "bg-muted"
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

      <form onSubmit={sendMessage} className="p-4 bg-card border-t">
        <div className="flex gap-2">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            disabled={loading}
            className="flex-1"
          />
          <Button type="submit" disabled={loading || !newMessage.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </div>
  );
};

export default Chat;
