import Toggle from '../Toggle'

export default function SettingsScreen({
  restaurantSettings,
  profile,
  isRestaurantLoading,
  isRestaurantUpdating,
  handleToggleOnlineOrders,
  handleCurrencyChange,
  savedMenus,
  setDeleteConfirmId
}) {
  return (
    <div className="p-6 sm:p-8 max-w-2xl">
      <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500">Settings</p>
      <h2 className="mt-1 mb-6 text-2xl font-bold text-neutral-900">App Settings</h2>

      {/* Online Orders */}
      <div className="card p-5 mb-4">
        <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: '#16a34a' }}>Orders</p>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-semibold text-neutral-900">Online Orders</p>
            <p className="mt-1 text-sm text-neutral-500">Allow customers to place orders directly from your QR menu.</p>
          </div>
          <Toggle
            on={!!restaurantSettings?.allowOnlineOrders}
            onToggle={handleToggleOnlineOrders}
            disabled={isRestaurantLoading || isRestaurantUpdating || !restaurantSettings}
          />
        </div>
        {restaurantSettings?.allowOnlineOrders && (
          <div className="mt-4 rounded-xl p-3 text-sm" style={{ background: '#f0fdf4', color: '#15803d' }}>
            ✓ Customers can now see an order form on your QR menu page.
          </div>
        )}
      </div>

      {/* Restaurant Details */}
      <div className="card p-5 mb-4">
        <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: '#16a34a' }}>Restaurant Details</p>
        <div className="space-y-3">
          <div className="flex justify-between items-center py-2 border-b border-neutral-100">
            <span className="text-sm font-medium text-neutral-600">Restaurant Name</span>
            <span className="text-sm font-semibold text-neutral-900">{restaurantSettings?.name || profile?.restaurantName || '—'}</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-neutral-100">
            <span className="text-sm font-medium text-neutral-600">Menu Slug</span>
            <span className="font-mono text-sm text-neutral-700">{restaurantSettings?.slug || '—'}</span>
          </div>
          <div className="flex justify-between items-center py-2">
            <span className="text-sm font-medium text-neutral-600">Status</span>
            <span className={restaurantSettings?.isActive ? 'badge-green' : 'badge-gray'}>
              {restaurantSettings?.isActive ? 'Active' : 'Inactive'}
            </span>
          </div>
        </div>
      </div>

      {/* QR Menu Link */}
      {restaurantSettings?.slug && (
        <div className="card p-5 mb-4">
          <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: '#16a34a' }}>Public Menu Link</p>
          <div className="flex items-center gap-3 rounded-xl p-3" style={{ background: '#f0fdf4' }}>
            <span className="font-mono text-sm text-neutral-700 break-all flex-1">
              {window.location.origin}/menu/{restaurantSettings.slug}
            </span>
            <button
              onClick={() => navigator.clipboard.writeText(`${window.location.origin}/menu/${restaurantSettings.slug}`)}
              className="btn-ghost text-xs flex-shrink-0"
            >
              Copy
            </button>
          </div>
        </div>
      )}

      {/* App Preferences */}
      <div className="card p-5 mb-4">
        <p className="text-xs font-semibold uppercase tracking-widest mb-4 text-neutral-400">App Preferences</p>
        
        <div className="flex items-center justify-between gap-4 border-b border-neutral-100 pb-4 mb-4">
          <div>
            <p className="font-semibold text-neutral-900">Currency</p>
            <p className="mt-1 text-sm text-neutral-500">Select the currency symbol for your menu prices.</p>
          </div>
          <select 
            value={restaurantSettings?.currency || 'USD'} 
            onChange={(e) => handleCurrencyChange(e.target.value)}
            disabled={isRestaurantLoading || isRestaurantUpdating || !restaurantSettings}
            className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm font-semibold text-neutral-700 outline-none transition focus:border-green-500"
          >
            <option value="USD">USD ($)</option>
            <option value="LKR">LKR (Rs.)</option>
          </select>
        </div>

        <div className="flex items-center justify-between gap-4 opacity-50 pointer-events-none">
          <div>
            <p className="font-semibold text-neutral-900">Dark Mode</p>
            <p className="mt-1 text-sm text-neutral-500">Coming soon</p>
          </div>
          <Toggle on={false} onToggle={() => {}} disabled={true} />
        </div>
      </div>

      {/* Danger Zone */}
      <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
        <p className="text-xs font-semibold uppercase tracking-widest text-red-500 mb-3">Danger Zone</p>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-semibold text-red-800">Delete All Menu Data</p>
            <p className="text-sm text-red-600 mt-1">Permanently delete your published menu. This cannot be undone.</p>
          </div>
          <button
            disabled={savedMenus.length === 0}
            onClick={() => savedMenus.length > 0 && setDeleteConfirmId(savedMenus[0].localId)}
            className="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-100 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}
