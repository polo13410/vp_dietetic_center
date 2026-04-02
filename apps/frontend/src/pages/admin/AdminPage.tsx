import { useQuery } from '@tanstack/react-query';
import { Users, Shield } from 'lucide-react';
import { useNavigate } from 'react-router';

import api from '../../lib/api';
import { useIsRole } from '../../hooks/useAuth';
import { LoadingSpinner } from '../../components/ui/loading-screen';

export default function AdminPage() {
  const isAdmin = useIsRole('ADMIN');
  const navigate = useNavigate();

  if (!isAdmin) {
    navigate('/dashboard');
    return null;
  }

  return (
    <div className="space-y-5 max-w-3xl">
      <h1 className="text-xl font-semibold">Administration</h1>

      <div className="grid grid-cols-2 gap-4">
        <AdminCard icon={<Users className="w-5 h-5 text-primary" />} title="Utilisateurs" description="Gérer les comptes" href="/admin/users" />
        <AdminCard icon={<Shield className="w-5 h-5 text-slate-500" />} title="Logs d'audit" description="Traçabilité des actions" href="/admin/audit" />
      </div>

      <UsersSection />
    </div>
  );
}

function UsersSection() {
  const { data, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: async () => { const { data } = await api.get('/users'); return data; },
  });

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="bg-white rounded-xl border border-border overflow-hidden">
      <div className="px-5 py-4 border-b border-border">
        <h2 className="text-sm font-semibold">Utilisateurs</h2>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-slate-50/50">
            <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Nom</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Email</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Rôle</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Statut</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {data?.map((user: any) => (
            <tr key={user.id} className="hover:bg-slate-50/50">
              <td className="px-4 py-3 font-medium">{user.firstName} {user.lastName}</td>
              <td className="px-4 py-3 text-muted-foreground">{user.email}</td>
              <td className="px-4 py-3"><span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full">{user.role}</span></td>
              <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full ${user.isActive ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>{user.isActive ? 'Actif' : 'Inactif'}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AdminCard({ icon, title, description, href }: any) {
  return (
    <div className="bg-white rounded-xl border border-border p-5 flex items-start gap-3 hover:border-primary/20 transition-colors cursor-pointer">
      <div className="w-9 h-9 rounded-lg bg-slate-50 flex items-center justify-center flex-shrink-0">{icon}</div>
      <div><p className="text-sm font-medium">{title}</p><p className="text-xs text-muted-foreground">{description}</p></div>
    </div>
  );
}
