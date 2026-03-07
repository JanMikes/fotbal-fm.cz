'use client';

import { useUser } from '@/contexts/UserContext';
import Card from '@/components/ui/Card';
import ProfileForm from '@/components/forms/ProfileForm';
import ChangePasswordForm from '@/components/forms/ChangePasswordForm';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

export default function SettingsPage() {
  const { user, loading } = useUser();

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!user) {
    return null; // Middleware will redirect
  }

  return (
    <div className="bg-background py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-text-primary mb-2">Nastavení</h1>
          <p className="text-text-secondary">Spravujte svůj profil a zabezpečení</p>
        </div>

        <div className="space-y-6">
          {/* Profile Section */}
          <Card variant="elevated">
            <h2 className="text-2xl font-semibold text-text-primary mb-6">Profil</h2>

            {/* Email - read only */}
            <div className="mb-6 p-4 bg-surface-elevated border border-border rounded-lg">
              <label className="block text-sm font-medium text-text-primary mb-2">Email</label>
              <p className="text-text-primary font-medium">{user.email}</p>
              <p className="text-xs text-text-muted mt-1 flex items-center gap-1">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                Email nelze změnit
              </p>
            </div>

            <ProfileForm />
          </Card>

          {/* Change Password Section */}
          <Card variant="elevated">
            <h2 className="text-2xl font-semibold text-text-primary mb-6">Změna hesla</h2>
            <ChangePasswordForm />
          </Card>
        </div>
      </div>
    </div>
  );
}
