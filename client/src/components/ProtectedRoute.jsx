import { Navigate, useLocation } from 'react-router-dom';
import { HOME_BY_ROLE, useAuth } from '../context/AuthContext';
import { PageLoader } from './ui';

/** Role gate for the UI. The API enforces the same rules - this only avoids showing pages that would 403. */
export default function ProtectedRoute({ roles, children }) {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <PageLoader label="Checking your session…" />;
  if (!user) {
    const portal = loc.pathname.startsWith('/admin') ? '/admin/login' : loc.pathname.startsWith('/technician') ? '/technician/login' : '/login';
    return <Navigate to={portal} replace state={{ from: loc.pathname + loc.search }} />;
  }
  if (roles && !roles.includes(user.role)) return <Navigate to={HOME_BY_ROLE[user.role]} replace />;
  return children;
}
