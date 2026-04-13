import { Shield, Users } from 'lucide-react';
import { Link, useNavigate } from 'react-router';

import { useIsRole } from '../../hooks/useAuth';

export default function AdminPage() {
  const isAdmin = useIsRole('ADMIN');
  const navigate = useNavigate();

  if (!isAdmin) {
    navigate('/dashboard');
    return null;
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold">Administration</h1>

      <div className="grid grid-cols-2 gap-4">
        <AdminCard
          icon={<Users className="w-5 h-5 text-primary" />}
          title="Utilisateurs"
          description="Gérer les comptes"
          href="/admin/users"
        />
        <AdminCard
          icon={<Shield className="w-5 h-5 text-slate-500" />}
          title="Logs d'audit"
          description="Traçabilité des actions"
          href="/admin/audit"
        />
      </div>
    </div>
  );
}

function AdminCard({
  icon,
  title,
  description,
  href,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  href: string;
}) {
  return (
    <Link
      to={href}
      className="bg-card rounded-xl border border-border p-5 flex items-start gap-3 hover:border-primary/20 transition-colors"
    >
      <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </Link>
  );
}
