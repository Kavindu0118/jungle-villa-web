import { useEffect, useState } from 'react';
import { signInWithGoogle } from './lib/firebase';
import { getUserProfile, saveUserProfile } from './lib/menuStorage';

export default function LoginModal({ user, onComplete }) {
  const [profile, setProfile] = useState(null);
  const hasProfile = Boolean(profile);
  const [loading, setLoading] = useState(true);
  const [isOnboarding, setIsOnboarding] = useState(false);
  const [restaurantName, setRestaurantName] = useState('');
  const [ownerName, setOwnerName] = useState('');

  useEffect(() => {
    async function checkProfile() {
      if (user) {
        const data = await getUserProfile(user.uid);
        if (data) {
          setProfile(data);
          onComplete(data);
        } else {
          setIsOnboarding(true);
        }
      }
      setLoading(false);
    }
    checkProfile();
  }, [user, onComplete]);

  const handleCreateProfile = async (e) => {
    e.preventDefault();
    if (!restaurantName.trim() || !ownerName.trim()) return;
    
 setLoading(true);
    const profileData = { restaurantName, ownerName, email: user.email };
    await saveUserProfile(user.uid, profileData);
    setProfile(profileData);
    onComplete(profileData);
  };

  if (!user && !loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/60 p-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-2xl">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-neutral-500 mb-2">Welcome to</p>
          <h2 className="text-2xl font-bold text-neutral-900 mb-6">QR Menu Studio</h2>
          <p className="text-neutral-600 mb-8">Sign in to create, manage, and publish your restaurant menus.</p>
          <button
            onClick={signInWithGoogle}
            className="flex w-full items-center justify-center gap-3 rounded-xl bg-neutral-900 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:focus:bg-neutral-800 transition-colors"
          >
            Sign in with Google
          </button>
        </div>
      </div>
    );
  }

  if (isOnboarding) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/60 p-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl">
          <h2 className="text-2xl font-bold text-neutral-900 mb-2">Complete your profile</h2>
          <p className="text-sm text-neutral-600 mb-6">Just a few details about your business to get started.</p>
          
          <form onSubmit={handleCreateProfile} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-900 mb-1">Owner Name</label>
              <input 
                required
                type="text" 
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                className="w-full rounded-xl border border-neutral-300 p-3 text-sm outline-none focus:border-neutral-900"
                placeholder="e.g. Gordon Ramsay"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-900 mb-1">Restaurant Name</label>
              <input 
                required
                type="text" 
                value={restaurantName}
                onChange={(e) => setRestaurantName(e.target.value)}
                className="w-full rounded-xl border border-neutral-300 p-3 text-sm outline-none focus:border-neutral-900"
                placeholder="e.g. The Rustic Spoon"
              />
            </div>
            
            <button
              disabled={loading}
              type="submit"
              className="mt-4 w-full rounded-xl bg-neutral-900 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-neutral-800 transition-colors disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Finish Setup'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (hasProfile) return null;
  return null;
}
