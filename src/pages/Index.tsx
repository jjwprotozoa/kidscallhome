import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Users, MessageCircle } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/10 to-background">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center space-y-6 mb-16">
          <img 
            src="/icon-192x192.png" 
            alt="Kids Call Home" 
            className="h-20 w-20 mx-auto"
          />
          <h1 className="text-5xl md:text-6xl font-bold text-primary">
            Kids Call Home
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Stay connected with your family through simple video calls and messaging
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          <Card
            className="p-8 cursor-pointer hover:shadow-xl transition-all border-4 border-primary/20 hover:border-primary/40"
            onClick={() => navigate("/parent/auth")}
          >
            <Users className="h-16 w-16 text-primary mb-4" />
            <h2 className="text-3xl font-bold mb-4">Parents</h2>
            <p className="text-muted-foreground mb-6">
              Create an account and add your children. Manage their access and stay connected.
            </p>
            <Button className="w-full" size="lg">
              Parent Sign In
            </Button>
          </Card>

          <Card
            className="p-8 cursor-pointer hover:shadow-xl transition-all border-4 border-secondary/20 hover:border-secondary/40"
            onClick={() => navigate("/child/login")}
          >
            <MessageCircle className="h-16 w-16 text-secondary mb-4" />
            <h2 className="text-3xl font-bold mb-4">Kids</h2>
            <p className="text-muted-foreground mb-6">
              Enter your special code to call and message your parents!
            </p>
            <Button className="w-full" size="lg" variant="secondary">
              Kid Login
            </Button>
          </Card>
        </div>

        <div className="mt-16 grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          <div className="text-center space-y-3">
            <div className="text-4xl">🎥</div>
            <h3 className="font-bold text-xl">Video Calls</h3>
            <p className="text-sm text-muted-foreground">
              Face-to-face conversations anytime
            </p>
          </div>
          <div className="text-center space-y-3">
            <div className="text-4xl">💬</div>
            <h3 className="font-bold text-xl">Messaging</h3>
            <p className="text-sm text-muted-foreground">
              Send messages instantly
            </p>
          </div>
          <div className="text-center space-y-3">
            <div className="text-4xl">🔒</div>
            <h3 className="font-bold text-xl">Safe & Secure</h3>
            <p className="text-sm text-muted-foreground">
              Private family connections only
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
