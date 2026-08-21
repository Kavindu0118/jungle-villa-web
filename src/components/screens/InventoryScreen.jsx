import { useState, useEffect, useMemo, useId } from 'react'
import {
  BAR_CATEGORIES,
  DEFAULT_UNITS,
  STOCK_OUT_REASONS,
  subscribeToBarInventoryItems,
  saveBarInventoryItem,
  deleteBarInventoryItem,
  executeStockIn,
  executeStockOut,
  executeStockAdjustment,
  getInventoryMovements,
  isBackupDbConfigured,
} from '../../lib/inventoryStorage'
import {
  IconInventory,
  IconBottle,
  IconPlus,
  IconEdit,
  IconTrash,
  IconArrowUpRight,
  IconArrowDownLeft,
  IconAlertTriangle,
  IconHistory,
  IconRefresh,
  IconDownload,
  IconSliders,
  IconSearch,
  IconX,
} from '../Icons'

export default function InventoryScreen({
  profile,
  restaurantSettings,
  setActiveSection,
  user,
  savedMenus = [],
}) {
  const isConfigured = useMemo(() => {
    return isBackupDbConfigured(profile?.backupDatabase)
  }, [profile?.backupDatabase])

  const currencySymbol = restaurantSettings?.currency === 'LKR' ? 'Rs. ' : '$'

  // State
  const [items, setItems] = useState([])
  const [movements, setMovements] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState('overview') // 'overview' | 'items' | 'low_stock' | 'movements' | 'reports'

  // Filter states for Items Tab
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('all') // 'all' | 'in_stock' | 'low_stock' | 'out_of_stock'

  // Filter states for Movements Tab
  const [movementTypeFilter, setMovementTypeFilter] = useState('all')
  const [movementSearchQuery, setMovementSearchQuery] = useState('')

  // Modals state
  const [isItemModalOpen, setIsItemModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState(null) // null for create, object for edit

  const [isStockInModalOpen, setIsStockInModalOpen] = useState(false)
  const [stockInTargetItem, setStockInTargetItem] = useState(null)

  const [isStockOutModalOpen, setIsStockOutModalOpen] = useState(false)
  const [stockOutTargetItem, setStockOutTargetItem] = useState(null)

  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false)
  const [adjustTargetItem, setAdjustTargetItem] = useState(null)

  const [deleteConfirmItem, setDeleteConfirmItem] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [actionSuccessMessage, setActionSuccessMessage] = useState(null)

  // Fetch / Subscribe to items
  useEffect(() => {
    if (!isConfigured) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    const unsubscribe = subscribeToBarInventoryItems(
      profile.backupDatabase,
      (fetchedItems) => {
        setItems(fetchedItems)
        setLoading(false)
      },
      (err) => {
        console.error('Error in bar inventory subscription:', err)
        setError('Failed to connect to the cloud backup database. Please check your settings.')
        setLoading(false)
      }
    )

    // Load recent movements
    refreshMovements()

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe()
    }
  }, [isConfigured, profile?.backupDatabase])

  const refreshMovements = async () => {
    if (!isConfigured) return
    try {
      const logs = await getInventoryMovements(profile.backupDatabase, 150)
      setMovements(logs)
    } catch (err) {
      console.error('Failed to load movements:', err)
    }
  }

  // Flash success message
  const showSuccess = (msg) => {
    setActionSuccessMessage(msg)
    setTimeout(() => {
      setActionSuccessMessage(null)
    }, 4000)
  }

  // Extract all available menu items for linking
  const availableMenuItems = useMemo(() => {
    const list = []
    if (savedMenus && savedMenus.length > 0) {
      savedMenus.forEach((menu) => {
        if (menu.sections) {
          menu.sections.forEach((sec) => {
            if (sec.subcategories && sec.subcategories.length > 0) {
              sec.subcategories.forEach((sub) => {
                if (sub.items) {
                  sub.items.forEach((it) => {
                    list.push({ id: it.id, name: it.name, price: it.price, section: sec.title })
                  })
                }
              })
            } else if (sec.items) {
              sec.items.forEach((it) => {
                list.push({ id: it.id, name: it.name, price: it.price, section: sec.title })
              })
            }
          })
        }
      })
    }
    return list
  }, [savedMenus])

  // Calculated Metrics
  const metrics = useMemo(() => {
    const totalItems = items.length
    let totalStockQty = 0
    let totalInventoryCostValue = 0
    let totalPotentialRetailValue = 0
    let lowStockCount = 0
    let outOfStockCount = 0

    const lowStockList = []
    const outOfStockList = []
    const categoryBreakdown = {}

    items.forEach((item) => {
      const qty = Number(item.currentStock || 0)
      const cost = Number(item.costPrice || 0)
      const price = Number(item.sellingPrice || 0)
      const reorder = Number(item.reorderLevel ?? 10)

      totalStockQty += qty
      totalInventoryCostValue += qty * cost
      totalPotentialRetailValue += qty * price

      const cat = item.category || 'Other Bar Items'
      if (!categoryBreakdown[cat]) {
        categoryBreakdown[cat] = { count: 0, totalQty: 0, totalValue: 0 }
      }
      categoryBreakdown[cat].count += 1
      categoryBreakdown[cat].totalQty += qty
      categoryBreakdown[cat].totalValue += qty * cost

      if (qty <= 0) {
        outOfStockCount += 1
        outOfStockList.push(item)
      } else if (qty <= reorder) {
        lowStockCount += 1
        lowStockList.push(item)
      }
    })

    // Today's Movements calculations
    const todayStr = new Date().toISOString().split('T')[0]
    let stockInToday = 0
    let stockOutToday = 0
    let stockSoldToday = 0

    movements.forEach((mov) => {
      if (mov.createdAt && String(mov.createdAt).startsWith(todayStr)) {
        const q = Math.abs(Number(mov.quantity || 0))
        if (mov.type === 'stock_in') {
          stockInToday += q
        } else if (mov.type === 'sale') {
          stockSoldToday += q
        } else {
          stockOutToday += q
        }
      }
    })

    return {
      totalItems,
      totalStockQty,
      totalInventoryCostValue,
      totalPotentialRetailValue,
      potentialProfit: totalPotentialRetailValue - totalInventoryCostValue,
      lowStockCount,
      outOfStockCount,
      lowStockList,
      outOfStockList,
      stockInToday,
      stockOutToday,
      stockSoldToday,
      categoryBreakdown,
    }
  }, [items, movements])

  // Filtered Items for Items Tab
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchSearch =
        searchQuery.trim() === '' ||
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.sku && item.sku.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (item.category && item.category.toLowerCase().includes(searchQuery.toLowerCase()))

      const matchCategory =
        selectedCategory === 'All' || item.category === selectedCategory

      const qty = Number(item.currentStock || 0)
      const reorder = Number(item.reorderLevel ?? 10)

      let matchStatus = true
      if (selectedStatusFilter === 'in_stock') {
        matchStatus = qty > reorder
      } else if (selectedStatusFilter === 'low_stock') {
        matchStatus = qty > 0 && qty <= reorder
      } else if (selectedStatusFilter === 'out_of_stock') {
        matchStatus = qty <= 0
      }

      return matchSearch && matchCategory && matchStatus
    })
  }, [items, searchQuery, selectedCategory, selectedStatusFilter])

  // Filtered Movements
  const filteredMovements = useMemo(() => {
    return movements.filter((mov) => {
      const matchType =
        movementTypeFilter === 'all' || mov.type === movementTypeFilter

      const matchSearch =
        movementSearchQuery.trim() === '' ||
        (mov.itemName && mov.itemName.toLowerCase().includes(movementSearchQuery.toLowerCase())) ||
        (mov.sku && mov.sku.toLowerCase().includes(movementSearchQuery.toLowerCase())) ||
        (mov.invoiceNumber && mov.invoiceNumber.toLowerCase().includes(movementSearchQuery.toLowerCase())) ||
        (mov.supplier && mov.supplier.toLowerCase().includes(movementSearchQuery.toLowerCase())) ||
        (mov.reason && mov.reason.toLowerCase().includes(movementSearchQuery.toLowerCase()))

      return matchType && matchSearch
    })
  }, [movements, movementTypeFilter, movementSearchQuery])

  // Handlers for Stock Operations
  const handleSaveItem = async (e) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      const form = e.target
      const itemData = {
        id: editingItem?.id,
        name: form.itemName.value,
        sku: form.itemSku.value,
        category: form.itemCategory.value,
        currentStock: Number(form.itemStock.value || 0),
        reorderLevel: Number(form.itemReorder.value || 10),
        maxStock: form.itemMaxStock.value ? Number(form.itemMaxStock.value) : null,
        unit: form.itemUnit.value,
        costPrice: Number(form.itemCost.value || 0),
        sellingPrice: Number(form.itemPrice.value || 0),
        supplier: form.itemSupplier.value,
        notes: form.itemNotes.value,
        linkedMenuItemId: form.itemLinkedMenu.value || null,
        trackingEnabled: form.itemTracking.checked,
      }

      await saveBarInventoryItem(profile.backupDatabase, itemData)
      setIsItemModalOpen(false)
      setEditingItem(null)
      showSuccess(editingItem ? 'Bar product updated successfully!' : 'New bar product added to inventory!')
      refreshMovements()
    } catch (err) {
      alert('Error saving bar product: ' + (err.message || err))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteItem = async () => {
    if (!deleteConfirmItem) return
    setIsSubmitting(true)
    try {
      await deleteBarInventoryItem(profile.backupDatabase, deleteConfirmItem.id)
      setDeleteConfirmItem(null)
      showSuccess('Item deleted from bar inventory.')
      refreshMovements()
    } catch (err) {
      alert('Error deleting item: ' + (err.message || err))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleStockInSubmit = async (e) => {
    e.preventDefault()
    if (!stockInTargetItem) return
    setIsSubmitting(true)
    try {
      const form = e.target
      const qty = Number(form.stockInQty.value)
      const unitCost = Number(form.stockInCost.value)
      const supplier = form.stockInSupplier.value
      const invoiceNumber = form.stockInInvoice.value
      const notes = form.stockInNotes.value

      await executeStockIn(profile.backupDatabase, {
        itemId: stockInTargetItem.id,
        item: stockInTargetItem,
        quantity: qty,
        costPrice: unitCost,
        supplier,
        invoiceNumber,
        notes,
        user: user?.displayName || user?.email || 'Manager',
      })

      setIsStockInModalOpen(false)
      setStockInTargetItem(null)
      showSuccess(`Added +${qty} ${stockInTargetItem.unit || 'units'} to ${stockInTargetItem.name}!`)
      refreshMovements()
    } catch (err) {
      alert('Stock In failed: ' + (err.message || err))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleStockOutSubmit = async (e) => {
    e.preventDefault()
    if (!stockOutTargetItem) return
    setIsSubmitting(true)
    try {
      const form = e.target
      const qty = Number(form.stockOutQty.value)
      const reason = form.stockOutReason.value
      const notes = form.stockOutNotes.value

      await executeStockOut(profile.backupDatabase, {
        itemId: stockOutTargetItem.id,
        item: stockOutTargetItem,
        quantity: qty,
        reason,
        notes,
        user: user?.displayName || user?.email || 'Manager',
      })

      setIsStockOutModalOpen(false)
      setStockOutTargetItem(null)
      showSuccess(`Deducted -${qty} ${stockOutTargetItem.unit || 'units'} from ${stockOutTargetItem.name}.`)
      refreshMovements()
    } catch (err) {
      alert('Stock Out failed: ' + (err.message || err))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleAdjustSubmit = async (e) => {
    e.preventDefault()
    if (!adjustTargetItem) return
    setIsSubmitting(true)
    try {
      const form = e.target
      const actualCount = Number(form.actualCount.value)
      const notes = form.adjustNotes.value

      const res = await executeStockAdjustment(profile.backupDatabase, {
        itemId: adjustTargetItem.id,
        item: adjustTargetItem,
        actualCount,
        notes,
        user: user?.displayName || user?.email || 'Manager',
      })

      setIsAdjustModalOpen(false)
      setAdjustTargetItem(null)
      const deltaStr = res.delta >= 0 ? `+${res.delta}` : `${res.delta}`
      showSuccess(`Adjusted ${adjustTargetItem.name} count to ${actualCount} (${deltaStr}).`)
      refreshMovements()
    } catch (err) {
      alert('Stock adjustment failed: ' + (err.message || err))
    } finally {
      setIsSubmitting(false)
    }
  }

  // Export Movements to CSV
  const handleExportMovementsCSV = () => {
    if (movements.length === 0) {
      alert('No movement records available to export.')
      return
    }

    const headers = ['Date', 'Item Name', 'SKU', 'Category', 'Type', 'Quantity Change', 'Prev Stock', 'New Stock', 'Unit Cost', 'Selling Price', 'Supplier', 'Invoice', 'Reason / Notes', 'User']
    const rows = movements.map((m) => [
      `"${new Date(m.createdAt || Date.now()).toLocaleString()}"`,
      `"${(m.itemName || '').replace(/"/g, '""')}"`,
      `"${(m.sku || '').replace(/"/g, '""')}"`,
      `"${(m.category || '').replace(/"/g, '""')}"`,
      `"${m.type || ''}"`,
      m.quantity || 0,
      m.previousStock || 0,
      m.newStock || 0,
      m.costPrice || 0,
      m.sellingPrice || 0,
      `"${(m.supplier || '').replace(/"/g, '""')}"`,
      `"${(m.invoiceNumber || '').replace(/"/g, '""')}"`,
      `"${((m.reason || '') + (m.notes ? ` - ${m.notes}` : '')).replace(/"/g, '""')}"`,
      `"${(m.user || '').replace(/"/g, '""')}"`,
    ])

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `Bar_Inventory_Movements_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Export Stock Valuation to CSV
  const handleExportStockCSV = () => {
    if (items.length === 0) {
      alert('No bar products in inventory to export.')
      return
    }

    const headers = ['SKU', 'Item Name', 'Category', 'Current Stock', 'Unit', 'Reorder Level', 'Unit Cost', 'Selling Price', 'Total Cost Valuation', 'Total Retail Value', 'Status', 'Supplier']
    const rows = items.map((i) => {
      const qty = Number(i.currentStock || 0)
      const cost = Number(i.costPrice || 0)
      const price = Number(i.sellingPrice || 0)
      const reorder = Number(i.reorderLevel ?? 10)
      const status = qty <= 0 ? 'Out of Stock' : qty <= reorder ? 'Low Stock' : 'In Stock'

      return [
        `"${(i.sku || '').replace(/"/g, '""')}"`,
        `"${(i.name || '').replace(/"/g, '""')}"`,
        `"${(i.category || '').replace(/"/g, '""')}"`,
        qty,
        `"${i.unit || 'Bottles'}"`,
        reorder,
        cost,
        price,
        (qty * cost).toFixed(2),
        (qty * price).toFixed(2),
        `"${status}"`,
        `"${(i.supplier || '').replace(/"/g, '""')}"`,
      ]
    })

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `Bar_Inventory_Valuation_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // If Backup Database not configured
  if (!isConfigured) {
    return (
      <div className="p-6 sm:p-8 max-w-4xl">
        <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
            <IconInventory />
          </div>
          <h2 className="text-2xl font-bold text-neutral-900">Bar Inventory Setup Required</h2>
          <p className="mt-2 text-sm text-neutral-600 max-w-lg mx-auto leading-relaxed">
            Bar Inventory is securely linked with your <strong>Cloud Backup Database</strong> so that your POS and QR Menu stay in complete synchronization.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <button
              onClick={() => setActiveSection('settings')}
              className="btn-green flex items-center gap-2 shadow-sm"
            >
              <IconSliders /> Connect Cloud Backup Database in Settings
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 sm:p-8 space-y-6">
      {/* Toast Notification */}
      {actionSuccessMessage && (
        <div className="fixed top-5 right-5 z-50 flex items-center gap-3 rounded-xl bg-emerald-700 px-5 py-3 text-sm font-medium text-white shadow-xl animate-fade-in">
          <span>✓</span>
          <span>{actionSuccessMessage}</span>
          <button onClick={() => setActionSuccessMessage(null)} className="ml-2 text-white/80 hover:text-white">
            <IconX />
          </button>
        </div>
      )}

      {/* Header Banner */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
              <IconBottle />
            </span>
            <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900">Bar Inventory</h1>
          </div>
          <p className="mt-1 text-sm text-neutral-500">
            Manage your bar stock, track bottle movements, set reorder levels, and log audits.
          </p>
        </div>

        {/* Header Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => {
              setEditingItem(null)
              setIsItemModalOpen(true)
            }}
            className="btn-green flex items-center gap-2 text-sm font-semibold shadow-sm"
          >
            <IconPlus /> Add Bar Item
          </button>

          <button
            onClick={() => {
              if (items.length === 0) {
                alert('Please add a bar item first.')
                return
              }
              setStockInTargetItem(items[0])
              setIsStockInModalOpen(true)
            }}
            className="flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 px-3.5 py-2 text-xs font-semibold text-emerald-800 transition hover:bg-emerald-100"
          >
            <IconArrowDownLeft /> Stock In
          </button>

          <button
            onClick={() => {
              if (items.length === 0) {
                alert('Please add a bar item first.')
                return
              }
              setStockOutTargetItem(items[0])
              setIsStockOutModalOpen(true)
            }}
            className="flex items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-2 text-xs font-semibold text-amber-800 transition hover:bg-amber-100"
          >
            <IconArrowUpRight /> Stock Out
          </button>

          <button
            onClick={() => {
              if (items.length === 0) {
                alert('Please add a bar item first.')
                return
              }
              setAdjustTargetItem(items[0])
              setIsAdjustModalOpen(true)
            }}
            className="flex items-center gap-1.5 rounded-xl border border-purple-300 bg-purple-50 px-3.5 py-2 text-xs font-semibold text-purple-800 transition hover:bg-purple-100"
          >
            <IconSliders /> Adjust
          </button>

          <button
            onClick={refreshMovements}
            title="Refresh Ledger"
            className="btn-ghost flex h-9 w-9 items-center justify-center p-0 rounded-xl"
          >
            <IconRefresh />
          </button>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex border-b border-neutral-200 overflow-x-auto gap-1">
        {[
          { id: 'overview', label: 'Dashboard & Overview', icon: <IconInventory /> },
          { id: 'items', label: `Bar Products (${items.length})`, icon: <IconBottle /> },
          {
            id: 'low_stock',
            label: `Low Stock (${metrics.lowStockCount + metrics.outOfStockCount})`,
            icon: <IconAlertTriangle />,
            badge: metrics.lowStockCount + metrics.outOfStockCount > 0,
          },
          { id: 'movements', label: 'Stock Movements Ledger', icon: <IconHistory /> },
          { id: 'reports', label: 'Valuation & Reports', icon: <IconDownload /> },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold whitespace-nowrap transition-colors ${
              activeTab === tab.id
                ? 'border-emerald-600 text-emerald-700 bg-emerald-50/50 rounded-t-lg'
                : 'border-transparent text-neutral-500 hover:text-neutral-900 hover:border-neutral-300'
            }`}
          >
            <span className="text-xs">{tab.icon}</span>
            <span>{tab.label}</span>
            {tab.badge && (
              <span className="flex h-2 w-2 rounded-full bg-rose-500 ring-2 ring-white" />
            )}
          </button>
        ))}
      </div>

      {/* ────────────────────────────────────────────────────────────────────────
          TAB 1: DASHBOARD & OVERVIEW
          ──────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Active Stock Alerts Banner */}
          {(metrics.outOfStockCount > 0 || metrics.lowStockCount > 0) && (
            <div className="rounded-2xl border border-rose-200 bg-gradient-to-r from-rose-50 to-amber-50 p-5 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-start gap-3.5">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-700">
                    <IconAlertTriangle />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-neutral-900">
                      Inventory Attention Required
                    </h3>
                    <p className="text-xs text-neutral-600 mt-0.5">
                      You have{' '}
                      {metrics.outOfStockCount > 0 && (
                        <span className="font-semibold text-rose-700">
                          {metrics.outOfStockCount} out-of-stock item{metrics.outOfStockCount > 1 ? 's' : ''}
                        </span>
                      )}
                      {metrics.outOfStockCount > 0 && metrics.lowStockCount > 0 && ' and '}
                      {metrics.lowStockCount > 0 && (
                        <span className="font-semibold text-amber-700">
                          {metrics.lowStockCount} low-stock item{metrics.lowStockCount > 1 ? 's' : ''}
                        </span>
                      )}
                      . Consider restocking soon.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setActiveTab('low_stock')}
                  className="rounded-xl bg-white px-4 py-2 text-xs font-semibold text-rose-700 shadow-sm border border-rose-200 hover:bg-rose-50 whitespace-nowrap"
                >
                  View Low Stock List →
                </button>
              </div>
            </div>
          )}

          {/* Key KPI Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="stat-card">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                Total Products
              </p>
              <p className="mt-1.5 text-2xl font-extrabold text-neutral-900">{metrics.totalItems}</p>
              <p className="text-[11px] text-neutral-400 mt-1">{metrics.totalStockQty} total units</p>
            </div>

            <div className="stat-card">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                Stock Valuation (Cost)
              </p>
              <p className="mt-1.5 text-2xl font-extrabold text-emerald-700">
                {currencySymbol}
                {metrics.totalInventoryCostValue.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
              <p className="text-[11px] text-neutral-400 mt-1">Cost of current stock</p>
            </div>

            <div className="stat-card">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                Retail Potential
              </p>
              <p className="mt-1.5 text-2xl font-extrabold text-sky-700">
                {currencySymbol}
                {metrics.totalPotentialRetailValue.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
              <p className="text-[11px] text-neutral-400 mt-1">Potential gross revenue</p>
            </div>

            <div className="stat-card">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                Low Stock Items
              </p>
              <p className={`mt-1.5 text-2xl font-extrabold ${metrics.lowStockCount > 0 ? 'text-amber-600' : 'text-neutral-900'}`}>
                {metrics.lowStockCount}
              </p>
              <p className="text-[11px] text-neutral-400 mt-1">Below reorder level</p>
            </div>

            <div className="stat-card">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                Out of Stock
              </p>
              <p className={`mt-1.5 text-2xl font-extrabold ${metrics.outOfStockCount > 0 ? 'text-rose-600' : 'text-neutral-900'}`}>
                {metrics.outOfStockCount}
              </p>
              <p className="text-[11px] text-neutral-400 mt-1">0 units remaining</p>
            </div>

            <div className="stat-card">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                Stock In (Today)
              </p>
              <p className="mt-1.5 text-2xl font-extrabold text-emerald-600">
                +{metrics.stockInToday}
              </p>
              <p className="text-[11px] text-neutral-400 mt-1">Received today</p>
            </div>
          </div>

          {/* Two-column Layout: Category Distribution & Recent Movements */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Category Stock Distribution */}
            <div className="card p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-neutral-900">Bar Categories Breakdown</h3>
                <span className="text-xs text-neutral-400">By Cost Valuation</span>
              </div>

              {Object.keys(metrics.categoryBreakdown).length === 0 ? (
                <p className="py-8 text-center text-xs text-neutral-400">No bar items recorded yet.</p>
              ) : (
                <div className="space-y-3.5">
                  {Object.entries(metrics.categoryBreakdown)
                    .sort(([, a], [, b]) => b.totalValue - a.totalValue)
                    .map(([categoryName, stats]) => {
                      const pct =
                        metrics.totalInventoryCostValue > 0
                          ? (stats.totalValue / metrics.totalInventoryCostValue) * 100
                          : 0

                      return (
                        <div key={categoryName} className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-neutral-800">{categoryName}</span>
                            <span className="text-neutral-500">
                              {stats.totalQty} units • {currencySymbol}
                              {stats.totalValue.toFixed(2)} ({pct.toFixed(0)}%)
                            </span>
                          </div>
                          <div className="h-2 w-full rounded-full bg-neutral-100 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-emerald-600 transition-all duration-300"
                              style={{ width: `${Math.min(100, Math.max(4, pct))}%` }}
                            />
                          </div>
                        </div>
                      )
                    })}
                </div>
              )}
            </div>

            {/* Recent Movement Activity Feed */}
            <div className="card p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-neutral-900">Recent Stock Activity</h3>
                <button
                  onClick={() => setActiveTab('movements')}
                  className="text-xs font-semibold text-emerald-700 hover:underline"
                >
                  View All ({movements.length}) →
                </button>
              </div>

              {movements.length === 0 ? (
                <p className="py-8 text-center text-xs text-neutral-400">No stock movements logged yet.</p>
              ) : (
                <div className="space-y-2.5 max-h-[340px] overflow-y-auto pr-1">
                  {movements.slice(0, 6).map((mov) => {
                    const isPositive = Number(mov.quantity) > 0
                    return (
                      <div
                        key={mov.id}
                        className="flex items-center justify-between rounded-xl border border-neutral-100 bg-neutral-50/50 p-3 hover:bg-neutral-50"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold ${
                              mov.type === 'stock_in'
                                ? 'bg-emerald-100 text-emerald-700'
                                : mov.type === 'sale'
                                ? 'bg-blue-100 text-blue-700'
                                : mov.type === 'adjustment'
                                ? 'bg-purple-100 text-purple-700'
                                : 'bg-rose-100 text-rose-700'
                            }`}
                          >
                            {mov.type === 'stock_in' ? (
                              <IconArrowDownLeft />
                            ) : mov.type === 'adjustment' ? (
                              <IconSliders />
                            ) : (
                              <IconArrowUpRight />
                            )}
                          </div>
                          <div>
                            <p className="text-xs font-bold text-neutral-900">{mov.itemName}</p>
                            <p className="text-[10px] text-neutral-500">
                              {mov.type.replace('_', ' ').toUpperCase()} •{' '}
                              {mov.reason || mov.supplier || (mov.createdAt ? new Date(mov.createdAt).toLocaleDateString() : '')}
                            </p>
                          </div>
                        </div>

                        <div className="text-right">
                          <span
                            className={`text-xs font-bold ${
                              isPositive ? 'text-emerald-600' : 'text-rose-600'
                            }`}
                          >
                            {isPositive ? `+${mov.quantity}` : mov.quantity}
                          </span>
                          <p className="text-[10px] text-neutral-400">
                            {mov.newStock !== undefined ? `Stock: ${mov.newStock}` : ''}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────────
          TAB 2: BAR PRODUCTS / ITEMS CATALOG
          ──────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'items' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="card p-4 flex flex-col sm:flex-row gap-3 items-center justify-between">
            {/* Search Input */}
            <div className="relative w-full sm:w-72">
              <span className="absolute inset-y-0 left-3 flex items-center text-neutral-400">
                <IconSearch />
              </span>
              <input
                type="text"
                placeholder="Search item name, SKU..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input-text pl-9 text-xs w-full"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute inset-y-0 right-2.5 flex items-center text-neutral-400 hover:text-neutral-600"
                >
                  <IconX />
                </button>
              )}
            </div>

            {/* Category & Status Filters */}
            <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="input-select text-xs"
              >
                <option value="All">All Categories</option>
                {BAR_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>

              <select
                value={selectedStatusFilter}
                onChange={(e) => setSelectedStatusFilter(e.target.value)}
                className="input-select text-xs"
              >
                <option value="all">All Stock Status</option>
                <option value="in_stock">In Stock (Healthy)</option>
                <option value="low_stock">Low Stock (≤ Reorder)</option>
                <option value="out_of_stock">Out of Stock (0)</option>
              </select>

              <button
                onClick={handleExportStockCSV}
                className="btn-ghost flex items-center gap-1.5 text-xs py-2"
                title="Export stock list to CSV"
              >
                <IconDownload /> Export CSV
              </button>
            </div>
          </div>

          {/* Products Table */}
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-neutral-200 bg-neutral-50/80 uppercase tracking-wider text-neutral-500 font-semibold">
                  <tr>
                    <th className="px-4 py-3.5">Product / Item</th>
                    <th className="px-4 py-3.5">SKU / Code</th>
                    <th className="px-4 py-3.5">Category</th>
                    <th className="px-4 py-3.5">Stock Level</th>
                    <th className="px-4 py-3.5">Cost Price</th>
                    <th className="px-4 py-3.5">Selling Price</th>
                    <th className="px-4 py-3.5">Inventory Value</th>
                    <th className="px-4 py-3.5">Status</th>
                    <th className="px-4 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {filteredItems.length === 0 ? (
                    <tr>
                      <td colSpan="9" className="p-8 text-center text-neutral-400">
                        {searchQuery || selectedCategory !== 'All' || selectedStatusFilter !== 'all'
                          ? 'No bar products match your filters.'
                          : 'No bar products added yet. Click "+ Add Bar Item" to get started!'}
                      </td>
                    </tr>
                  ) : (
                    filteredItems.map((item) => {
                      const qty = Number(item.currentStock || 0)
                      const reorder = Number(item.reorderLevel ?? 10)
                      const cost = Number(item.costPrice || 0)
                      const price = Number(item.sellingPrice || 0)
                      const value = qty * cost

                      let statusBadge = (
                        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                          In Stock
                        </span>
                      )

                      if (qty <= 0) {
                        statusBadge = (
                          <span className="inline-flex items-center gap-1 rounded-md bg-rose-100 px-2 py-0.5 text-[11px] font-semibold text-rose-800">
                            Out of Stock
                          </span>
                        )
                      } else if (qty <= reorder) {
                        statusBadge = (
                          <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                            Low Stock
                          </span>
                        )
                      }

                      return (
                        <tr key={item.id} className="hover:bg-neutral-50/80 transition">
                          <td className="px-4 py-3 font-bold text-neutral-900">
                            {item.name}
                            {item.supplier && (
                              <p className="text-[10px] text-neutral-400 font-normal">
                                Supplier: {item.supplier}
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-3 font-mono text-neutral-600">
                            {item.sku || '—'}
                          </td>
                          <td className="px-4 py-3 text-neutral-600">
                            {item.category || 'Bar Item'}
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-bold text-neutral-900">
                              {qty} <span className="text-neutral-400 font-normal">{item.unit || 'Bottles'}</span>
                            </div>
                            <p className="text-[10px] text-neutral-400">
                              Reorder at: {reorder}
                            </p>
                          </td>
                          <td className="px-4 py-3 font-medium text-neutral-700">
                            {currencySymbol}{cost.toFixed(2)}
                          </td>
                          <td className="px-4 py-3 font-medium text-neutral-700">
                            {currencySymbol}{price.toFixed(2)}
                          </td>
                          <td className="px-4 py-3 font-bold text-emerald-700">
                            {currencySymbol}{value.toFixed(2)}
                          </td>
                          <td className="px-4 py-3">{statusBadge}</td>
                          <td className="px-4 py-3 text-right">
                            <div className="inline-flex items-center gap-1">
                              {/* Quick Stock In */}
                              <button
                                onClick={() => {
                                  setStockInTargetItem(item)
                                  setIsStockInModalOpen(true)
                                }}
                                title="Stock In"
                                className="rounded-lg p-1.5 text-emerald-700 hover:bg-emerald-100"
                              >
                                <IconArrowDownLeft />
                              </button>

                              {/* Quick Stock Out */}
                              <button
                                onClick={() => {
                                  setStockOutTargetItem(item)
                                  setIsStockOutModalOpen(true)
                                }}
                                title="Stock Out"
                                className="rounded-lg p-1.5 text-amber-700 hover:bg-amber-100"
                              >
                                <IconArrowUpRight />
                              </button>

                              {/* Quick Adjust */}
                              <button
                                onClick={() => {
                                  setAdjustTargetItem(item)
                                  setIsAdjustModalOpen(true)
                                }}
                                title="Physical Count Adjustment"
                                className="rounded-lg p-1.5 text-purple-700 hover:bg-purple-100"
                              >
                                <IconSliders />
                              </button>

                              {/* Edit */}
                              <button
                                onClick={() => {
                                  setEditingItem(item)
                                  setIsItemModalOpen(true)
                                }}
                                title="Edit Product"
                                className="rounded-lg p-1.5 text-neutral-600 hover:bg-neutral-100"
                              >
                                <IconEdit />
                              </button>

                              {/* Delete */}
                              <button
                                onClick={() => setDeleteConfirmItem(item)}
                                title="Delete Product"
                                className="rounded-lg p-1.5 text-rose-600 hover:bg-rose-100"
                              >
                                <IconTrash />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────────
          TAB 3: LOW STOCK & OUT OF STOCK MANAGEMENT
          ──────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'low_stock' && (
        <div className="space-y-4">
          <div className="card p-5">
            <h3 className="text-base font-bold text-neutral-900">Restock Attention Center</h3>
            <p className="text-xs text-neutral-500 mt-1">
              Items listed here are either out of stock or have reached their designated reorder threshold.
            </p>
          </div>

          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-neutral-200 bg-neutral-50 uppercase tracking-wider text-neutral-500 font-semibold">
                  <tr>
                    <th className="px-4 py-3.5">Product</th>
                    <th className="px-4 py-3.5">Category</th>
                    <th className="px-4 py-3.5">Current Stock</th>
                    <th className="px-4 py-3.5">Reorder Level</th>
                    <th className="px-4 py-3.5">Deficit / Shortage</th>
                    <th className="px-4 py-3.5">Unit Cost</th>
                    <th className="px-4 py-3.5">Supplier</th>
                    <th className="px-4 py-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {metrics.outOfStockList.length === 0 && metrics.lowStockList.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="p-8 text-center text-emerald-700 font-semibold">
                        ✓ Excellent! All bar inventory items are currently at healthy stock levels.
                      </td>
                    </tr>
                  ) : (
                    [...metrics.outOfStockList, ...metrics.lowStockList].map((item) => {
                      const qty = Number(item.currentStock || 0)
                      const reorder = Number(item.reorderLevel ?? 10)
                      const maxStock = item.maxStock ? Number(item.maxStock) : reorder * 2
                      const deficit = Math.max(0, maxStock - qty)

                      return (
                        <tr key={item.id} className="hover:bg-neutral-50/80 transition">
                          <td className="px-4 py-3 font-bold text-neutral-900">
                            {item.name}
                            <span className="block text-[10px] font-mono text-neutral-400">{item.sku || 'No SKU'}</span>
                          </td>
                          <td className="px-4 py-3 text-neutral-600">{item.category}</td>
                          <td className="px-4 py-3">
                            <span
                              className={`font-bold ${
                                qty <= 0 ? 'text-rose-600' : 'text-amber-600'
                              }`}
                            >
                              {qty} {item.unit || 'Bottles'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-neutral-600">{reorder} {item.unit || 'Bottles'}</td>
                          <td className="px-4 py-3 font-semibold text-rose-700">
                            +{deficit} recommended
                          </td>
                          <td className="px-4 py-3 font-medium text-neutral-700">
                            {currencySymbol}{Number(item.costPrice || 0).toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-neutral-600">{item.supplier || '—'}</td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => {
                                setStockInTargetItem(item)
                                setIsStockInModalOpen(true)
                              }}
                              className="btn-green text-xs py-1.5 px-3 flex items-center gap-1.5 ml-auto"
                            >
                              <IconArrowDownLeft /> Restock (+Stock In)
                            </button>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────────
          TAB 4: STOCK MOVEMENTS / AUDIT LEDGER
          ──────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'movements' && (
        <div className="space-y-4">
          {/* Movements Filter Bar */}
          <div className="card p-4 flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:w-72">
              <span className="absolute inset-y-0 left-3 flex items-center text-neutral-400">
                <IconSearch />
              </span>
              <input
                type="text"
                placeholder="Search movements, supplier, invoice..."
                value={movementSearchQuery}
                onChange={(e) => setMovementSearchQuery(e.target.value)}
                className="input-text pl-9 text-xs w-full"
              />
              {movementSearchQuery && (
                <button
                  onClick={() => setMovementSearchQuery('')}
                  className="absolute inset-y-0 right-2.5 flex items-center text-neutral-400 hover:text-neutral-600"
                >
                  <IconX />
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
              <select
                value={movementTypeFilter}
                onChange={(e) => setMovementTypeFilter(e.target.value)}
                className="input-select text-xs"
              >
                <option value="all">All Movement Types</option>
                <option value="stock_in">Stock In</option>
                <option value="stock_out">Stock Out</option>
                <option value="adjustment">Adjustments</option>
                <option value="sale">Sales</option>
                <option value="damage">Damage</option>
                <option value="waste">Waste</option>
                <option value="internal_use">Internal Use</option>
              </select>

              <button
                onClick={handleExportMovementsCSV}
                className="btn-ghost flex items-center gap-1.5 text-xs py-2"
              >
                <IconDownload /> Export Audit CSV
              </button>
            </div>
          </div>

          {/* Movements Table */}
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-neutral-200 bg-neutral-50 uppercase tracking-wider text-neutral-500 font-semibold">
                  <tr>
                    <th className="px-4 py-3.5">Date & Time</th>
                    <th className="px-4 py-3.5">Item Name</th>
                    <th className="px-4 py-3.5">Type</th>
                    <th className="px-4 py-3.5">Change Qty</th>
                    <th className="px-4 py-3.5">Stock Flow</th>
                    <th className="px-4 py-3.5">Supplier / Reason / Invoice</th>
                    <th className="px-4 py-3.5">Logged By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {filteredMovements.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="p-8 text-center text-neutral-400">
                        No stock movement records found.
                      </td>
                    </tr>
                  ) : (
                    filteredMovements.map((mov) => {
                      const isPositive = Number(mov.quantity) > 0
                      const dateObj = mov.createdAt ? new Date(mov.createdAt) : new Date()

                      let typeBadge = (
                        <span className="inline-flex rounded-md bg-neutral-100 px-2 py-0.5 text-[11px] font-semibold text-neutral-800 uppercase">
                          {mov.type}
                        </span>
                      )

                      if (mov.type === 'stock_in') {
                        typeBadge = (
                          <span className="inline-flex rounded-md bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 uppercase">
                            Stock In
                          </span>
                        )
                      } else if (mov.type === 'sale') {
                        typeBadge = (
                          <span className="inline-flex rounded-md bg-blue-100 px-2 py-0.5 text-[11px] font-semibold text-blue-800 uppercase">
                            Sale
                          </span>
                        )
                      } else if (mov.type === 'adjustment') {
                        typeBadge = (
                          <span className="inline-flex rounded-md bg-purple-100 px-2 py-0.5 text-[11px] font-semibold text-purple-800 uppercase">
                            Adjustment
                          </span>
                        )
                      } else if (mov.type === 'damage' || mov.type === 'waste' || mov.type === 'stock_out') {
                        typeBadge = (
                          <span className="inline-flex rounded-md bg-rose-100 px-2 py-0.5 text-[11px] font-semibold text-rose-800 uppercase">
                            {mov.type.replace('_', ' ')}
                          </span>
                        )
                      }

                      return (
                        <tr key={mov.id} className="hover:bg-neutral-50/80 transition">
                          <td className="px-4 py-3 font-mono text-neutral-500 whitespace-nowrap">
                            {dateObj.toLocaleDateString()}{' '}
                            <span className="text-[10px] text-neutral-400">{dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </td>
                          <td className="px-4 py-3 font-bold text-neutral-900">
                            {mov.itemName}
                            {mov.sku && <span className="block text-[10px] font-mono text-neutral-400">{mov.sku}</span>}
                          </td>
                          <td className="px-4 py-3">{typeBadge}</td>
                          <td className="px-4 py-3">
                            <span
                              className={`font-bold ${
                                isPositive ? 'text-emerald-600' : 'text-rose-600'
                              }`}
                            >
                              {isPositive ? `+${mov.quantity}` : mov.quantity}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-mono text-neutral-600">
                            {mov.previousStock ?? '—'} → <span className="font-bold text-neutral-900">{mov.newStock ?? '—'}</span>
                          </td>
                          <td className="px-4 py-3 text-neutral-700 max-w-xs truncate">
                            {mov.supplier && <span className="font-semibold">{mov.supplier} </span>}
                            {mov.invoiceNumber && <span className="text-neutral-500 font-mono">[{mov.invoiceNumber}] </span>}
                            {mov.reason && <span>{mov.reason} </span>}
                            {mov.notes && <span className="text-neutral-400 italic">({mov.notes})</span>}
                            {!mov.supplier && !mov.invoiceNumber && !mov.reason && !mov.notes && '—'}
                          </td>
                          <td className="px-4 py-3 text-neutral-500 font-medium">
                            {mov.user || 'Admin'}
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────────
          TAB 5: VALUATION & REPORTS
          ──────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'reports' && (
        <div className="space-y-6">
          {/* Valuation Summary Card */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="stat-card">
              <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                Total Inventory Cost Valuation
              </p>
              <p className="mt-2 text-3xl font-extrabold text-emerald-700">
                {currencySymbol}
                {metrics.totalInventoryCostValue.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
              <p className="text-xs text-neutral-500 mt-1">Calculated as Current Qty × Unit Cost</p>
            </div>

            <div className="stat-card">
              <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                Total Retail Potential Valuation
              </p>
              <p className="mt-2 text-3xl font-extrabold text-sky-700">
                {currencySymbol}
                {metrics.totalPotentialRetailValue.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
              <p className="text-xs text-neutral-500 mt-1">Calculated as Current Qty × Selling Price</p>
            </div>

            <div className="stat-card">
              <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                Projected Gross Margin
              </p>
              <p className="mt-2 text-3xl font-extrabold text-purple-700">
                {currencySymbol}
                {metrics.potentialProfit.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
              <p className="text-xs text-neutral-500 mt-1">
                {metrics.totalPotentialRetailValue > 0
                  ? `~${((metrics.potentialProfit / metrics.totalPotentialRetailValue) * 100).toFixed(1)}% gross margin`
                  : '0%'}
              </p>
            </div>
          </div>

          {/* Category Valuation Table */}
          <div className="card overflow-hidden p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-neutral-900">Valuation by Bar Category</h3>
                <p className="text-xs text-neutral-500">Breakdown of inventory investment across beverage categories</p>
              </div>
              <button
                onClick={handleExportStockCSV}
                className="btn-green text-xs flex items-center gap-1.5"
              >
                <IconDownload /> Export Valuation Report
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-neutral-200 bg-neutral-50 uppercase tracking-wider text-neutral-500 font-semibold">
                  <tr>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Unique Items</th>
                    <th className="px-4 py-3">Total Qty in Stock</th>
                    <th className="px-4 py-3">Total Cost Value</th>
                    <th className="px-4 py-3">% of Total Inventory</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {Object.entries(metrics.categoryBreakdown)
                    .sort(([, a], [, b]) => b.totalValue - a.totalValue)
                    .map(([catName, data]) => {
                      const share =
                        metrics.totalInventoryCostValue > 0
                          ? (data.totalValue / metrics.totalInventoryCostValue) * 100
                          : 0

                      return (
                        <tr key={catName} className="hover:bg-neutral-50">
                          <td className="px-4 py-3 font-bold text-neutral-900">{catName}</td>
                          <td className="px-4 py-3 text-neutral-600">{data.count} items</td>
                          <td className="px-4 py-3 font-semibold text-neutral-800">{data.totalQty} units</td>
                          <td className="px-4 py-3 font-bold text-emerald-700">
                            {currencySymbol}{data.totalValue.toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-neutral-600">{share.toFixed(1)}%</td>
                        </tr>
                      )
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────────
          MODAL: ADD / EDIT BAR ITEM
          ──────────────────────────────────────────────────────────────────────── */}
      {isItemModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-4 mb-4">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                  <IconBottle />
                </span>
                <h3 className="text-lg font-bold text-neutral-900">
                  {editingItem ? 'Edit Bar Product' : 'Add New Bar Product'}
                </h3>
              </div>
              <button
                onClick={() => setIsItemModalOpen(false)}
                className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
              >
                <IconX />
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-neutral-700 mb-1">
                    Product / Bottle Name *
                  </label>
                  <input
                    type="text"
                    name="itemName"
                    required
                    placeholder="e.g. Jack Daniel's 750ml, Lion Lager 625ml"
                    defaultValue={editingItem?.name || ''}
                    className="input-text w-full text-xs"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">
                    SKU / Item Code / Barcode
                  </label>
                  <input
                    type="text"
                    name="itemSku"
                    placeholder="e.g. BAR-BEER-01"
                    defaultValue={editingItem?.sku || ''}
                    className="input-text w-full text-xs"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">
                    Category *
                  </label>
                  <select
                    name="itemCategory"
                    defaultValue={editingItem?.category || 'Beer'}
                    className="input-select w-full text-xs"
                  >
                    {BAR_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">
                    Current Stock Quantity *
                  </label>
                  <input
                    type="number"
                    name="itemStock"
                    required
                    min="0"
                    step="1"
                    placeholder="0"
                    defaultValue={editingItem?.currentStock ?? 0}
                    className="input-text w-full text-xs"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">
                    Unit of Measurement *
                  </label>
                  <select
                    name="itemUnit"
                    defaultValue={editingItem?.unit || 'Bottles'}
                    className="input-select w-full text-xs"
                  >
                    {DEFAULT_UNITS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">
                    Reorder / Min Stock Level *
                  </label>
                  <input
                    type="number"
                    name="itemReorder"
                    required
                    min="1"
                    step="1"
                    placeholder="10"
                    defaultValue={editingItem?.reorderLevel ?? 10}
                    className="input-text w-full text-xs"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">
                    Max Stock Level (Optional)
                  </label>
                  <input
                    type="number"
                    name="itemMaxStock"
                    min="1"
                    step="1"
                    placeholder="e.g. 50"
                    defaultValue={editingItem?.maxStock || ''}
                    className="input-text w-full text-xs"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">
                    Cost Price ({currencySymbol}) *
                  </label>
                  <input
                    type="number"
                    name="itemCost"
                    required
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    defaultValue={editingItem?.costPrice ?? ''}
                    className="input-text w-full text-xs"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">
                    Selling Price ({currencySymbol}) *
                  </label>
                  <input
                    type="number"
                    name="itemPrice"
                    required
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    defaultValue={editingItem?.sellingPrice ?? ''}
                    className="input-text w-full text-xs"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-semibold text-neutral-700 mb-1">
                    Supplier (Optional)
                  </label>
                  <input
                    type="text"
                    name="itemSupplier"
                    placeholder="e.g. Ceylon Beverage Co., Lion Distributors"
                    defaultValue={editingItem?.supplier || ''}
                    className="input-text w-full text-xs"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-semibold text-neutral-700 mb-1">
                    Link with Menu Item (Optional)
                  </label>
                  <select
                    name="itemLinkedMenu"
                    defaultValue={editingItem?.linkedMenuItemId || ''}
                    className="input-select w-full text-xs"
                  >
                    <option value="">-- No linked menu item --</option>
                    {availableMenuItems.map((mi) => (
                      <option key={mi.id} value={mi.id}>
                        {mi.name} ({mi.section}) - {currencySymbol}{mi.price}
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-neutral-400 mt-1">
                    Linking with a menu item enables seamless automated POS sales deductions.
                  </p>
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-semibold text-neutral-700 mb-1">
                    Notes / Description
                  </label>
                  <textarea
                    name="itemNotes"
                    rows="2"
                    placeholder="Storage location, vintage year, etc."
                    defaultValue={editingItem?.notes || ''}
                    className="input-text w-full text-xs"
                  />
                </div>

                <div className="sm:col-span-2 flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    id="itemTracking"
                    name="itemTracking"
                    defaultChecked={editingItem?.trackingEnabled !== false}
                    className="rounded border-neutral-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <label htmlFor="itemTracking" className="font-semibold text-neutral-800 cursor-pointer">
                    Enable automatic inventory tracking & low-stock alerts for this item
                  </label>
                </div>
              </div>

              <div className="mt-6 flex items-center justify-end gap-3 border-t border-neutral-100 pt-4">
                <button
                  type="button"
                  onClick={() => setIsItemModalOpen(false)}
                  className="btn-ghost text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn-green text-xs font-semibold"
                >
                  {isSubmitting ? 'Saving...' : editingItem ? 'Save Changes' : 'Create Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────────
          MODAL: STOCK IN (RECEIVING STOCK)
          ──────────────────────────────────────────────────────────────────────── */}
      {isStockInModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-4 mb-4">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                  <IconArrowDownLeft />
                </span>
                <div>
                  <h3 className="text-base font-bold text-neutral-900">Stock In (Receive Inventory)</h3>
                  <p className="text-xs text-neutral-500">Record incoming bottles & supplies</p>
                </div>
              </div>
              <button
                onClick={() => setIsStockInModalOpen(false)}
                className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
              >
                <IconX />
              </button>
            </div>

            <form onSubmit={handleStockInSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-neutral-700 mb-1">Select Product *</label>
                <select
                  value={stockInTargetItem?.id || ''}
                  onChange={(e) => {
                    const sel = items.find((i) => i.id === e.target.value)
                    setStockInTargetItem(sel)
                  }}
                  className="input-select w-full text-xs font-medium"
                  required
                >
                  {items.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} (Current: {i.currentStock} {i.unit})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">
                    Quantity to Add (+) *
                  </label>
                  <input
                    type="number"
                    name="stockInQty"
                    required
                    min="1"
                    step="1"
                    placeholder="e.g. 24"
                    className="input-text w-full text-xs font-bold text-emerald-700"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">
                    Cost Price per Unit ({currencySymbol}) *
                  </label>
                  <input
                    type="number"
                    name="stockInCost"
                    required
                    min="0"
                    step="0.01"
                    defaultValue={stockInTargetItem?.costPrice ?? ''}
                    className="input-text w-full text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">Supplier</label>
                  <input
                    type="text"
                    name="stockInSupplier"
                    placeholder="e.g. Lion Brewery"
                    defaultValue={stockInTargetItem?.supplier || ''}
                    className="input-text w-full text-xs"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">Invoice / Ref #</label>
                  <input
                    type="text"
                    name="stockInInvoice"
                    placeholder="e.g. INV-2026-089"
                    className="input-text w-full text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-neutral-700 mb-1">Notes (Optional)</label>
                <textarea
                  name="stockInNotes"
                  rows="2"
                  placeholder="Delivery batch, expiration date, etc."
                  className="input-text w-full text-xs"
                />
              </div>

              <div className="mt-6 flex items-center justify-end gap-3 border-t border-neutral-100 pt-4">
                <button
                  type="button"
                  onClick={() => setIsStockInModalOpen(false)}
                  className="btn-ghost text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn-green text-xs font-semibold"
                >
                  {isSubmitting ? 'Recording...' : '+ Confirm Stock In'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────────
          MODAL: STOCK OUT (MANUAL DEDUCTION)
          ──────────────────────────────────────────────────────────────────────── */}
      {isStockOutModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-4 mb-4">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-100 text-rose-700">
                  <IconArrowUpRight />
                </span>
                <div>
                  <h3 className="text-base font-bold text-neutral-900">Stock Out (Deduct Inventory)</h3>
                  <p className="text-xs text-neutral-500">Record damage, waste, expired, or internal use</p>
                </div>
              </div>
              <button
                onClick={() => setIsStockOutModalOpen(false)}
                className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
              >
                <IconX />
              </button>
            </div>

            <form onSubmit={handleStockOutSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-neutral-700 mb-1">Select Product *</label>
                <select
                  value={stockOutTargetItem?.id || ''}
                  onChange={(e) => {
                    const sel = items.find((i) => i.id === e.target.value)
                    setStockOutTargetItem(sel)
                  }}
                  className="input-select w-full text-xs font-medium"
                  required
                >
                  {items.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} (Current: {i.currentStock} {i.unit})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">
                    Quantity to Remove (-) *
                  </label>
                  <input
                    type="number"
                    name="stockOutQty"
                    required
                    min="1"
                    max={stockOutTargetItem?.currentStock || 9999}
                    step="1"
                    placeholder="e.g. 2"
                    className="input-text w-full text-xs font-bold text-rose-700"
                  />
                  <p className="text-[10px] text-neutral-400 mt-1">
                    Max: {stockOutTargetItem?.currentStock || 0} {stockOutTargetItem?.unit}
                  </p>
                </div>

                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">Reason *</label>
                  <select
                    name="stockOutReason"
                    defaultValue="damaged"
                    className="input-select w-full text-xs font-medium"
                  >
                    {STOCK_OUT_REASONS.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-neutral-700 mb-1">Notes / Explanation</label>
                <textarea
                  name="stockOutNotes"
                  rows="2"
                  placeholder="e.g. Dropped during transport, tasting sample for VIP guest"
                  className="input-text w-full text-xs"
                />
              </div>

              <div className="mt-6 flex items-center justify-end gap-3 border-t border-neutral-100 pt-4">
                <button
                  type="button"
                  onClick={() => setIsStockOutModalOpen(false)}
                  className="btn-ghost text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700 shadow-sm"
                >
                  {isSubmitting ? 'Recording...' : '- Confirm Stock Out'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────────
          MODAL: STOCK ADJUSTMENT (AUDIT / PHYSICAL COUNT)
          ──────────────────────────────────────────────────────────────────────── */}
      {isAdjustModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-4 mb-4">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-100 text-purple-700">
                  <IconSliders />
                </span>
                <div>
                  <h3 className="text-base font-bold text-neutral-900">Stock Count Adjustment</h3>
                  <p className="text-xs text-neutral-500">Correct discrepancies with audit logging</p>
                </div>
              </div>
              <button
                onClick={() => setIsAdjustModalOpen(false)}
                className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
              >
                <IconX />
              </button>
            </div>

            <form onSubmit={handleAdjustSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-neutral-700 mb-1">Select Product *</label>
                <select
                  value={adjustTargetItem?.id || ''}
                  onChange={(e) => {
                    const sel = items.find((i) => i.id === e.target.value)
                    setAdjustTargetItem(sel)
                  }}
                  className="input-select w-full text-xs font-medium"
                  required
                >
                  {items.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} (Current System Count: {i.currentStock} {i.unit})
                    </option>
                  ))}
                </select>
              </div>

              <div className="rounded-xl bg-purple-50/70 border border-purple-200 p-3.5 space-y-1">
                <p className="text-xs font-bold text-purple-900">
                  System Recorded Count: {adjustTargetItem?.currentStock || 0} {adjustTargetItem?.unit || 'units'}
                </p>
                <p className="text-[11px] text-purple-700">
                  Enter the actual physical count found during bar audit. The delta will be recorded in the audit trail.
                </p>
              </div>

              <div>
                <label className="block font-semibold text-neutral-700 mb-1">
                  Actual Physical Count *
                </label>
                <input
                  type="number"
                  name="actualCount"
                  required
                  min="0"
                  step="1"
                  defaultValue={adjustTargetItem?.currentStock ?? 0}
                  className="input-text w-full text-xs font-bold text-purple-800"
                />
              </div>

              <div>
                <label className="block font-semibold text-neutral-700 mb-1">
                  Audit Notes / Reason
                </label>
                <textarea
                  name="adjustNotes"
                  rows="2"
                  placeholder="e.g. End of month physical inventory stocktake count"
                  className="input-text w-full text-xs"
                />
              </div>

              <div className="mt-6 flex items-center justify-end gap-3 border-t border-neutral-100 pt-4">
                <button
                  type="button"
                  onClick={() => setIsAdjustModalOpen(false)}
                  className="btn-ghost text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-xl bg-purple-600 px-4 py-2 text-xs font-semibold text-white hover:bg-purple-700 shadow-sm"
                >
                  {isSubmitting ? 'Adjusting...' : 'Confirm Count Adjustment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────────
          MODAL: DELETE CONFIRMATION
          ──────────────────────────────────────────────────────────────────────── */}
      {deleteConfirmItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl text-center space-y-4">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-rose-600">
              <IconTrash />
            </div>
            <div>
              <h3 className="text-base font-bold text-neutral-900">Delete Bar Product?</h3>
              <p className="text-xs text-neutral-500 mt-1">
                Are you sure you want to remove <strong>{deleteConfirmItem.name}</strong> from inventory?
              </p>
            </div>
            <div className="flex justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmItem(null)}
                className="btn-ghost text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteItem}
                disabled={isSubmitting}
                className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700 shadow-sm"
              >
                {isSubmitting ? 'Deleting...' : 'Delete Product'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
