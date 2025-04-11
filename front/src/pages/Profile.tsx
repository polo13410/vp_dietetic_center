import Sidebar from "@/components/layout/Sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/components/ui/use-toast";
import { useState } from "react";

const Profile = () => {
  const [sidebarWidth, setSidebarWidth] = useState(256);
  const { toast } = useToast();

  // Mock user data - in a real app, this would come from auth context
  const [userData, setUserData] = useState({
    name: "Dr. Jane Smith",
    email: "jane.smith@nutritrack.com",
    role: "Nutritionist",
    avatar: "/placeholder.svg",
  });

  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({ ...userData });

  const handleSidebarWidthChange = (width: number) => {
    setSidebarWidth(width);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setUserData(formData);
    setIsEditing(false);
    toast({
      title: "Profile updated",
      description: "Your profile has been updated successfully.",
    });
  };

  return (
    <div className="min-h-screen ">
      <Sidebar onWidthChange={handleSidebarWidthChange} />
      <div
        className="transition-all duration-300 p-6 md:p-8"
        style={{ marginLeft: `${sidebarWidth}px` }}
      >
        <div className="max-w-4xl mx-auto pt-12 pb-16">
          <h1 className="text-2xl font-bold mb-6">My Profile</h1>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="md:col-span-1">
              <CardHeader className="pb-2">
                <CardTitle className="text-xl">Profile Picture</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col items-center">
                <div className="w-32 h-32 rounded-full overflow-hidden mb-4">
                  <img
                    src={userData.avatar}
                    alt="Profile"
                    className="w-full h-full object-cover"
                  />
                </div>
                <Button
                  variant="outline"
                  className="mt-2"
                  disabled={!isEditing}
                >
                  Change Picture
                </Button>
              </CardContent>
            </Card>

            <Card className="md:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-xl">Personal Information</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit}>
                  <div className="space-y-4">
                    <div>
                      <label
                        htmlFor="name"
                        className="text-sm font-medium mb-1 block"
                      >
                        Full Name
                      </label>
                      <Input
                        id="name"
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        readOnly={!isEditing}
                        className={!isEditing ? "" : ""}
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="email"
                        className="text-sm font-medium mb-1 block"
                      >
                        Email
                      </label>
                      <Input
                        id="email"
                        name="email"
                        type="email"
                        value={formData.email}
                        onChange={handleChange}
                        readOnly={!isEditing}
                        className={!isEditing ? "" : ""}
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="role"
                        className="text-sm font-medium mb-1 block"
                      >
                        Role
                      </label>
                      <Input
                        id="role"
                        name="role"
                        value={formData.role}
                        onChange={handleChange}
                        readOnly={!isEditing}
                        className={!isEditing ? "" : ""}
                      />
                    </div>

                    <div className="pt-4">
                      {isEditing ? (
                        <div className="flex space-x-2">
                          <Button type="submit">Save Changes</Button>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                              setIsEditing(false);
                              setFormData({ ...userData });
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <Button
                          type="button"
                          onClick={() => setIsEditing(true)}
                        >
                          Edit Profile
                        </Button>
                      )}
                    </div>
                  </div>
                </form>
              </CardContent>
            </Card>

            <Card className="md:col-span-3">
              <CardHeader className="pb-2">
                <CardTitle className="text-xl">Account Settings</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-medium">Password</h3>
                    <p className="text-muted-foreground text-sm">
                      Change your password or reset it if you've forgotten it.
                    </p>
                    <Button variant="outline" className="mt-2">
                      Change Password
                    </Button>
                  </div>

                  <Separator />

                  <div>
                    <h3 className="text-lg font-medium">Notifications</h3>
                    <p className="text-muted-foreground text-sm">
                      Manage how you receive notifications and alerts.
                    </p>
                    <Button variant="outline" className="mt-2">
                      Notification Settings
                    </Button>
                  </div>

                  <Separator />

                  <div>
                    <h3 className="text-lg text-destructive font-medium">
                      Danger Zone
                    </h3>
                    <p className="text-muted-foreground text-sm">
                      These actions are destructive and cannot be reversed.
                    </p>
                    <Button variant="destructive" className="mt-2">
                      Delete Account
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
