import { Navigate, Outlet } from 'react-router';

import { useCurrentUser } from '../../hooks/useAuth';
import { homePathFor } from '../../lib/roles';

/** Renders the nested routes only for the given roles; others go back to their home page. */
export function RequireRole({ roles }: { roles: string[] }) {
  const user = useCurrentUser();
  if (!user || !roles.includes(user.role)) {
    return <Navigate to={homePathFor(user?.role)} replace />;
  }
  return <Outlet />;
}

/** Sends the user to the home page of their role. */
export function RoleHome() {
  const user = useCurrentUser();
  return <Navigate to={homePathFor(user?.role)} replace />;
}
