import type { CreateUserDto, UpdateUserDto, UserDto } from '@vp/types';
import { Pencil, Plus, Search, UserX, Users } from 'lucide-react';
import { useState } from 'react';

import { UserFormDialog } from '../../components/admin/UserFormDialog';
import { ConfirmDialog } from '../../components/shared/ConfirmDialog';
import { EmptyState } from '../../components/shared/EmptyState';
import { PageHeader } from '../../components/shared/PageHeader';
import { Section } from '../../components/shared/Section';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { LoadingSpinner } from '../../components/ui/loading-screen';
import { useCurrentUser, useIsRole } from '../../hooks/useAuth';
import { useCreateUser, useDeleteUser, useResetTwoFactor, useUpdateUser, useUsers } from '../../hooks/useUsers';

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Administratrice',
  PRATICIENNE: 'Praticienne',
  ASSISTANTE: 'Assistante',
};

function countLabel(count: number) {
  return `${count} compte${count > 1 ? 's' : ''}`;
}

export default function UsersPage() {
  const isAdmin = useIsRole('ADMIN');
  const { data: users, isLoading } = useUsers();
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const deleteUser = useDeleteUser();
  const resetTwoFactor = useResetTwoFactor();
  const me = useCurrentUser();

  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserDto | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserDto | null>(null);
  const [resetTarget, setResetTarget] = useState<UserDto | null>(null);

  if (!isAdmin) return null;

  const query = search.trim().toLowerCase();
  const filtered = users?.filter(
    (u) =>
      !query ||
      u.firstName.toLowerCase().includes(query) ||
      u.lastName.toLowerCase().includes(query) ||
      u.email.toLowerCase().includes(query),
  );

  const handleCreate = () => {
    setEditingUser(null);
    setFormOpen(true);
  };

  const handleEdit = (user: UserDto) => {
    setEditingUser(user);
    setFormOpen(true);
  };

  const handleFormSubmit = (data: CreateUserDto | UpdateUserDto) => {
    if (editingUser) {
      updateUser.mutate(
        { id: editingUser.id, dto: data as UpdateUserDto },
        { onSuccess: () => setFormOpen(false) },
      );
    } else {
      createUser.mutate(data as CreateUserDto, { onSuccess: () => setFormOpen(false) });
    }
  };

  const handleReset = () => {
    if (!resetTarget) return;
    resetTwoFactor.mutate(resetTarget.id, { onSuccess: () => setResetTarget(null) });
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteUser.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) });
  };

  return (
    <>
      <PageHeader
        area="users"
        title="Utilisateurs"
        subtitle="Les personnes qui peuvent se connecter à l’application."
        actions={
          <Button onClick={handleCreate}>
            <Plus /> Nouveau compte
          </Button>
        }
      />

      <Section
        icon={Users}
        area="users"
        title="Comptes"
        description={users ? countLabel(users.length) : undefined}
        flush
      >
        <div className="border-b border-border px-5 pb-5 sm:px-6">
          <label htmlFor="users-search" className="sr-only">
            Rechercher un compte
          </label>
          <div className="relative max-w-md">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              id="users-search"
              type="search"
              placeholder="Rechercher par nom ou e-mail"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {isLoading ? (
          <LoadingSpinner />
        ) : !filtered?.length ? (
          query ? (
            <EmptyState
              icon={UserX}
              area="users"
              title="Aucun compte ne correspond à cette recherche."
              description="Vérifiez l’orthographe du nom ou de l’adresse e-mail."
              action={
                <Button variant="outline" onClick={() => setSearch('')}>
                  Effacer la recherche
                </Button>
              }
            />
          ) : (
            <EmptyState
              illustration="pear"
              title="Aucun compte pour l’instant."
              action={
                <Button onClick={handleCreate}>
                  <Plus /> Nouveau compte
                </Button>
              }
            />
          )
        ) : (
          <ul className="divide-y divide-border">
            {filtered.map((user) => (
              <li
                key={user.id}
                className="flex flex-wrap items-center gap-x-6 gap-y-3 px-5 py-4 sm:px-6"
              >
                <div className="flex min-w-[14rem] flex-1 items-center gap-3">
                  <span
                    className="flex size-11 shrink-0 items-center justify-center rounded-full bg-area-users-soft text-base font-semibold text-area-users"
                    aria-hidden
                  >
                    {user.firstName[0]}
                    {user.lastName[0]}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-base font-medium">
                      {user.firstName} {user.lastName}
                    </p>
                    <p className="truncate text-sm text-muted-foreground">{user.email}</p>
                  </div>
                </div>

                <div className="flex w-52 items-center gap-3">
                  <span className="text-base text-foreground">
                    {ROLE_LABELS[user.role] ?? user.role}
                  </span>
                  {user.isActive ? (
                    <StatusBadge status="ACTIVE" label="Actif" tone="success" />
                  ) : (
                    <StatusBadge status="DISABLED" label="Désactivé" tone="danger" />
                  )}
                </div>

                <p className="w-44 text-sm text-muted-foreground">
                  {user.twoFactorEnabledAt ? 'Double authentification active' : 'Double authentification à configurer'}
                </p>

                <div className="ml-auto flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleEdit(user)}>
                    <Pencil /> Modifier
                  </Button>
                  {user.twoFactorEnabledAt && user.id !== me?.id && (
                    <Button variant="ghost" size="sm" onClick={() => setResetTarget(user)}>
                      Réinitialiser la double authentification
                    </Button>
                  )}
                  {user.isActive && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:bg-danger-soft hover:text-destructive"
                      onClick={() => setDeleteTarget(user)}
                    >
                      Désactiver
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <UserFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        user={editingUser}
        onSubmit={handleFormSubmit}
        isPending={createUser.isPending || updateUser.isPending}
      />

      <ConfirmDialog
        open={!!resetTarget}
        onOpenChange={(open) => !open && setResetTarget(null)}
        title={`Réinitialiser la double authentification de ${resetTarget?.firstName ?? ''} ${resetTarget?.lastName ?? ''} ?`}
        description="À faire si elle a perdu son téléphone. Elle est déconnectée partout et configurera une nouvelle application d’authentification à sa prochaine connexion. Vérifiez d’abord que c’est bien elle qui le demande."
        confirmLabel="Réinitialiser"
        variant="destructive"
        loading={resetTwoFactor.isPending}
        onConfirm={handleReset}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={`Désactiver le compte de ${deleteTarget?.firstName ?? ''} ${deleteTarget?.lastName ?? ''} ?`}
        description="Cette personne ne pourra plus se connecter. Ses données restent dans l’application."
        confirmLabel="Désactiver le compte"
        variant="destructive"
        loading={deleteUser.isPending}
        onConfirm={handleDelete}
      />
    </>
  );
}
