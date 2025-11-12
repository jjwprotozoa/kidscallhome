import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import ParentAuth from "./pages/ParentAuth";
import ParentDashboard from "./pages/ParentDashboard";
import ChildLogin from "./pages/ChildLogin";
import ChildDashboard from "./pages/ChildDashboard";
import VideoCall from "./pages/VideoCall";
import Chat from "./pages/Chat";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/parent/auth" element={<ParentAuth />} />
          <Route path="/parent/dashboard" element={<ParentDashboard />} />
          <Route path="/parent/chat/:childId" element={<Chat />} />
          <Route path="/child/login" element={<ChildLogin />} />
          <Route path="/child/dashboard" element={<ChildDashboard />} />
          <Route path="/child/chat" element={<Chat />} />
          <Route path="/child/call" element={<VideoCall />} />
          <Route path="/parent/call/:childId" element={<VideoCall />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
