import { useState } from 'react';

import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Separator } from '../../components/ui/separator';
import { toast } from '../../components/ui/toaster';
import { useCurrentUser } from '../../hooks/useAuth';

export default function ProfilePage() {
  const user = useCurrentUser();

  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: user ? `${user.firstName} ${user.lastName}` : '',
    email: user?.email ?? '',
    role: user?.role ?? '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsEditing(false);
    toast({
      title: 'Profil mis à jour',
      description: 'Vos informations ont été mises à jour avec succès.',
    });
  };

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Mon profil</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Photo de profil</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center">
            <div className="w-32 h-32 rounded-full bg-primary/15 flex items-center justify-center mb-4">
              <span className="text-3xl font-bold text-primary">
                {user?.firstName?.[0]}
                {user?.lastName?.[0]}
              </span>
            </div>
            <Button variant="outline" className="mt-2" disabled={!isEditing}>
              Changer la photo
            </Button>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Informations personnelles</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                <div>
                  <label htmlFor="name" className="text-sm font-medium mb-1 block">
                    Nom complet
                  </label>
                  <Input
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    readOnly={!isEditing}
                  />
                </div>

                <div>
                  <label htmlFor="email" className="text-sm font-medium mb-1 block">
                    Email
                  </label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleChange}
                    readOnly={!isEditing}
                  />
                </div>

                <div>
                  <label htmlFor="role" className="text-sm font-medium mb-1 block">
                    Rôle
                  </label>
                  <Input
                    id="role"
                    name="role"
                    value={formData.role}
                    onChange={handleChange}
                    readOnly={!isEditing}
                  />
                </div>

                <div className="pt-4">
                  {isEditing ? (
                    <div className="flex space-x-2">
                      <Button type="submit">Enregistrer</Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setIsEditing(false);
                          setFormData({
                            name: user ? `${user.firstName} ${user.lastName}` : '',
                            email: user?.email ?? '',
                            role: user?.role ?? '',
                          });
                        }}
                      >
                        Annuler
                      </Button>
                    </div>
                  ) : (
                    <Button type="button" onClick={() => setIsEditing(true)}>
                      Modifier le profil
                    </Button>
                  )}
                </div>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="md:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Paramètres du compte</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h3 className="text-base font-medium">Mot de passe</h3>
                <p className="text-muted-foreground text-sm">
                  Changez votre mot de passe ou réinitialisez-le.
                </p>
                <Button variant="outline" className="mt-2">
                  Changer le mot de passe
                </Button>
              </div>

              <Separator />

              <div>
                <h3 className="text-base font-medium">Notifications</h3>
                <p className="text-muted-foreground text-sm">
                  Gérez vos préférences de notifications.
                </p>
                <Button variant="outline" className="mt-2">
                  Paramètres de notifications
                </Button>
              </div>

              <Separator />

              <div>
                <h3 className="text-base text-destructive font-medium">Zone de danger</h3>
                <p className="text-muted-foreground text-sm">
                  Ces actions sont irréversibles.
                </p>
                <Button variant="destructive" className="mt-2">
                  Supprimer le compte
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
