import { Outlet } from 'react-router';

export function AuthLayout() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img src="/logo_full_transparent.png" alt="VP Dietetic Center" className="h-16 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground mt-1">Espace praticienne</p>
        </div>
        <div className="bg-card rounded-2xl shadow-sm border border-border p-8">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
