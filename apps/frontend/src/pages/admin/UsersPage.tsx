import type { UserDto } from '@vp/types';
import { ArrowLeft, MoreHorizontal, Pencil, Plus, Search, Trash2, UserX } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';

import { UserFormDialog } from '../../components/admin/UserFormDialog';
import { Button } from '../../components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu';
import { LoadingSpinner } from '../../components/ui/loading-screen';
import { useIsRole } from '../../hooks/useAuth';
import { useCreateUser, useDeleteUser, useUpdateUser, useUsers } from '../../hooks/useUsers';

// ─── Labels ──────────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Admin',
  PRATICIENNE: 'Praticienne',
  ASSISTANTE: 'Assistante',
};

const ROLE_COLORS: Record<string, string> = {
  ADMIN: 'bg-purple-500/15 text-purple-600 dark:text-purple-400',
  PRATICIENNE: 'bg-primary/10 text-primary',
  ASSISTANTE: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
};

// ─── Page ────────────────────────────────────────────────────────────────────

export default function UsersPage() {
  const isAdmin = useIsRole('ADMIN');
  const { data: users, isLoading } = useUsers();
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const deleteUser = useDeleteUser();

  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserDto | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserDto | null>(null);

  if (!isAdmin) return null;

  const filtered = users?.filter((u) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      u.firstName.toLowerCase().includes(q) ||
      u.lastName.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q)
    );
  });

  const handleCreate = () => {
    setEditingUser(null);
    setFormOpen(true);
  };

  const handleEdit = (user: UserDto) => {
    setEditingUser(user);
    setFormOpen(true);
  };

  const handleFormSubmit = (data: any) => {
    if (editingUser) {
      updateUser.mutate(
        { id: editingUser.id, dto: data },
        { onSuccess: () => setFormOpen(false) },
      );
    } else {
      createUser.mutate(data, { onSuccess: () => setFormOpen(false) });
    }
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteUser.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) });
  };

  return (
    <div className="space-y-5 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/admin">
              <ArrowLeft className="w-4 h-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-xl font-semibold text-foreground">Utilisateurs</h1>
            {users && (
              <p className="text-sm text-muted-foreground">
                {users.length} compte{users.length > 1 ? 's' : ''}
              </p>
            )}
          </div>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="w-4 h-4" /> Nouveau compte
        </Button>
      </div>

      {/* Search */}
      <div className="bg-card rounded-xl border border-border p-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="search"
            placeholder="Rechercher par nom ou email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        {isLoading ? (
          <LoadingSpinner />
        ) : !filtered?.length ? (
          <div className="text-center py-12">
            <UserX className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Aucun utilisateur trouvé</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">
                  Nom
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">
                  Email
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">
                  Rôle
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">
                  Statut
                </th>
                <th className="w-12" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((user) => (
                <tr key={user.id} className="hover:bg-muted/50 transition-colors">
                  <td className="px-4 py-3 font-medium">
                    {user.firstName} {user.lastName}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{user.email}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLORS[user.role] ?? ''}`}
                    >
                      {ROLE_LABELS[user.role] ?? user.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        user.isActive
                          ? 'bg-green-500/15 text-green-600 dark:text-green-400'
                          : 'bg-red-500/15 text-red-600 dark:text-red-400'
                      }`}
                    >
                      {user.isActive ? 'Actif' : 'Désactivé'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEdit(user)}>
                          <Pencil className="w-4 h-4 mr-2" />
                          Modifier
                        </DropdownMenuItem>
                        {user.isActive && (
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => setDeleteTarget(user)}
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Désactiver
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create / Edit dialog */}
      <UserFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        user={editingUser}
        onSubmit={handleFormSubmit}
        isPending={createUser.isPending || updateUser.isPending}
      />

      {/* Delete confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Désactiver le compte</DialogTitle>
            <DialogDescription>
              Êtes-vous sûr de vouloir désactiver le compte de{' '}
              <strong>
                {deleteTarget?.firstName} {deleteTarget?.lastName}
              </strong>{' '}
              ? Cette personne ne pourra plus se connecter.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Annuler
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteUser.isPending}>
              Désactiver
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
