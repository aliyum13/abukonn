'use client';

import { useEffect, useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

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

interface ProfilePost {
  id: number;
  content: string;
  likes_count: number;
  comments_count: number;
  created_at: string;
}

function getInitials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
}

function timeAgo(dateString: string) {
  const seconds = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function ProfilePage() {
  const { user, token, loading: authLoading, updateUser } = useAuth();
  const router = useRouter();
  const [posts, setPosts] = useState<ProfilePost[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ bio: '', department: '', level: '' });

  useEffect(() => {
    if (!authLoading && !token) router.push('/login');
  }, [authLoading, token, router]);

  useEffect(() => {
    if (!token) return;

    fetch(`${API_URL}/api/users/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.user) {
          setForm({
            bio: data.user.bio || '',
            department: data.user.department,
            level: data.user.level,
          });
          setPosts(data.posts || []);
        }
      })
      .catch(() => setError('Failed to load profile'))
      .finally(() => setLoading(false));
  }, [token]);

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSaving(true);
    setError('');

    try {
      const res = await fetch(`${API_URL}/api/users/me`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      updateUser(data.user);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || !user) {
    return <div className="flex items-center justify-center min-h-[60vh] text-gray-400">Loading...</div>;
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg">{error}</div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-start gap-4">
          <div className="w-20 h-20 rounded-full bg-[#16a34a] text-white flex items-center justify-center text-2xl font-bold shrink-0">
            {getInitials(user.full_name)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h1 className="text-xl font-bold text-gray-900">{user.full_name}</h1>
                <p className="text-sm text-gray-500 mt-0.5">{user.matric_number}</p>
              </div>
              <button
                onClick={() => setEditing(!editing)}
                className="px-3 py-1.5 text-sm font-medium text-[#16a34a] border border-[#16a34a] rounded-lg hover:bg-green-50 transition shrink-0"
              >
                {editing ? 'Cancel' : 'Edit Profile'}
              </button>
            </div>

            {!editing ? (
              <div className="mt-4 space-y-2">
                <div className="flex gap-4 text-sm">
                  <span className="text-gray-500">Department</span>
                  <span className="text-gray-800 font-medium">{user.department}</span>
                </div>
                <div className="flex gap-4 text-sm">
                  <span className="text-gray-500">Level</span>
                  <span className="text-gray-800 font-medium">{user.level}</span>
                </div>
                {user.bio && (
                  <p className="text-sm text-gray-600 mt-3 leading-relaxed">{user.bio}</p>
                )}
                {!user.bio && (
                  <p className="text-sm text-gray-400 mt-3 italic">No bio yet. Click Edit Profile to add one.</p>
                )}
              </div>
            ) : (
              <form onSubmit={handleSave} className="mt-4 space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Bio</label>
                  <textarea
                    value={form.bio}
                    onChange={(e) => setForm({ ...form, bio: e.target.value })}
                    rows={3}
                    placeholder="Tell others about yourself..."
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#16a34a] focus:border-transparent outline-none text-sm resize-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                  <select
                    value={form.department}
                    onChange={(e) => setForm({ ...form, department: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#16a34a] focus:border-transparent outline-none text-sm bg-white"
                  >
                    {DEPARTMENTS.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Level</label>
                  <select
                    value={form.level}
                    onChange={(e) => setForm({ ...form, level: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#16a34a] focus:border-transparent outline-none text-sm bg-white"
                  >
                    {LEVELS.map((l) => (
                      <option key={l} value={l}>{l}</option>
                    ))}
                  </select>
                </div>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-[#16a34a] hover:bg-green-700 text-white text-sm font-medium rounded-lg transition disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-gray-800 mb-3">Your Posts</h2>
        {loading ? (
          <p className="text-gray-400 text-center py-8">Loading posts...</p>
        ) : posts.length === 0 ? (
          <p className="text-gray-400 text-center py-8">No posts yet</p>
        ) : (
          <div className="space-y-3">
            {posts.map((post) => (
              <div key={post.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                <p className="text-gray-800 whitespace-pre-wrap">{post.content}</p>
                <div className="flex items-center gap-4 mt-3 text-xs text-gray-400">
                  <span>{timeAgo(post.created_at)}</span>
                  <span>{post.likes_count} likes</span>
                  <span>{post.comments_count} comments</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
