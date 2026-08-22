import { useEffect, useState } from 'react';
import { signInWithGoogle } from './lib/firebase';
import { getUserProfile, createRestaurantForUser } from './lib/menuStorage';

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
        if (data?.restaurantId) {
          setProfile(data);
          setIsOnboarding(false);
          onComplete(data);
        } else {
          setIsOnboarding(true);
        }
      } else {
        setIsOnboarding(false);
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
    const createdProfile = await createRestaurantForUser(user.uid, profileData);

    if (!createdProfile) {
      setLoading(false);
      return;
    }

    setProfile(createdProfile);
    setIsOnboarding(false);
    setLoading(false);
    onComplete(createdProfile);
  };

  if (!user && !loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.55)' }}>
        <div className="w-full max-w-md rounded-3xl bg-white p-10 text-center shadow-2xl">
          {/* Logo / Icon */}
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border border-neutral-100 shadow-md">
            <img src="/assets/appicon.jpeg" alt="Smart POS" className="h-full w-full object-cover" />
          </div>

          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#16a34a', letterSpacing: '0.15em' }}>
            Welcome to
          </p>
          <h2 className="mt-2 text-3xl font-bold text-neutral-900">Smart POS</h2>
          <p className="mt-3 text-sm leading-relaxed text-neutral-500">
            Smart POS & Restaurant Management — manage orders, POS billing, inventory, and digital menus seamlessly.
          </p>

          <button
            onClick={signInWithGoogle}
            className="mt-8 flex w-full items-center justify-center gap-3 rounded-xl px-4 py-3.5 text-sm font-semibold text-white shadow-sm transition-all"
            style={{ background: '#16a34a' }}
            onMouseEnter={e => e.currentTarget.style.background = '#15803d'}
            onMouseLeave={e => e.currentTarget.style.background = '#16a34a'}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#fff"/>
              <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#fff" fillOpacity=".8"/>
              <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#fff" fillOpacity=".6"/>
              <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#fff" fillOpacity=".6"/>
            </svg>
            Continue with Google
          </button>

          <p className="mt-5 text-xs text-neutral-400">
            Free to use · No credit card required
          </p>
        </div>
      </div>
    );
  }

  if (isOnboarding) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.55)' }}>
        <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl">
          {/* Step indicator */}
          <div className="mb-6 flex items-center gap-2">
            <div className="h-2 w-8 rounded-full" style={{ background: '#16a34a' }}></div>
            <div className="h-2 w-4 rounded-full bg-neutral-200"></div>
          </div>

          <h2 className="text-2xl font-bold text-neutral-900">Set up your restaurant</h2>
          <p className="mt-2 text-sm text-neutral-500">Just a few details about your business to get started.</p>

          <form onSubmit={handleCreateProfile} className="mt-6 space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-neutral-800">Your Name</label>
              <input
                required
                type="text"
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                className="input-field"
                placeholder="e.g. Gordon Ramsay"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-neutral-800">Restaurant Name</label>
              <input
                required
                type="text"
                value={restaurantName}
                onChange={(e) => setRestaurantName(e.target.value)}
                className="input-field"
                placeholder="e.g. The Rustic Spoon"
              />
            </div>

            <button
              disabled={loading}
              type="submit"
              className="btn-green mt-2 w-full py-3"
            >
              {loading ? 'Saving...' : 'Finish Setup →'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (hasProfile) return null;
  return null;
}
