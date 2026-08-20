import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import Layout from "@/components/Layout";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import LeadFinder from "@/pages/LeadFinder";
import AllLeads from "@/pages/AllLeads";
import LeadWorkspace from "@/pages/LeadWorkspace";
import Research from "@/pages/Research";
import Campaigns from "@/pages/Campaigns";
import CampaignDetail from "@/pages/CampaignDetail";
import Pipeline from "@/pages/Pipeline";
import Clients from "@/pages/Clients";
import Projects from "@/pages/Projects";
import ProjectDetail from "@/pages/ProjectDetail";
import Tasks from "@/pages/Tasks";
import Team from "@/pages/Team";
import Documents from "@/pages/Documents";
import Analytics from "@/pages/Analytics";
import Settings from "@/pages/Settings";

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading)
    return (
      <div className="min-h-screen grid place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-600" />
      </div>
    );
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<Protected><Layout /></Protected>}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/finder" element={<LeadFinder />} />
        <Route path="/leads" element={<AllLeads />} />
        <Route path="/leads/:id" element={<LeadWorkspace />} />
        <Route path="/research" element={<Research />} />
        <Route path="/campaigns" element={<Campaigns />} />
        <Route path="/campaigns/:id" element={<CampaignDetail />} />
        <Route path="/pipeline" element={<Pipeline />} />
        <Route path="/clients" element={<Clients />} />
        <Route path="/projects" element={<Projects />} />
        <Route path="/projects/:id" element={<ProjectDetail />} />
        <Route path="/tasks" element={<Tasks />} />
        <Route path="/team" element={<Team />} />
        <Route path="/documents" element={<Documents />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
        <Toaster position="top-right" theme="dark" />
      </BrowserRouter>
    </AuthProvider>
  );
}
