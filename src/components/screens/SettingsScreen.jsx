import Toggle from '../Toggle'
import { useState } from 'react'

export default function SettingsScreen({
  restaurantSettings,
  profile,
  isRestaurantLoading,
  isRestaurantUpdating,
  handleToggleOnlineOrders,
  handleToggleServiceFee,
  handleServiceFeePercentageChange,
  handleCurrencyChange,
  handleRestaurantNameChange,
  handleSlugChange,
  handleRestaurantAddressChange,
  handleRestaurantPhoneChange,
  savedMenus,
  setDeleteConfirmId,
  tableTrackingEnabled,
  tableCount,
  handleToggleTableTracking,
  handleTableCountChange
}) {
  const [editingName, setEditingName] = useState(false)
  const [editingSlug, setEditingSlug] = useState(false)
  const [editingAddress, setEditingAddress] = useState(false)
  const [editingPhone, setEditingPhone] = useState(false)
  
  const [tempName, setTempName] = useState(restaurantSettings?.name || '')
  const [tempSlug, setTempSlug] = useState(restaurantSettings?.slug || '')
  const [tempAddress, setTempAddress] = useState(restaurantSettings?.address || '')
  const [tempPhone, setTempPhone] = useState(restaurantSettings?.phone || '')

  const handleSaveName = async () => {
    if (tempName.trim()) {
      await handleRestaurantNameChange(tempName.trim())
      setEditingName(false)
    }
  }

  const handleSaveSlug = async () => {
    if (tempSlug.trim()) {
      await handleSlugChange(tempSlug.trim())
      setEditingSlug(false)
    }
  }

  const handleSaveAddress = async () => {
    await handleRestaurantAddressChange(tempAddress.trim())
    setEditingAddress(false)
  }

  const handleSavePhone = async () => {
    await handleRestaurantPhoneChange(tempPhone.trim())
    setEditingPhone(false)
  }

  const handleCancelName = () => {
    setTempName(restaurantSettings?.name || '')
    setEditingName(false)
  }

  const handleCancelSlug = () => {
    setTempSlug(restaurantSettings?.slug || '')
    setEditingSlug(false)
  }

  const handleCancelAddress = () => {
    setTempAddress(restaurantSettings?.address || '')
    setEditingAddress(false)
  }

  const handleCancelPhone = () => {
    setTempPhone(restaurantSettings?.phone || '')
    setEditingPhone(false)
  }
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

      {/* Service Fee */}
      <div className="card p-5 mb-4">
        <div className="flex items-center justify-between gap-4 border-b border-neutral-100 pb-4 mb-4">
          <div>
            <p className="font-semibold text-neutral-900">
              Service Fee
            </p>
            <p className="mt-1 text-sm text-neutral-500">
              Add service charge automatically to customer bills.
            </p>
          </div>
          <Toggle
            on={!!restaurantSettings?.serviceFeeEnabled}
            onToggle={handleToggleServiceFee}
            disabled={
              isRestaurantLoading ||
              isRestaurantUpdating ||
              !restaurantSettings
            }
          />
        </div>

        {restaurantSettings?.serviceFeeEnabled && (
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-semibold text-neutral-900">
                Service Fee Percentage
              </p>
              <p className="text-sm text-neutral-500">
                Default restaurant service charge
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                max="100"
                value={
                  restaurantSettings?.serviceFeePercentage || 10
                }
                onChange={(e)=>
                  handleServiceFeePercentageChange(
                    Number(e.target.value)
                  )
                }
                className="w-20 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
              />
              <span>%</span>
            </div>
          </div>
        )}
      </div>

      {/* Table Tracking */}
      <div className="rounded-2xl border border-neutral-200 bg-white p-5 mb-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-neutral-900">
              Table Tracking
            </h3>
            <p className="text-sm text-neutral-500">
              Generate a unique QR code for each table.
            </p>
          </div>
          <button
            type="button"
            onClick={handleToggleTableTracking}
            className={`relative inline-flex h-6 w-11 items-center rounded-full ${
              tableTrackingEnabled
                ? "bg-green-600"
                : "bg-neutral-300"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                tableTrackingEnabled
                  ? "translate-x-6"
                  : "translate-x-1"
              }`}
            />
          </button>
        </div>

        {tableTrackingEnabled && (
          <div className="mt-4">
            <label className="block text-sm font-medium text-neutral-700">
              Number of Tables
            </label>
            <input
              type="number"
              min="1"
              value={tableCount}
              onChange={(e) =>
                handleTableCountChange(e.target.value)
              }
              className="mt-2 w-full rounded-xl border border-neutral-300 px-3 py-2"
              placeholder="Enter table count"
            />
          </div>
        )}
      </div>

      {/* Restaurant Details */}
      <div className="card p-5 mb-4">
        <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: '#16a34a' }}>Restaurant Details</p>
        <div className="space-y-3">
          {/* Restaurant Name */}
          <div className="flex justify-between items-center py-2 border-b border-neutral-100">
            <span className="text-sm font-medium text-neutral-600">Restaurant Name</span>
            {editingName ? (
              <div className="flex items-center gap-2">
                <input
                  value={tempName}
                  onChange={(e) => setTempName(e.target.value)}
                  disabled={isRestaurantUpdating}
                  className="rounded-lg border border-neutral-300 px-2 py-1 text-sm outline-none transition focus:border-green-500"
                  placeholder="Enter restaurant name"
                />
                <button
                  onClick={handleSaveName}
                  disabled={isRestaurantUpdating || !tempName.trim()}
                  className="rounded-lg bg-green-600 px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-green-700 disabled:opacity-60"
                >
                  Save
                </button>
                <button
                  onClick={handleCancelName}
                  disabled={isRestaurantUpdating}
                  className="rounded-lg border border-neutral-300 bg-white px-2.5 py-1 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-60"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  setTempName(restaurantSettings?.name || '')
                  setEditingName(true)
                }}
                disabled={isRestaurantLoading || isRestaurantUpdating}
                className="text-sm font-semibold text-neutral-900 hover:text-green-600 transition disabled:opacity-60"
              >
                {restaurantSettings?.name || profile?.restaurantName || '—'}
              </button>
            )}
          </div>

          {/* Menu Slug */}
          <div className="flex justify-between items-center py-2 border-b border-neutral-100">
            <span className="text-sm font-medium text-neutral-600">Menu Slug</span>
            {editingSlug ? (
              <div className="flex items-center gap-2">
                <input
                  value={tempSlug}
                  onChange={(e) => setTempSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  disabled={isRestaurantUpdating}
                  className="font-mono rounded-lg border border-neutral-300 px-2 py-1 text-sm outline-none transition focus:border-green-500"
                  placeholder="e.g. my-restaurant"
                />
                <button
                  onClick={handleSaveSlug}
                  disabled={isRestaurantUpdating || !tempSlug.trim()}
                  className="rounded-lg bg-green-600 px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-green-700 disabled:opacity-60"
                >
                  Save
                </button>
                <button
                  onClick={handleCancelSlug}
                  disabled={isRestaurantUpdating}
                  className="rounded-lg border border-neutral-300 bg-white px-2.5 py-1 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-60"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  setTempSlug(restaurantSettings?.slug || '')
                  setEditingSlug(true)
                }}
                disabled={isRestaurantLoading || isRestaurantUpdating}
                className="font-mono text-sm text-neutral-700 hover:text-green-600 transition disabled:opacity-60"
              >
                {restaurantSettings?.slug || '—'}
              </button>
            )}
          </div>

          {/* Restaurant Address */}
          <div className="flex justify-between items-center py-2 border-b border-neutral-100">
            <span className="text-sm font-medium text-neutral-600">Address</span>
            {editingAddress ? (
              <div className="flex items-center gap-2">
                <input
                  value={tempAddress}
                  onChange={(e) => setTempAddress(e.target.value)}
                  disabled={isRestaurantUpdating}
                  className="rounded-lg border border-neutral-300 px-2 py-1 text-sm outline-none transition focus:border-green-500"
                  placeholder="Enter address"
                />
                <button
                  onClick={handleSaveAddress}
                  disabled={isRestaurantUpdating}
                  className="rounded-lg bg-green-600 px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-green-700 disabled:opacity-60"
                >
                  Save
                </button>
                <button
                  onClick={handleCancelAddress}
                  disabled={isRestaurantUpdating}
                  className="rounded-lg border border-neutral-300 bg-white px-2.5 py-1 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-60"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  setTempAddress(restaurantSettings?.address || '')
                  setEditingAddress(true)
                }}
                disabled={isRestaurantLoading || isRestaurantUpdating}
                className="text-sm font-medium text-neutral-900 hover:text-green-600 transition disabled:opacity-60 text-right max-w-[200px] truncate"
              >
                {restaurantSettings?.address || '—'}
              </button>
            )}
          </div>

          {/* Restaurant Phone */}
          <div className="flex justify-between items-center py-2 border-b border-neutral-100">
            <span className="text-sm font-medium text-neutral-600">Phone Number</span>
            {editingPhone ? (
              <div className="flex items-center gap-2">
                <input
                  value={tempPhone}
                  onChange={(e) => setTempPhone(e.target.value)}
                  disabled={isRestaurantUpdating}
                  className="rounded-lg border border-neutral-300 px-2 py-1 text-sm outline-none transition focus:border-green-500"
                  placeholder="Enter phone number"
                />
                <button
                  onClick={handleSavePhone}
                  disabled={isRestaurantUpdating}
                  className="rounded-lg bg-green-600 px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-green-700 disabled:opacity-60"
                >
                  Save
                </button>
                <button
                  onClick={handleCancelPhone}
                  disabled={isRestaurantUpdating}
                  className="rounded-lg border border-neutral-300 bg-white px-2.5 py-1 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-60"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  setTempPhone(restaurantSettings?.phone || '')
                  setEditingPhone(true)
                }}
                disabled={isRestaurantLoading || isRestaurantUpdating}
                className="text-sm font-medium text-neutral-900 hover:text-green-600 transition disabled:opacity-60"
              >
                {restaurantSettings?.phone || '—'}
              </button>
            )}
          </div>

          {/* Status */}
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
