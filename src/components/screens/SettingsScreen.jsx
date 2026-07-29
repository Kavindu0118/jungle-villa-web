import Toggle from '../Toggle'
import { useState, useEffect } from 'react'
import { initializeApp, deleteApp } from 'firebase/app'
import { getFirestore, collection, getDocs, limit, query } from 'firebase/firestore'
import { IconTrash } from '../Icons'

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
  handleRestaurantWebsiteChange,
  savedMenus,
  setDeleteConfirmId,
  tableTrackingEnabled,
  tableCount,
  handleToggleTableTracking,
  handleTableCountChange,
  handleUpdateBackupDatabase,
  waiterCodes = [],
  isWaiterCodesLoading = false,
  isWaiterCodesUpdating = false,
  onAddWaiterCode,
  onDeleteWaiterCode,
}) {
  const [editingName, setEditingName] = useState(false)
  const [editingSlug, setEditingSlug] = useState(false)
  const [editingAddress, setEditingAddress] = useState(false)
  const [editingPhone, setEditingPhone] = useState(false)
  const [slugError, setSlugError] = useState('')
  const [editingWebsite, setEditingWebsite] = useState(false)


  const [tempName, setTempName] = useState(restaurantSettings?.name || '')
  const [tempSlug, setTempSlug] = useState(restaurantSettings?.slug || '')
  const [tempAddress, setTempAddress] = useState(restaurantSettings?.address || '')
  const [tempPhone, setTempPhone] = useState(restaurantSettings?.phone || '')
  const [tempWebsite, setTempWebsite] = useState(restaurantSettings?.website || '')

  const [newCode, setNewCode] = useState('')

  const handleAddCode = async () => {
    const trimmed = newCode.trim()
    if (trimmed.length < 5) {
      alert('Code must be at least 5 characters long.')
      return
    }
    if (waiterCodes.some(item => item.code.toLowerCase() === trimmed.toLowerCase())) {
      alert('This waiter code already exists.')
      return
    }
    await onAddWaiterCode(trimmed)
    setNewCode('')
  }

  const handleSaveName = async () => {
    if (tempName.trim()) {
      await handleRestaurantNameChange(tempName.trim())
      setEditingName(false)
    }
  }

  const handleSaveSlug = async () => {
    const trimmedSlug = tempSlug.trim()
    if (!trimmedSlug) return

    setSlugError('')
    try {
      await handleSlugChange(trimmedSlug)
      setEditingSlug(false)
    } catch (err) {
      setSlugError(err.message || 'This slug already exists. Please choose another one.')
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

  const handleSaveWebsite = async () => {
    await handleRestaurantWebsiteChange(tempWebsite.trim())
    setEditingWebsite(false)
  }

  const handleCancelPhone = () => {
    setTempPhone(restaurantSettings?.phone || '')
    setEditingPhone(false)
  }

  const handleCancelWebsite = () => {
    setTempWebsite(restaurantSettings?.website || '')
    setEditingWebsite(false)
  }

  const handleCancelName = () => {
    setTempName(restaurantSettings?.name || '')
    setEditingName(false)
  }

  const handleCancelSlug = () => {
    setTempSlug(restaurantSettings?.slug || '')
    setEditingSlug(false)
    setSlugError('')
  }

  const handleCancelAddress = () => {
    setTempAddress(restaurantSettings?.address || '')
    setEditingAddress(false)
  }

  const [dbApiKey, setDbApiKey] = useState(profile?.backupDatabase?.apiKey || '')
  const [dbAuthDomain, setDbAuthDomain] = useState(profile?.backupDatabase?.authDomain || '')
  const [dbProjectId, setDbProjectId] = useState(profile?.backupDatabase?.projectId || '')
  const [dbStorageBucket, setDbStorageBucket] = useState(profile?.backupDatabase?.storageBucket || '')
  const [dbMessagingSenderId, setDbMessagingSenderId] = useState(profile?.backupDatabase?.messagingSenderId || '')
  const [dbAppId, setDbAppId] = useState(profile?.backupDatabase?.appId || '')

  const [testStatus, setTestStatus] = useState(null)
  const [isSavingConfig, setIsSavingConfig] = useState(false)
  const [isEditing, setIsEditing] = useState(!profile?.backupDatabase)

  useEffect(() => {
    if (profile?.backupDatabase) {
      setDbApiKey(profile.backupDatabase.apiKey || '')
      setDbAuthDomain(profile.backupDatabase.authDomain || '')
      setDbProjectId(profile.backupDatabase.projectId || '')
      setDbStorageBucket(profile.backupDatabase.storageBucket || '')
      setDbMessagingSenderId(profile.backupDatabase.messagingSenderId || '')
      setDbAppId(profile.backupDatabase.appId || '')
    }
  }, [profile?.backupDatabase])

  const handleTestConnection = async () => {
    if (!dbApiKey.trim() || !dbProjectId.trim() || !dbAppId.trim()) {
      setTestStatus({ type: 'error', message: 'API Key, Project ID, and App ID are required.' })
      return
    }

    setTestStatus({ type: 'loading', message: 'Testing database connection...' })

    const tempAppName = `test_connection_${Date.now()}`
    let tempApp = null
    try {
      const config = {
        apiKey: dbApiKey.trim(),
        authDomain: dbAuthDomain.trim() || `${dbProjectId.trim()}.firebaseapp.com`,
        projectId: dbProjectId.trim(),
        storageBucket: dbStorageBucket.trim() || `${dbProjectId.trim()}.appspot.com`,
        messagingSenderId: dbMessagingSenderId.trim(),
        appId: dbAppId.trim(),
      }

      tempApp = initializeApp(config, tempAppName)
      const tempDb = getFirestore(tempApp)
      const testRef = collection(tempDb, 'orders')
      const testQuery = query(testRef, limit(1))

      await getDocs(testQuery)

      setTestStatus({ type: 'success', message: 'Connection successful! Orders collection is accessible.' })
    } catch (err) {
      console.error('Test connection error:', err)
      setTestStatus({ type: 'error', message: `Connection failed: ${err.message}` })
    } finally {
      if (tempApp) {
        try {
          await deleteApp(tempApp)
        } catch (e) {
          console.error('Error deleting temp app:', e)
        }
      }
    }
  }

  const handleSaveConfig = async () => {
    if (!dbApiKey.trim() || !dbProjectId.trim() || !dbAppId.trim()) {
      alert('API Key, Project ID, and App ID are required.')
      return
    }

    setIsSavingConfig(true)
    try {
      const config = {
        apiKey: dbApiKey.trim(),
        authDomain: dbAuthDomain.trim(),
        projectId: dbProjectId.trim(),
        storageBucket: dbStorageBucket.trim(),
        messagingSenderId: dbMessagingSenderId.trim(),
        appId: dbAppId.trim(),
      }
      await handleUpdateBackupDatabase(config)
      alert('Backup database connection saved successfully!')
      setIsEditing(false)
    } catch (err) {
      console.error('Save config error:', err)
      alert(`Failed to save: ${err.message}`)
    } finally {
      setIsSavingConfig(false)
    }
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
                onChange={(e) =>
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
            className={`relative inline-flex h-6 w-11 items-center rounded-full ${tableTrackingEnabled
                ? "bg-green-600"
                : "bg-neutral-300"
              }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${tableTrackingEnabled
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
              <div className="flex flex-col items-end gap-2">
                <div className="flex items-center gap-2">
                  <input
                    value={tempSlug}
                    onChange={(e) => {
                      setTempSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))
                      if (slugError) setSlugError('')
                    }}
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
                {slugError && <p className="text-xs text-red-600">{slugError}</p>}
              </div>
            ) : (
              <button
                onClick={() => {
                  setTempSlug(restaurantSettings?.slug || '')
                  setSlugError('')
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

          {/* Restaurant Website */}
          <div className="flex justify-between items-center py-2 border-b border-neutral-100">
            <span className="text-sm font-medium text-neutral-600">Website</span>
            {editingWebsite ? (
              <div className="flex items-center gap-2">
                <input
                  value={tempWebsite}
                  onChange={(e) => setTempWebsite(e.target.value)}
                  disabled={isRestaurantUpdating}
                  className="rounded-lg border border-neutral-300 px-2 py-1 text-sm outline-none transition focus:border-green-500"
                  placeholder="Enter website URL"
                />
                <button
                  onClick={handleSaveWebsite}
                  disabled={isRestaurantUpdating}
                  className="rounded-lg bg-green-600 px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-green-700 disabled:opacity-60"
                >
                  Save
                </button>
                <button
                  onClick={handleCancelWebsite}
                  disabled={isRestaurantUpdating}
                  className="rounded-lg border border-neutral-300 bg-white px-2.5 py-1 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-60"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  setTempWebsite(restaurantSettings?.website || '')
                  setEditingWebsite(true)
                }}
                disabled={isRestaurantLoading || isRestaurantUpdating}
                className="text-sm font-medium text-neutral-900 hover:text-green-600 transition disabled:opacity-60 text-right max-w-[200px] truncate"
              >
                {restaurantSettings?.website || '—'}
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
          <Toggle on={false} onToggle={() => { }} disabled={true} />
        </div>
      </div>

      {/* Backup Database Setup */}
      <div className="card p-5 mb-4">
        <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: '#16a34a' }}>Backup Database Setup</p>
        <div className="space-y-4">
          {profile?.backupDatabase && !isEditing ? (
            <>
              <div className="flex items-center gap-3 bg-green-50 text-green-800 border border-green-200 p-4 rounded-xl">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
                <div>
                  <p className="font-bold text-sm">Cloud Database Connected</p>
                  <p className="text-xs text-green-700 mt-0.5">Live restaurant POS sales data is successfully feeding analytics.</p>
                </div>
              </div>

              <div className="border border-neutral-100 rounded-xl p-4 bg-neutral-50/50 space-y-2.5 text-xs text-neutral-600">
                <div className="flex justify-between">
                  <span className="font-semibold text-neutral-500">Project ID</span>
                  <span className="font-mono text-neutral-900">{profile.backupDatabase.projectId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold text-neutral-500">API Key</span>
                  <span className="font-mono text-neutral-900">••••••••••••••••••••••••••••</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold text-neutral-500">App ID</span>
                  <span className="font-mono text-neutral-900">
                    {profile.backupDatabase.appId.slice(0, 10)}... (masked)
                  </span>
                </div>
              </div>

              {testStatus && (
                <div className={`p-3 rounded-xl text-sm ${testStatus.type === 'loading' ? 'bg-amber-50 text-amber-800 border border-amber-200 animate-pulse' :
                    testStatus.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' :
                      'bg-red-50 text-red-800 border border-red-200'
                  }`}>
                  {testStatus.message}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={isRestaurantUpdating || isSavingConfig}
                  className="btn-ghost flex-1 py-2.5 text-sm font-semibold"
                >
                  Test Connection
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="btn-green flex-1 py-2.5 text-sm font-semibold"
                >
                  Update Settings
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-neutral-500">
                Connect a secondary Firebase Firestore database to feed live orders and sales data to the analytics dashboard.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-neutral-600 mb-1">API Key <span className="text-red-500">*</span></label>
                  <input
                    type="password"
                    value={dbApiKey}
                    onChange={(e) => setDbApiKey(e.target.value)}
                    className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-green-500"
                    placeholder="Enter Firebase API Key"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-600 mb-1">Project ID <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={dbProjectId}
                    onChange={(e) => setDbProjectId(e.target.value)}
                    className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-green-500"
                    placeholder="e.g. my-restaurant-pos"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-600 mb-1">App ID <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={dbAppId}
                    onChange={(e) => setDbAppId(e.target.value)}
                    className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-green-500"
                    placeholder="e.g. 1:1234567890:web:abcdef123456"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-600 mb-1">Auth Domain (Optional)</label>
                  <input
                    type="text"
                    value={dbAuthDomain}
                    onChange={(e) => setDbAuthDomain(e.target.value)}
                    className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-green-500"
                    placeholder="e.g. my-restaurant-pos.firebaseapp.com"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-600 mb-1">Storage Bucket (Optional)</label>
                  <input
                    type="text"
                    value={dbStorageBucket}
                    onChange={(e) => setDbStorageBucket(e.target.value)}
                    className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-green-500"
                    placeholder="e.g. my-restaurant-pos.appspot.com"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-600 mb-1">Messaging Sender ID (Optional)</label>
                  <input
                    type="text"
                    value={dbMessagingSenderId}
                    onChange={(e) => setDbMessagingSenderId(e.target.value)}
                    className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-green-500"
                    placeholder="e.g. 123456789012"
                  />
                </div>
              </div>

              {testStatus && (
                <div className={`p-3 rounded-xl text-sm ${testStatus.type === 'loading' ? 'bg-amber-50 text-amber-800 border border-amber-200 animate-pulse' :
                    testStatus.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' :
                      'bg-red-50 text-red-800 border border-red-200'
                  }`}>
                  {testStatus.message}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                {profile?.backupDatabase && (
                  <button
                    type="button"
                    onClick={() => {
                      setTestStatus(null)
                      setIsEditing(false)
                    }}
                    className="btn-ghost py-2.5 text-sm font-semibold"
                  >
                    Cancel
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={isRestaurantUpdating || isSavingConfig}
                  className="btn-ghost flex-1 py-2.5 text-sm font-semibold"
                >
                  Test Connection
                </button>
                <button
                  type="button"
                  onClick={handleSaveConfig}
                  disabled={isRestaurantUpdating || isSavingConfig || !dbApiKey || !dbProjectId || !dbAppId}
                  className="btn-green flex-1 py-2.5 text-sm font-semibold"
                >
                  {isSavingConfig ? 'Saving...' : 'Save Configuration'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Waiter Codes */}
      <div className="card p-5 mb-4">
        <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: '#16a34a' }}>Waiter Codes</p>
        <p className="text-sm text-neutral-500 mb-4">
          Manage up to 10 one-time codes (minimum 5 characters) for authenticating waiters.
        </p>

        {isWaiterCodesLoading ? (
          <div className="text-sm text-neutral-500 py-2">Loading waiter codes...</div>
        ) : waiterCodes.length === 0 ? (
          <div className="text-sm text-neutral-500 bg-neutral-50 p-4 rounded-xl border border-dashed border-neutral-200 text-center mb-4">
            No waiter codes added yet.
          </div>
        ) : (
          <div className="space-y-2 mb-4">
            {waiterCodes.map(({ code, used }) => (
              <div key={code} className="flex items-center justify-between p-3 rounded-xl border border-neutral-100 bg-neutral-50/50">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm font-semibold text-neutral-800">{code}</span>
                  <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${used
                      ? 'bg-red-50 text-red-700 border border-red-100'
                      : 'bg-green-50 text-green-700 border border-green-100'
                    }`}>
                    {used ? 'Used' : 'Not Used'}
                  </span>
                </div>
                <button
                  type="button"
                  disabled={isWaiterCodesUpdating}
                  onClick={() => onDeleteWaiterCode(code)}
                  className="text-neutral-400 hover:text-red-600 transition disabled:opacity-50"
                  title="Delete waiter code"
                >
                  <IconTrash />
                </button>
              </div>
            ))}
          </div>
        )}

        {waiterCodes.length < 10 ? (
          <div className="flex gap-2">
            <input
              type="text"
              value={newCode}
              onChange={(e) => setNewCode(e.target.value.replace(/\s+/g, ''))}
              disabled={isWaiterCodesUpdating}
              placeholder="Enter code (min 5 chars)"
              className="flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none transition focus:border-green-500"
            />
            <button
              type="button"
              onClick={handleAddCode}
              disabled={isWaiterCodesUpdating || newCode.trim().length < 5}
              className="btn-green px-4 py-2 text-sm font-semibold whitespace-nowrap"
            >
              Add Code
            </button>
          </div>
        ) : (
          <p className="text-xs text-amber-600">
            ✓ Maximum limit of 10 waiter codes reached. Delete an existing code to add a new one.
          </p>
        )}
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
