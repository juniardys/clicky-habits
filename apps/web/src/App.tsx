import { Navigate, Route, Routes } from "react-router-dom";
import { useSession } from "./lib/auth";
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import HomePage from "./pages/HomePage";
import HabitPage from "./pages/HabitPage";
import StatsPage from "./pages/StatsPage";
import DashboardPage from "./pages/DashboardPage";
import ProfilePage from "./pages/ProfilePage";
import ChatPanel from "./components/chat/ChatPanel";

export default function App() {
  const { data: session, isPending } = useSession();

  if (isPending) {
    return (
      <div className="center-screen">
        <div className="spinner" />
      </div>
    );
  }

  if (!session) {
    return (
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/app" element={<Navigate to="/login" replace />} />
        <Route path="/dashboard" element={<Navigate to="/login" replace />} />
        <Route path="/habits/:id" element={<Navigate to="/login" replace />} />
        <Route path="/habits/:id/stats" element={<Navigate to="/login" replace />} />
        <Route path="/profile" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  return (
    <>
      <Routes>
        <Route path="/" element={<Navigate to="/app" replace />} />
        <Route path="/login" element={<Navigate to="/app" replace />} />
        <Route path="/app" element={<HomePage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/habits/:id" element={<HabitPage />} />
        <Route path="/habits/:id/stats" element={<StatsPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="*" element={<Navigate to="/app" replace />} />
      </Routes>
      <ChatPanel />
    </>
  );
}
