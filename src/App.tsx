import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { Analytics } from "@vercel/analytics/react";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import ParentAuth from "./pages/ParentAuth";
import ParentDashboard from "./pages/ParentDashboard";
import ParentHome from "./pages/ParentHome";
import ParentChildrenList from "./pages/ParentChildrenList";
import ParentCallScreen from "./pages/ParentCallScreen";
import ChildLogin from "./pages/ChildLogin";
import ChildDashboard from "./pages/ChildDashboard";
import ChildHome from "./pages/ChildHome";
import ChildParentsList from "./pages/ChildParentsList";
import ChildCallScreen from "./pages/ChildCallScreen";
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
          <Route path="/parent" element={<ParentHome />} />
          <Route path="/parent/children" element={<ParentChildrenList />} />
          <Route path="/parent/call/:childId" element={<ParentCallScreen />} />
          <Route path="/parent/dashboard" element={<ParentDashboard />} />
          <Route path="/child/login" element={<ChildLogin />} />
          <Route path="/child" element={<ChildHome />} />
          <Route path="/child/parents" element={<ChildParentsList />} />
          <Route path="/child/call/:parentId" element={<ChildCallScreen />} />
          <Route path="/child/dashboard" element={<ChildDashboard />} />
          <Route path="/call/:childId" element={<VideoCall />} />
          <Route path="/chat/:childId" element={<Chat />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
      <SpeedInsights />
      <Analytics />
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
