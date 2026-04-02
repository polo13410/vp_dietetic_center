import { Link } from 'react-router';

import { Button } from '../components/ui/button';

export default function NotFoundPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center">
        <p className="text-6xl font-bold text-primary/20 mb-4">404</p>
        <h1 className="text-xl font-semibold mb-2">Page introuvable</h1>
        <p className="text-sm text-muted-foreground mb-6">
          La page que vous cherchez n'existe pas.
        </p>
        <Button asChild>
          <Link to="/dashboard">Retour au tableau de bord</Link>
        </Button>
      </div>
    </div>
  );
}
