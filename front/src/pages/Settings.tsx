import Sidebar from "@/components/layout/Sidebar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  Bell,
  ChevronDown,
  Info,
  Lock,
  Settings as SettingsIcon,
  User,
} from "lucide-react";
import { useState } from "react";

const Settings = () => {
  const [sidebarWidth, setSidebarWidth] = useState(256);
  const { toast } = useToast();
  const [isEmailNotificationsEnabled, setIsEmailNotificationsEnabled] =
    useState(true);
  const [isAppNotificationsEnabled, setIsAppNotificationsEnabled] =
    useState(true);
  const [isWeekendRemindersOpen, setIsWeekendRemindersOpen] = useState(false);

  const handleSidebarWidthChange = (width: number) => {
    setSidebarWidth(width);
  };

  const handleSaveProfile = () => {
    toast({
      title: "Profile updated",
      description: "Your profile information has been updated successfully.",
    });
  };

  const handleSavePassword = () => {
    toast({
      title: "Password updated",
      description: "Your password has been changed successfully.",
    });
  };

  const handleSaveNotifications = () => {
    toast({
      title: "Notification preferences saved",
      description: "Your notification settings have been updated.",
    });
  };

  const handleSaveAppearance = () => {
    toast({
      title: "Appearance settings saved",
      description: "Your appearance preferences have been updated.",
    });
  };

  return (
    <div className="min-h-screen ">
      <Sidebar onWidthChange={handleSidebarWidthChange} />
      <div
        className="transition-all duration-300 p-6 md:p-8"
        style={{ marginLeft: `${sidebarWidth}px` }}
      >
        <div className="max-w-5xl mx-auto pt-6 pb-16">
          <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <SettingsIcon className="h-6 w-6" />
            Settings
          </h1>

          <Tabs defaultValue="profile" className="w-full">
            <TabsList className="mb-6 grid grid-cols-4 w-full max-w-2xl">
              <TabsTrigger value="profile" className="flex items-center gap-2">
                <User className="h-4 w-4" /> Profile
              </TabsTrigger>
              <TabsTrigger value="security" className="flex items-center gap-2">
                <Lock className="h-4 w-4" /> Security
              </TabsTrigger>
              <TabsTrigger
                value="notifications"
                className="flex items-center gap-2"
              >
                <Bell className="h-4 w-4" /> Notifications
              </TabsTrigger>
              <TabsTrigger
                value="appearance"
                className="flex items-center gap-2"
              >
                <Info className="h-4 w-4" /> Appearance
              </TabsTrigger>
            </TabsList>

            {/* Profile Settings */}
            <TabsContent value="profile" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Personal Information</CardTitle>
                  <CardDescription>
                    Update your personal information and contact details.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Full Name</Label>
                      <Input id="name" defaultValue="Dr. Sarah Johnson" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email Address</Label>
                      <Input
                        id="email"
                        type="email"
                        defaultValue="sarah.johnson@nutritrack.com"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone Number</Label>
                      <Input id="phone" defaultValue="+1 (555) 123-4567" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="specialization">Specialization</Label>
                      <Select defaultValue="nutrition">
                        <SelectTrigger id="specialization">
                          <SelectValue placeholder="Select specialization" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="nutrition">Nutrition</SelectItem>
                          <SelectItem value="dietetics">Dietetics</SelectItem>
                          <SelectItem value="sports">
                            Sports Nutrition
                          </SelectItem>
                          <SelectItem value="pediatric">
                            Pediatric Nutrition
                          </SelectItem>
                          <SelectItem value="clinical">
                            Clinical Nutrition
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="bio">Professional Bio</Label>
                    <Textarea
                      id="bio"
                      className="min-h-[120px]"
                      defaultValue="Certified nutritionist with over 10 years of experience specializing in weight management and chronic disease prevention through dietary intervention."
                    />
                  </div>

                  <Button onClick={handleSaveProfile}>Save Changes</Button>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Security Settings */}
            <TabsContent value="security" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Password Settings</CardTitle>
                  <CardDescription>
                    Change your password and security preferences.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="current-password">Current Password</Label>
                    <Input id="current-password" type="password" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="new-password">New Password</Label>
                      <Input id="new-password" type="password" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirm-password">
                        Confirm New Password
                      </Label>
                      <Input id="confirm-password" type="password" />
                    </div>
                  </div>

                  <Button onClick={handleSavePassword}>Update Password</Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Two-Factor Authentication</CardTitle>
                  <CardDescription>
                    Add an extra layer of security to your account.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <div className="font-medium">SMS Authentication</div>
                      <div className="text-sm text-muted-foreground">
                        Receive a verification code via SMS.
                      </div>
                    </div>
                    <Switch defaultChecked />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <div className="font-medium">Authenticator App</div>
                      <div className="text-sm text-muted-foreground">
                        Use an authenticator app on your phone.
                      </div>
                    </div>
                    <Button variant="outline">Set Up</Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Notification Settings */}
            <TabsContent value="notifications" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Notification Preferences</CardTitle>
                  <CardDescription>
                    Manage how you receive notifications.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <div className="font-medium">Email Notifications</div>
                      <div className="text-sm text-muted-foreground">
                        Receive notifications via email.
                      </div>
                    </div>
                    <Switch
                      checked={isEmailNotificationsEnabled}
                      onCheckedChange={setIsEmailNotificationsEnabled}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <div className="font-medium">In-App Notifications</div>
                      <div className="text-sm text-muted-foreground">
                        Receive notifications inside the application.
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
                        <div className="font-medium">Weekend Reminders</div>
                        <div className="text-sm text-muted-foreground">
                          Configure weekend notification settings.
                        </div>
                      </div>
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <ChevronDown
                            className={`h-4 w-4 transition-transform ${
                              isWeekendRemindersOpen
                                ? "transform rotate-180"
                                : ""
                            }`}
                          />
                        </Button>
                      </CollapsibleTrigger>
                    </div>
                    <CollapsibleContent className="space-y-2 pt-2">
                      <div className="pl-6 flex items-center justify-between">
                        <div className="space-y-0.5">
                          <div className="font-medium">Saturday Reminders</div>
                          <div className="text-sm text-muted-foreground">
                            Receive appointment reminders on Saturdays.
                          </div>
                        </div>
                        <Switch defaultChecked />
                      </div>
                      <div className="pl-6 flex items-center justify-between">
                        <div className="space-y-0.5">
                          <div className="font-medium">Sunday Reminders</div>
                          <div className="text-sm text-muted-foreground">
                            Receive appointment reminders on Sundays.
                          </div>
                        </div>
                        <Switch />
                      </div>
                    </CollapsibleContent>
                  </Collapsible>

                  <div className="flex items-center justify-between pt-2">
                    <div className="space-y-0.5">
                      <div className="font-medium">Daily Digest</div>
                      <div className="text-sm text-muted-foreground">
                        Receive a summary of your daily activities.
                      </div>
                    </div>
                    <Select defaultValue="evening">
                      <SelectTrigger className="w-32">
                        <SelectValue placeholder="Frequency" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="morning">Morning</SelectItem>
                        <SelectItem value="afternoon">Afternoon</SelectItem>
                        <SelectItem value="evening">Evening</SelectItem>
                        <SelectItem value="never">Never</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Button onClick={handleSaveNotifications}>
                    Save Preferences
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Appearance Settings */}
            <TabsContent value="appearance" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Application Appearance</CardTitle>
                  <CardDescription>
                    Customize how the application looks.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Theme</Label>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="flex flex-col items-center gap-1">
                        <Button
                          variant="outline"
                          className="h-20 w-full  border-primary"
                          aria-label="Light theme"
                        />
                        <span className="text-sm">Light</span>
                      </div>
                      <div className="flex flex-col items-center gap-1">
                        <Button
                          variant="outline"
                          className="h-20 w-full"
                          aria-label="Dark theme"
                        />
                        <span className="text-sm">Dark</span>
                      </div>
                      <div className="flex flex-col items-center gap-1">
                        <Button
                          variant="outline"
                          className="h-20 w-full bg-gradient-to-r from-white to-gray-900"
                          aria-label="System theme"
                        />
                        <span className="text-sm">System</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="font-size">Font Size</Label>
                    <Select defaultValue="medium">
                      <SelectTrigger id="font-size">
                        <SelectValue placeholder="Select font size" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="small">Small</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="large">Large</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="language">Language</Label>
                    <Select defaultValue="en">
                      <SelectTrigger id="language">
                        <SelectValue placeholder="Select language" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="en">English</SelectItem>
                        <SelectItem value="es">Spanish</SelectItem>
                        <SelectItem value="fr">French</SelectItem>
                        <SelectItem value="de">German</SelectItem>
                        <SelectItem value="pt">Portuguese</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <div className="font-medium">Compact Mode</div>
                      <div className="text-sm text-muted-foreground">
                        Use a more compact layout for dense information.
                      </div>
                    </div>
                    <Switch />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <div className="font-medium">Animations</div>
                      <div className="text-sm text-muted-foreground">
                        Enable or disable UI animations.
                      </div>
                    </div>
                    <Switch defaultChecked />
                  </div>

                  <Button onClick={handleSaveAppearance}>
                    Save Preferences
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default Settings;
