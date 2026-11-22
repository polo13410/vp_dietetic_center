import { AppearanceSection } from '../../components/settings/AppearanceSection';
import { FormulasSection } from '../../components/settings/FormulasSection';
import { PracticeSection } from '../../components/settings/PracticeSection';
import { ProfileSection } from '../../components/settings/ProfileSection';
import { SecuritySection } from '../../components/settings/SecuritySection';
import { PageHeader } from '../../components/shared/PageHeader';
import { LoadingSpinner } from '../../components/ui/loading-screen';
import { useFormulas, useMe, usePractice } from '../../hooks/useMe';
import { useAuthStore } from '../../stores/authStore';

/**
 * Settings: each change is saved by itself (see components/settings/autosave.tsx). The
 * practice and the prices only concern practitioners.
 */
export default function SettingsPage() {
  const isPractitioner = useAuthStore((s) => s.user?.role === 'PRATICIENNE');
  const me = useMe();
  const practice = usePractice(isPractitioner);
  const formulas = useFormulas(isPractitioner);

  const queries = isPractitioner ? [me, practice, formulas] : [me];
  const failed = queries.some((q) => q.isError);
  const loading = queries.some((q) => q.isPending);

  return (
    <>
      <PageHeader
        area="settings"
        title="Paramètres"
        subtitle="Vos changements sont enregistrés automatiquement."
      />
      {failed ? (
        <p role="alert" className="text-base text-destructive">
          Les paramètres ne se sont pas affichés. Vérifiez votre connexion, puis rechargez la page.
        </p>
      ) : loading || !me.data ? (
        <LoadingSpinner />
      ) : (
        <div className="space-y-6">
          <ProfileSection me={me.data} />
          {isPractitioner && practice.data && <PracticeSection practice={practice.data} />}
          {isPractitioner && formulas.data && <FormulasSection formulas={formulas.data} />}
          <SecuritySection me={me.data} />
          <AppearanceSection />
        </div>
      )}
    </>
  );
}
