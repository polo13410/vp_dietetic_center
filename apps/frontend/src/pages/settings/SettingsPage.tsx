import { Bell, ChevronDown, Info, Lock, Settings as SettingsIcon, User } from 'lucide-react';
import { useState } from 'react';

import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../../components/ui/collapsible';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import { Switch } from '../../components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Textarea } from '../../components/ui/textarea';
import { toast } from '../../components/ui/toaster';

export default function SettingsPage() {
  const [isEmailNotificationsEnabled, setIsEmailNotificationsEnabled] = useState(true);
  const [isAppNotificationsEnabled, setIsAppNotificationsEnabled] = useState(true);
  const [isWeekendRemindersOpen, setIsWeekendRemindersOpen] = useState(false);

  const handleSaveProfile = () => {
    toast({
      title: 'Profil mis à jour',
      description: 'Vos informations ont été mises à jour avec succès.',
    });
  };

  const handleSavePassword = () => {
    toast({
      title: 'Mot de passe mis à jour',
      description: 'Votre mot de passe a été changé avec succès.',
    });
  };

  const handleSaveNotifications = () => {
    toast({
      title: 'Préférences de notifications sauvegardées',
      description: 'Vos paramètres de notifications ont été mis à jour.',
    });
  };

  const handleSaveAppearance = () => {
    toast({
      title: 'Paramètres d\'apparence sauvegardés',
      description: 'Vos préférences d\'apparence ont été mises à jour.',
    });
  };

  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
        <SettingsIcon className="h-6 w-6" />
        Paramètres
      </h1>

      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="mb-6 grid grid-cols-4 w-full max-w-2xl">
          <TabsTrigger value="profile" className="flex items-center gap-2">
            <User className="h-4 w-4" /> Profil
          </TabsTrigger>
          <TabsTrigger value="security" className="flex items-center gap-2">
            <Lock className="h-4 w-4" /> Sécurité
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-2">
            <Bell className="h-4 w-4" /> Notifications
          </TabsTrigger>
          <TabsTrigger value="appearance" className="flex items-center gap-2">
            <Info className="h-4 w-4" /> Apparence
          </TabsTrigger>
        </TabsList>

        {/* Profile Settings */}
        <TabsContent value="profile" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Informations personnelles</CardTitle>
              <CardDescription>
                Mettez à jour vos informations personnelles et coordonnées.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nom complet</Label>
                  <Input id="name" defaultValue="Dr. Sarah Johnson" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="settings-email">Adresse email</Label>
                  <Input id="settings-email" type="email" defaultValue="sarah.johnson@vp-dietetic.com" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Téléphone</Label>
                  <Input id="phone" defaultValue="+33 1 23 45 67 89" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="specialization">Spécialisation</Label>
                  <Select defaultValue="nutrition">
                    <SelectTrigger id="specialization">
                      <SelectValue placeholder="Sélectionner une spécialisation" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nutrition">Nutrition</SelectItem>
                      <SelectItem value="dietetics">Diététique</SelectItem>
                      <SelectItem value="sports">Nutrition sportive</SelectItem>
                      <SelectItem value="pediatric">Nutrition pédiatrique</SelectItem>
                      <SelectItem value="clinical">Nutrition clinique</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bio">Bio professionnelle</Label>
                <Textarea
                  id="bio"
                  className="min-h-[120px]"
                  defaultValue="Nutritionniste certifiée avec plus de 10 ans d'expérience, spécialisée dans la gestion du poids et la prévention des maladies chroniques par l'alimentation."
                />
              </div>

              <Button onClick={handleSaveProfile}>Enregistrer les modifications</Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Settings */}
        <TabsContent value="security" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Mot de passe</CardTitle>
              <CardDescription>
                Changez votre mot de passe et vos préférences de sécurité.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="current-password">Mot de passe actuel</Label>
                <Input id="current-password" type="password" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="new-password">Nouveau mot de passe</Label>
                  <Input id="new-password" type="password" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirmer le mot de passe</Label>
                  <Input id="confirm-password" type="password" />
                </div>
              </div>
              <Button onClick={handleSavePassword}>Mettre à jour le mot de passe</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Authentification à deux facteurs</CardTitle>
              <CardDescription>
                Ajoutez une couche de sécurité supplémentaire à votre compte.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="font-medium">Authentification SMS</div>
                  <div className="text-sm text-muted-foreground">
                    Recevez un code de vérification par SMS.
                  </div>
                </div>
                <Switch defaultChecked />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="font-medium">Application d'authentification</div>
                  <div className="text-sm text-muted-foreground">
                    Utilisez une application d'authentification sur votre téléphone.
                  </div>
                </div>
                <Button variant="outline">Configurer</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notification Settings */}
        <TabsContent value="notifications" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Préférences de notifications</CardTitle>
              <CardDescription>Gérez la façon dont vous recevez les notifications.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="font-medium">Notifications par email</div>
                  <div className="text-sm text-muted-foreground">
                    Recevez des notifications par email.
                  </div>
                </div>
                <Switch
                  checked={isEmailNotificationsEnabled}
                  onCheckedChange={setIsEmailNotificationsEnabled}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="font-medium">Notifications in-app</div>
                  <div className="text-sm text-muted-foreground">
                    Recevez des notifications dans l'application.
                  </div>
                </div>
                <Switch
                  checked={isAppNotificationsEnabled}
                  onCheckedChange={setIsAppNotificationsEnabled}
                />
              </div>

              <Collapsible
                open={isWeekendRemindersOpen}
                onOpenChange={setIsWeekendRemindersOpen}
                className="space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="font-medium">Rappels week-end</div>
                    <div className="text-sm text-muted-foreground">
                      Configurez les notifications du week-end.
                    </div>
                  </div>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm">
                      <ChevronDown
                        className={`h-4 w-4 transition-transform ${
                          isWeekendRemindersOpen ? 'rotate-180' : ''
                        }`}
                      />
                    </Button>
                  </CollapsibleTrigger>
                </div>
                <CollapsibleContent className="space-y-2 pt-2">
                  <div className="pl-6 flex items-center justify-between">
                    <div className="space-y-0.5">
                      <div className="font-medium">Rappels du samedi</div>
                      <div className="text-sm text-muted-foreground">
                        Recevez des rappels de rendez-vous le samedi.
                      </div>
                    </div>
                    <Switch defaultChecked />
                  </div>
                  <div className="pl-6 flex items-center justify-between">
                    <div className="space-y-0.5">
                      <div className="font-medium">Rappels du dimanche</div>
                      <div className="text-sm text-muted-foreground">
                        Recevez des rappels de rendez-vous le dimanche.
                      </div>
                    </div>
                    <Switch />
                  </div>
                </CollapsibleContent>
              </Collapsible>

              <div className="flex items-center justify-between pt-2">
                <div className="space-y-0.5">
                  <div className="font-medium">Résumé quotidien</div>
                  <div className="text-sm text-muted-foreground">
                    Recevez un résumé de vos activités quotidiennes.
                  </div>
                </div>
                <Select defaultValue="evening">
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Fréquence" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="morning">Matin</SelectItem>
                    <SelectItem value="afternoon">Après-midi</SelectItem>
                    <SelectItem value="evening">Soir</SelectItem>
                    <SelectItem value="never">Jamais</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button onClick={handleSaveNotifications}>Enregistrer les préférences</Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Appearance Settings */}
        <TabsContent value="appearance" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Apparence de l'application</CardTitle>
              <CardDescription>Personnalisez l'apparence de l'application.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Thème</Label>
                <div className="grid grid-cols-3 gap-2">
                  <div className="flex flex-col items-center gap-1">
                    <Button variant="outline" className="h-20 w-full border-primary" aria-label="Thème clair" />
                    <span className="text-sm">Clair</span>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <Button variant="outline" className="h-20 w-full bg-slate-800" aria-label="Thème sombre" />
                    <span className="text-sm">Sombre</span>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <Button
                      variant="outline"
                      className="h-20 w-full bg-gradient-to-r from-white to-gray-900"
                      aria-label="Thème système"
                    />
                    <span className="text-sm">Système</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="font-size">Taille de police</Label>
                <Select defaultValue="medium">
                  <SelectTrigger id="font-size">
                    <SelectValue placeholder="Sélectionner la taille" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="small">Petite</SelectItem>
                    <SelectItem value="medium">Moyenne</SelectItem>
                    <SelectItem value="large">Grande</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="language">Langue</Label>
                <Select defaultValue="fr">
                  <SelectTrigger id="language">
                    <SelectValue placeholder="Sélectionner la langue" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fr">Français</SelectItem>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="es">Español</SelectItem>
                    <SelectItem value="de">Deutsch</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="font-medium">Mode compact</div>
                  <div className="text-sm text-muted-foreground">
                    Utiliser une mise en page plus compacte.
                  </div>
                </div>
                <Switch />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="font-medium">Animations</div>
                  <div className="text-sm text-muted-foreground">
                    Activer ou désactiver les animations.
                  </div>
                </div>
                <Switch defaultChecked />
              </div>

              <Button onClick={handleSaveAppearance}>Enregistrer les préférences</Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
