import { Link } from 'react-router';

import { EmptyState } from '../components/shared/EmptyState';
import { Button } from '../components/ui/button';

/** An address that leads nowhere: say so kindly and offer the way home. */
export default function NotFoundPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <h1 className="sr-only">Page introuvable</h1>
      <div className="w-full max-w-md rounded-xl border bg-card shadow-sm">
        <EmptyState
          illustration="pear"
          title="Cette page n’existe pas."
          description="Le lien est peut-être incomplet, ou la page a été déplacée."
          action={
            <Button asChild>
              <Link to="/">Revenir à l’accueil</Link>
            </Button>
          }
        />
      </div>
    </div>
  );
}
