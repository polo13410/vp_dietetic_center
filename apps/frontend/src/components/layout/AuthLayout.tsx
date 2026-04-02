import { Outlet } from 'react-router';

export function AuthLayout() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 mb-4">
            <svg className="w-7 h-7 text-primary" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold text-foreground">VP Dietetic Center</h1>
          <p className="text-sm text-muted-foreground mt-1">Espace praticienne</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-border p-8">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
