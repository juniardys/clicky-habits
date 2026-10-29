import { Navigate, Route, Routes } from "react-router-dom";
import { useSession } from "./lib/auth";
import LoginPage from "./pages/LoginPage";
import HomePage from "./pages/HomePage";
import HabitPage from "./pages/HabitPage";
import StatsPage from "./pages/StatsPage";
import DashboardPage from "./pages/DashboardPage";

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
        <Route path="*" element={<LoginPage />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/dashboard" element={<DashboardPage />} />
      <Route path="/habits/:id" element={<HabitPage />} />
      <Route path="/habits/:id/stats" element={<StatsPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
