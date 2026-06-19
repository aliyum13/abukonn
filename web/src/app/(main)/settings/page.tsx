'use client';

import { useEffect, useState, useRef, FormEvent, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';
import {
  Avatar,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Select,
  Toggle,
  ThemeToggleRow,
} from '@/components/ui';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

const DEPARTMENTS = [
  'Computer Science', 'Software Engineering', 'Information Technology',
  'Electrical Engineering', 'Civil Engineering', 'Mechanical Engineering',
  'Medicine & Surgery', 'Law', 'Economics', 'Accounting',
  'Mass Communication', 'Political Science', 'Sociology',
  'Mathematics', 'Physics', 'Chemistry', 'Biochemistry',
  'Microbiology', 'Pharmacy', 'Nursing Science',
];

const LEVELS = ['100 Level', '200 Level', '300 Level', '400 Level', '500 Level', 'Spill Over', 'Postgraduate'];

const SECTIONS = [
  { id: 'account', label: 'Account' },
  { id: 'security', label: 'Security' },
  { id: 'privacy', label: 'Privacy' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'appearance', label: 'Appearance' },
  { id: 'danger', label: 'Danger zone' },
] as const;

type SectionId = (typeof SECTIONS)[number]['id'];

interface UserSettings {
  default_post_audience: string;
  story_audience: string;
  who_can_message: string;
  who_can_connect: string;
  show_matric: string;
  notif_likes: boolean;
  notif_comments: boolean;
  notif_follows: boolean;
  notif_connect_requests: boolean;
  notif_messages: boolean;
}

function Toast({ message, isError, onClose }: { message: string; isError: boolean; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3500);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <div className={cn(
      'fixed bottom-20 left-1/2 z-[100] -translate-x-1/2 rounded-xl border px-4 py-3 text-[14px] shadow-lg sm:bottom-6',
      isError
        ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/90 dark:text-red-300'
        : 'border-brand-200 bg-brand-50 text-brand-800 dark:border-brand-800 dark:bg-brand-950/90 dark:text-brand-300'
    )}>
      {message}
    </div>
  );
}

function SettingsCard({ id, title, children }: { id: SectionId; title: string; children: React.ReactNode }) {
  return (
    <Card id={id} className="scroll-mt-24">
      <CardHeader className="border-b border-border px-5 py-4 dark:border-[#222]">
        <CardTitle className="text-[16px] font-semibold text-ink">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-5 space-y-5">{children}</CardContent>
    </Card>
  );
}

function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(opt => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            'rounded-full px-3.5 py-1.5 text-[13px] font-medium transition',
            value === opt.value
              ? 'bg-brand-600 text-white shadow-sm'
              : 'border border-border bg-surface text-ink-secondary hover:border-brand-300 hover:text-brand-700 dark:border-[#333] dark:hover:border-brand-700'
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function SettingToggleRow({
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-1">
      <div>
        <p className="text-[14px] font-medium text-ink">{label}</p>
        {description && <p className="text-[13px] text-ink-muted">{description}</p>}
      </div>
      <Toggle checked={checked} onChange={onChange} disabled={disabled} label={label} />
    </div>
  );
}

export default function SettingsPage() {
  const { user, token, loading: authLoading, updateUser, logout } = useAuth();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<SectionId>('account');
  const [toast, setToast] = useState<{ message: string; isError: boolean } | null>(null);

  const [accountForm, setAccountForm] = useState({
    full_name: '', username: '', bio: '', department: '', level: '', email: '',
  });
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [savingAccount, setSavingAccount] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const [showEmailForm, setShowEmailForm] = useState(false);
  const [emailForm, setEmailForm] = useState({ email: '', password: '' });
  const [savingEmail, setSavingEmail] = useState(false);

  const [passwordForm, setPasswordForm] = useState({
    current_password: '', new_password: '', confirm_password: '',
  });
  const [savingPassword, setSavingPassword] = useState(false);

  const [savingSetting, setSavingSetting] = useState(false);

  const [showDeactivateModal, setShowDeactivateModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [dangerLoading, setDangerLoading] = useState(false);

  const showToast = useCallback((message: string, isError = false) => {
    setToast({ message, isError });
  }, []);

  const loadSettings = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/settings`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to load settings');
      const data = await res.json();
      const u = data.user;
      setAccountForm({
        full_name: u.full_name || '',
        username: u.username || '',
        bio: u.bio || '',
        department: u.department || '',
        level: u.level || '',
        email: u.email || '',
      });
      setSettings(data.settings);
    } catch {
      showToast('Failed to load settings', true);
    } finally {
      setLoading(false);
    }
  }, [token, showToast]);

  useEffect(() => {
    if (!authLoading && !token) router.push('/login');
  }, [authLoading, token, router]);

  useEffect(() => {
    if (token) loadSettings();
  }, [token, loadSettings]);

  // Hash navigation
  useEffect(() => {
    const hash = window.location.hash.replace('#', '') as SectionId;
    if (hash && SECTIONS.some(s => s.id === hash)) {
      setActiveSection(hash);
      setTimeout(() => {
        document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }, [loading]);

  const scrollToSection = (id: SectionId) => {
    setActiveSection(id);
    window.history.replaceState(null, '', `#${id}`);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const patchSettings = async (fields: Partial<UserSettings>) => {
    if (!token) return false;
    setSavingSetting(true);
    const prev = settings;
    setSettings(s => s ? { ...s, ...fields } : s);
    try {
      const res = await fetch(`${API_URL}/api/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(fields),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setSettings(data.settings);
      return true;
    } catch (err) {
      setSettings(prev);
      showToast(err instanceof Error ? err.message : 'Failed to save', true);
      return false;
    } finally {
      setSavingSetting(false);
    }
  };

  const handleAccountSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSavingAccount(true);
    try {
      const res = await fetch(`${API_URL}/api/settings/profile`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          full_name: accountForm.full_name.trim(),
          username: accountForm.username.trim(),
          bio: accountForm.bio,
          department: accountForm.department,
          level: accountForm.level,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      updateUser(data.user);
      showToast('Profile saved successfully');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save profile', true);
    } finally {
      setSavingAccount(false);
    }
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !token) return;
    if (file.size > 5 * 1024 * 1024) {
      showToast('Photo must be under 5MB', true);
      return;
    }
    setUploadingPhoto(true);
    try {
      const fd = new FormData();
      fd.append('photo', file);
      const res = await fetch(`${API_URL}/api/settings/photo`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      updateUser(data.user);
      showToast('Profile photo updated');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Upload failed', true);
    } finally {
      setUploadingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleEmailSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSavingEmail(true);
    try {
      const res = await fetch(`${API_URL}/api/settings/email`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(emailForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      updateUser(data.user);
      setAccountForm(f => ({ ...f, email: data.user.email }));
      setShowEmailForm(false);
      setEmailForm({ email: '', password: '' });
      showToast('Email updated successfully');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update email', true);
    } finally {
      setSavingEmail(false);
    }
  };

  const handlePasswordSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSavingPassword(true);
    try {
      const res = await fetch(`${API_URL}/api/settings/password`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(passwordForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setPasswordForm({ current_password: '', new_password: '', confirm_password: '' });
      showToast('Password updated successfully');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update password', true);
    } finally {
      setSavingPassword(false);
    }
  };

  const handleDeactivate = async () => {
    if (!token) return;
    setDangerLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/settings/deactivate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setShowDeactivateModal(false);
      logout();
      router.push('/login');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to deactivate', true);
    } finally {
      setDangerLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!token || deleteConfirm !== 'DELETE') return;
    setDangerLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/settings/account`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ confirmation: deleteConfirm }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      logout();
      router.push('/');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete account', true);
    } finally {
      setDangerLoading(false);
    }
  };

  if (authLoading || !user) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-surface-muted" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:py-8">
      {toast && (
        <Toast message={toast.message} isError={toast.isError} onClose={() => setToast(null)} />
      )}

      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <Link
          href="/profile"
          className="flex h-9 w-9 items-center justify-center rounded-full text-ink-muted transition hover:bg-surface-muted hover:text-ink"
          aria-label="Back to profile"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-ink">Settings</h1>
          <p className="text-[13px] text-ink-muted">Manage your account and preferences</p>
        </div>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row lg:gap-8">
        {/* Sidebar — desktop */}
        <nav className="hidden lg:block lg:w-48 shrink-0">
          <ul className="sticky top-20 space-y-1">
            {SECTIONS.map(s => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => scrollToSection(s.id)}
                  className={cn(
                    'w-full rounded-lg px-3 py-2 text-left text-[14px] font-medium transition',
                    activeSection === s.id
                      ? 'bg-brand-50 text-brand-700 dark:bg-brand-950/40 dark:text-brand-400'
                      : 'text-ink-secondary hover:bg-surface-muted hover:text-ink'
                  )}
                >
                  {s.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        {/* Mobile section pills */}
        <div className="flex gap-2 overflow-x-auto scrollbar-hide lg:hidden pb-1">
          {SECTIONS.map(s => (
            <button
              key={s.id}
              type="button"
              onClick={() => scrollToSection(s.id)}
              className={cn(
                'shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-medium transition',
                activeSection === s.id
                  ? 'bg-brand-600 text-white'
                  : 'border border-border bg-surface text-ink-secondary dark:border-[#333]'
              )}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Main content */}
        <div className="min-w-0 flex-1 space-y-6">
          {/* ACCOUNT */}
          <SettingsCard id="account" title="Account">
            <form onSubmit={handleAccountSave} className="space-y-5">
              {/* Photo */}
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingPhoto}
                  className="group relative shrink-0"
                  title="Change photo"
                >
                  <div className="h-20 w-20 rounded-full bg-gradient-to-tr from-brand-500 to-emerald-400 p-[2px]">
                    <div className="h-full w-full rounded-full bg-white p-[2px] dark:bg-[#0a0a0a]">
                      <Avatar src={user.profile_photo_url} name={user.full_name} size="xl" className="h-full w-full" />
                    </div>
                  </div>
                  <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 transition group-hover:opacity-100">
                    {uploadingPhoto ? (
                      <svg className="h-5 w-5 animate-spin text-white" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    ) : (
                      <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 18.63a4 4 0 010-5.656l8.486-8.486a4 4 0 015.656 5.656l-8.486 8.486a4 4 0 01-5.656 0z" />
                      </svg>
                    )}
                  </span>
                </button>
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" />
                <div>
                  <p className="text-[14px] font-medium text-ink">Profile photo</p>
                  <p className="text-[13px] text-ink-muted">Click to upload · JPG or PNG, max 5MB</p>
                </div>
              </div>

              <Input
                label="Full name"
                value={accountForm.full_name}
                onChange={e => setAccountForm(f => ({ ...f, full_name: e.target.value }))}
                required
              />

              <div>
                <label className="mb-1.5 block text-label text-ink-secondary">Username</label>
                <div className="flex items-center rounded-xl border border-border bg-surface dark:border-[#333] dark:bg-[#1a1a1a] focus-within:ring-2 focus-within:ring-brand-500/20 focus-within:border-brand-500">
                  <span className="pl-3.5 text-[14px] text-ink-muted">@</span>
                  <input
                    value={accountForm.username}
                    onChange={e => setAccountForm(f => ({ ...f, username: e.target.value.replace(/[^a-zA-Z0-9_]/g, '') }))}
                    maxLength={30}
                    className="h-10 flex-1 bg-transparent px-2 text-[14px] text-ink outline-none"
                    placeholder="username"
                  />
                </div>
                <p className="mt-1.5 text-caption text-ink-muted">Letters, numbers, underscores · max 30 chars</p>
              </div>

              <div>
                <label className="mb-1.5 block text-label text-ink-secondary">Bio</label>
                <textarea
                  value={accountForm.bio}
                  onChange={e => setAccountForm(f => ({ ...f, bio: e.target.value }))}
                  rows={3}
                  maxLength={200}
                  placeholder="Tell others about yourself..."
                  className="w-full resize-none rounded-xl border border-border bg-surface px-3.5 py-2.5 text-[14px] text-ink placeholder:text-ink-muted focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-[#333] dark:bg-[#1a1a1a]"
                />
              </div>

              <Select label="Department" value={accountForm.department} onChange={e => setAccountForm(f => ({ ...f, department: e.target.value }))}>
                {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
              </Select>

              <Select label="Level" value={accountForm.level} onChange={e => setAccountForm(f => ({ ...f, level: e.target.value }))}>
                {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
              </Select>

              {/* Email */}
              <div>
                <label className="mb-1.5 block text-label text-ink-secondary">Email</label>
                {!showEmailForm ? (
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-[14px] text-ink">{accountForm.email}</span>
                    <button
                      type="button"
                      onClick={() => { setShowEmailForm(true); setEmailForm({ email: accountForm.email, password: '' }); }}
                      className="text-[13px] font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400"
                    >
                      Change email
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3 rounded-xl border border-border p-4 dark:border-[#333]">
                    <Input label="New email" type="email" value={emailForm.email} onChange={e => setEmailForm(f => ({ ...f, email: e.target.value }))} required />
                    <Input label="Confirm with password" type="password" value={emailForm.password} onChange={e => setEmailForm(f => ({ ...f, password: e.target.value }))} required />
                    <div className="flex gap-2">
                      <Button type="button" size="sm" loading={savingEmail} onClick={(e) => { e.preventDefault(); void handleEmailSave(e); }}>Save email</Button>
                      <Button type="button" variant="outline" size="sm" onClick={() => setShowEmailForm(false)}>Cancel</Button>
                    </div>
                  </div>
                )}
              </div>

              <Button type="submit" loading={savingAccount} className="rounded-full px-8">
                Save changes
              </Button>
            </form>
          </SettingsCard>

          {/* SECURITY */}
          <SettingsCard id="security" title="Security">
            <form onSubmit={handlePasswordSave} className="space-y-4 max-w-md">
              <Input label="Current password" type="password" autoComplete="current-password"
                value={passwordForm.current_password}
                onChange={e => setPasswordForm(f => ({ ...f, current_password: e.target.value }))}
                required
              />
              <Input label="New password" type="password" autoComplete="new-password"
                value={passwordForm.new_password}
                onChange={e => setPasswordForm(f => ({ ...f, new_password: e.target.value }))}
                hint="At least 6 characters"
                required
              />
              <Input label="Confirm new password" type="password" autoComplete="new-password"
                value={passwordForm.confirm_password}
                onChange={e => setPasswordForm(f => ({ ...f, confirm_password: e.target.value }))}
                required
              />
              <Button type="submit" loading={savingPassword} className="rounded-full px-8">
                Update password
              </Button>
            </form>
          </SettingsCard>

          {/* PRIVACY */}
          {settings && (
            <SettingsCard id="privacy" title="Privacy">
              <div className="space-y-6">
                <div>
                  <p className="mb-2 text-[14px] font-medium text-ink">Default post audience</p>
                  <SegmentedControl
                    value={settings.default_post_audience as 'public' | 'connections' | 'followers'}
                    options={[
                      { value: 'public', label: 'Public' },
                      { value: 'connections', label: 'Connections only' },
                      { value: 'followers', label: 'Followers only' },
                    ]}
                    onChange={v => patchSettings({ default_post_audience: v }).then(ok => ok && showToast('Privacy updated'))}
                  />
                </div>

                <div>
                  <p className="mb-2 text-[14px] font-medium text-ink">Story audience</p>
                  <SegmentedControl
                    value={settings.story_audience as 'public' | 'followers' | 'connections' | 'close_friends'}
                    options={[
                      { value: 'public', label: 'Public' },
                      { value: 'followers', label: 'Followers' },
                      { value: 'connections', label: 'Connections' },
                      { value: 'close_friends', label: 'Close friends' },
                    ]}
                    onChange={v => patchSettings({ story_audience: v }).then(ok => ok && showToast('Privacy updated'))}
                  />
                </div>

                <div>
                  <p className="mb-2 text-[14px] font-medium text-ink">Who can message you</p>
                  <SegmentedControl
                    value={settings.who_can_message as 'everyone' | 'connections' | 'nobody'}
                    options={[
                      { value: 'everyone', label: 'Everyone' },
                      { value: 'connections', label: 'Connections only' },
                      { value: 'nobody', label: 'Nobody' },
                    ]}
                    onChange={v => patchSettings({ who_can_message: v }).then(ok => ok && showToast('Privacy updated'))}
                  />
                </div>

                <div>
                  <p className="mb-2 text-[14px] font-medium text-ink">Who can send connect requests</p>
                  <SegmentedControl
                    value={settings.who_can_connect as 'everyone' | 'nobody'}
                    options={[
                      { value: 'everyone', label: 'Everyone' },
                      { value: 'nobody', label: 'Nobody' },
                    ]}
                    onChange={v => patchSettings({ who_can_connect: v }).then(ok => ok && showToast('Privacy updated'))}
                  />
                </div>

                <div>
                  <p className="mb-2 text-[14px] font-medium text-ink">Show matric number to</p>
                  <SegmentedControl
                    value={settings.show_matric as 'only_me' | 'connections' | 'everyone'}
                    options={[
                      { value: 'only_me', label: 'Only me' },
                      { value: 'connections', label: 'Connections' },
                      { value: 'everyone', label: 'Everyone' },
                    ]}
                    onChange={v => patchSettings({ show_matric: v }).then(ok => ok && showToast('Privacy updated'))}
                  />
                </div>
              </div>
              {savingSetting && <p className="text-[13px] text-ink-muted">Saving…</p>}
            </SettingsCard>
          )}

          {/* NOTIFICATIONS */}
          {settings && (
            <SettingsCard id="notifications" title="Notifications">
              <div className="divide-y divide-border dark:divide-[#222]">
                <SettingToggleRow label="Likes" description="When someone likes your post"
                  checked={settings.notif_likes}
                  onChange={v => patchSettings({ notif_likes: v })}
                  disabled={savingSetting}
                />
                <SettingToggleRow label="Comments" description="When someone comments on your post"
                  checked={settings.notif_comments}
                  onChange={v => patchSettings({ notif_comments: v })}
                  disabled={savingSetting}
                />
                <SettingToggleRow label="Follows" description="When someone follows you"
                  checked={settings.notif_follows}
                  onChange={v => patchSettings({ notif_follows: v })}
                  disabled={savingSetting}
                />
                <SettingToggleRow label="Connect requests" description="When someone sends a connect request"
                  checked={settings.notif_connect_requests}
                  onChange={v => patchSettings({ notif_connect_requests: v })}
                  disabled={savingSetting}
                />
                <SettingToggleRow label="Messages" description="When you receive a new message"
                  checked={settings.notif_messages}
                  onChange={v => patchSettings({ notif_messages: v })}
                  disabled={savingSetting}
                />
              </div>
            </SettingsCard>
          )}

          {/* APPEARANCE */}
          <SettingsCard id="appearance" title="Appearance">
            <ThemeToggleRow />
          </SettingsCard>

          {/* DANGER ZONE */}
          <SettingsCard id="danger" title="Danger zone">
            <div className="space-y-4">
              <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 dark:border-amber-900 dark:bg-amber-950/20">
                <p className="text-[14px] font-medium text-ink">Deactivate account</p>
                <p className="mt-1 text-[13px] text-ink-muted">
                  Your profile will be hidden and you won&apos;t be able to log in until reactivated.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-400"
                  onClick={() => setShowDeactivateModal(true)}
                >
                  Deactivate account
                </Button>
              </div>

              <div className="rounded-xl border border-red-200 bg-red-50/50 p-4 dark:border-red-900 dark:bg-red-950/20">
                <p className="text-[14px] font-medium text-red-700 dark:text-red-400">Delete account</p>
                <p className="mt-1 text-[13px] text-ink-muted">
                  Permanently delete your account and all associated data. This cannot be undone.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 border-red-300 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400"
                  onClick={() => { setShowDeleteModal(true); setDeleteConfirm(''); }}
                >
                  Delete account
                </Button>
              </div>
            </div>
          </SettingsCard>
        </div>
      </div>

      {/* Deactivate modal */}
      {showDeactivateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowDeactivateModal(false)}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl dark:bg-[#111] dark:border dark:border-[#222]" onClick={e => e.stopPropagation()}>
            <h3 className="text-[17px] font-semibold text-ink">Deactivate account?</h3>
            <p className="mt-2 text-[14px] text-ink-muted">
              You will be logged out and won&apos;t be able to sign in until your account is reactivated.
            </p>
            <div className="mt-5 flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setShowDeactivateModal(false)}>Cancel</Button>
              <Button className="flex-1 bg-amber-600 hover:bg-amber-700" loading={dangerLoading} onClick={handleDeactivate}>
                Deactivate
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowDeleteModal(false)}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl dark:bg-[#111] dark:border dark:border-[#222]" onClick={e => e.stopPropagation()}>
            <h3 className="text-[17px] font-semibold text-red-600">Delete account permanently?</h3>
            <p className="mt-2 text-[14px] text-ink-muted">
              All your posts, messages, and connections will be permanently removed.
            </p>
            <Input
              label='Type "DELETE" to confirm'
              value={deleteConfirm}
              onChange={e => setDeleteConfirm(e.target.value)}
              className="mt-4"
            />
            <div className="mt-5 flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setShowDeleteModal(false)}>Cancel</Button>
              <Button
                className="flex-1 bg-red-600 hover:bg-red-700"
                loading={dangerLoading}
                disabled={deleteConfirm !== 'DELETE'}
                onClick={handleDelete}
              >
                Delete forever
              </Button>
            </div>
          </div>
        </div>
      )}

      {loading && (
        <p className="text-center text-[13px] text-ink-muted py-4">Loading settings…</p>
      )}
    </div>
  );
}
