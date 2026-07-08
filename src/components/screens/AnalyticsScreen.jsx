import { useState, useEffect, useMemo } from 'react'
import { initializeApp, getApps } from 'firebase/app'
import { getFirestore, collection, getDocs } from 'firebase/firestore'
import { IconAnalytics } from '../Icons'

export default function AnalyticsScreen({ profile, restaurantSettings, setActiveSection }) {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [filterRange, setFilterRange] = useState('7d') // 'today', '7d', '30d', 'all'
  const [hoveredPoint, setHoveredPoint] = useState(null) // for chart tooltips
  const [viewMode, setViewMode] = useState('dashboard') // 'dashboard' or 'detailed-items'
  const [detailedFilterRange, setDetailedFilterRange] = useState('7d')
  const [hoveredItemPoint, setHoveredItemPoint] = useState(null)
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  const isConfigured = useMemo(() => {
    return !!(profile?.backupDatabase?.apiKey && profile?.backupDatabase?.projectId && profile?.backupDatabase?.appId)
  }, [profile?.backupDatabase])

  // Fetch orders from backup database
  useEffect(() => {
    if (!isConfigured) return

    let active = true
    const fetchBackupData = async () => {
      setLoading(true)
      setError(null)
      try {
        const config = {
          apiKey: profile.backupDatabase.apiKey,
          authDomain: profile.backupDatabase.authDomain || `${profile.backupDatabase.projectId}.firebaseapp.com`,
          projectId: profile.backupDatabase.projectId,
          storageBucket: profile.backupDatabase.storageBucket || `${profile.backupDatabase.projectId}.appspot.com`,
          messagingSenderId: profile.backupDatabase.messagingSenderId,
          appId: profile.backupDatabase.appId,
        }

        const appName = 'backup_analytics_db'
        let secondaryApp
        const apps = getApps()
        const existingApp = apps.find((app) => app.name === appName)
        if (existingApp) {
          secondaryApp = existingApp
        } else {
          secondaryApp = initializeApp(config, appName)
        }

        const secondaryDb = getFirestore(secondaryApp)
        const ordersRef = collection(secondaryDb, 'orders')
        const querySnapshot = await getDocs(ordersRef)

        const fetchedOrders = []
        querySnapshot.forEach((doc) => {
          const data = doc.data()
          fetchedOrders.push({
            id: doc.id,
            ...data,
          })
        })

        if (active) {
          setOrders(fetchedOrders)
        }
      } catch (err) {
        console.error('Error fetching backup database orders:', err)
        if (active) {
          setError(err.message || 'Could not connect to the cloud backup database. Please check your credentials in Settings.')
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    fetchBackupData()

    return () => {
      active = false
    }
  }, [isConfigured, profile?.backupDatabase])

  // Filter orders by selected date range
  const filteredOrders = useMemo(() => {
    const now = new Date()
    return orders.filter((order) => {
      // Parse order date
      let orderDate
      if (order.createdAt) {
        orderDate = new Date(order.createdAt)
      } else {
        return false
      }

      if (isNaN(orderDate.getTime())) return false

      if (filterRange === 'today') {
        return (
          orderDate.getDate() === now.getDate() &&
          orderDate.getMonth() === now.getMonth() &&
          orderDate.getFullYear() === now.getFullYear()
        )
      } else if (filterRange === '7d') {
        const sevenDaysAgo = new Date()
        sevenDaysAgo.setDate(now.getDate() - 7)
        return orderDate >= sevenDaysAgo
      } else if (filterRange === '30d') {
        const thirtyDaysAgo = new Date()
        thirtyDaysAgo.setDate(now.getDate() - 30)
        return orderDate >= thirtyDaysAgo
      }
      return true // 'all'
    })
  }, [orders, filterRange])

  // Aggregate stats
  const stats = useMemo(() => {
    let totalRevenue = 0
    let totalOrders = 0
    let itemsSold = 0
    let cardFees = 0
    let serviceFees = 0
    let highestOrder = 0

    const paymentMethods = {}
    const orderSources = {}
    const popularItems = {}
    const tableRevenue = {}
    const dailyRevenueMap = {}

    // Sort filtered orders by date
    const sorted = [...filteredOrders].sort((a, b) => {
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    })

    sorted.forEach((order) => {
      // Only count PAID orders
      const isPaid = order.status?.toUpperCase() === 'PAID'
      if (!isPaid) return

      totalOrders += 1
      const orderTotal = Number(order.total || 0)
      totalRevenue += orderTotal
      cardFees += Number(order.cardFeeAmount || 0)
      serviceFees += Number(order.serviceFeeAmount || 0)

      if (orderTotal > highestOrder) {
        highestOrder = orderTotal
      }

      // Payment method
      const payMethod = order.paymentMethod?.toUpperCase() || 'UNKNOWN'
      paymentMethods[payMethod] = (paymentMethods[payMethod] || 0) + orderTotal

      // Source channel
      const source = order.source?.toUpperCase() || 'COUNTER'
      orderSources[source] = (orderSources[source] || 0) + orderTotal

      // Table performance
      if (order.tableNumber !== undefined && order.tableNumber !== null) {
        const tblKey = `Table ${order.tableNumber}`
        tableRevenue[tblKey] = (tableRevenue[tblKey] || 0) + orderTotal
      }

      // Date key for revenue trend (YYYY-MM-DD)
      const dateStr = order.createdAt.split('T')[0]
      dailyRevenueMap[dateStr] = (dailyRevenueMap[dateStr] || 0) + orderTotal

      // Item aggregates
      if (Array.isArray(order.items)) {
        order.items.forEach((item) => {
          const name = item.name || 'Unnamed Item'
          const qty = Number(item.qty || 1)
          const price = Number(item.price || 0)
          const itemTotal = qty * price

          itemsSold += qty
          if (!popularItems[name]) {
            popularItems[name] = { qty: 0, revenue: 0 }
          }
          popularItems[name].qty += qty
          popularItems[name].revenue += itemTotal
        })
      }
    })

    const aov = totalOrders > 0 ? totalRevenue / totalOrders : 0

    // Format daily trend data
    const dailyTrend = Object.keys(dailyRevenueMap)
      .sort()
      .map((date) => {
        const d = new Date(date)
        const formattedDate = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
        return {
          dateStr: formattedDate,
          rawDate: date,
          revenue: dailyRevenueMap[date],
        }
      })

    // Format popular items
    const popularItemsList = Object.keys(popularItems)
      .map((name) => ({
        name,
        qty: popularItems[name].qty,
        revenue: popularItems[name].revenue,
      }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5)

    // Format table performance
    const tablePerformanceList = Object.keys(tableRevenue)
      .map((table) => ({
        table,
        revenue: tableRevenue[table],
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5)

    return {
      totalRevenue,
      totalOrders,
      itemsSold,
      cardFees,
      serviceFees,
      highestOrder,
      aov,
      paymentMethods,
      orderSources,
      popularItemsList,
      tablePerformanceList,
      dailyTrend,
      rawSortedOrders: sorted,
    }
  }, [filteredOrders])

  // SVG Chart Dimensions & Computations
  const chartWidth = 500
  const chartHeight = 200
  const chartPadding = { top: 20, right: 20, bottom: 30, left: 50 }

  const chartPoints = useMemo(() => {
    const trend = stats.dailyTrend
    if (trend.length === 0) return []

    const maxRev = Math.max(...trend.map((t) => t.revenue), 100)
    const xRange = chartWidth - chartPadding.left - chartPadding.right
    const yRange = chartHeight - chartPadding.top - chartPadding.bottom

    return trend.map((t, index) => {
      const x = chartPadding.left + (index / Math.max(trend.length - 1, 1)) * xRange
      const y = chartPadding.top + yRange - (t.revenue / maxRev) * yRange
      return { x, y, date: t.dateStr, revenue: t.revenue }
    })
  }, [stats.dailyTrend])

  const chartPath = useMemo(() => {
    if (chartPoints.length === 0) return ''
    let d = `M ${chartPoints[0].x} ${chartPoints[0].y}`
    for (let i = 1; i < chartPoints.length; i++) {
      // Calculate control points for smooth Bezier curve
      const cpX1 = chartPoints[i - 1].x + (chartPoints[i].x - chartPoints[i - 1].x) / 2
      const cpY1 = chartPoints[i - 1].y
      const cpX2 = chartPoints[i - 1].x + (chartPoints[i].x - chartPoints[i - 1].x) / 2
      const cpY2 = chartPoints[i].y
      d += ` C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${chartPoints[i].x} ${chartPoints[i].y}`
    }
    return d
  }, [chartPoints])

  const chartAreaPath = useMemo(() => {
    if (chartPoints.length === 0) return ''
    const bottomY = chartHeight - chartPadding.bottom
    let d = chartPath
    d += ` L ${chartPoints[chartPoints.length - 1].x} ${bottomY}`
    d += ` L ${chartPoints[0].x} ${bottomY} Z`
    return d
  }, [chartPoints, chartPath])



  const allItemsStats = useMemo(() => {
    const now = new Date()
    
    // First, filter orders in the date range
    const filteredOrdersForItems = orders.filter((order) => {
      let orderDate
      if (order.createdAt) {
        orderDate = new Date(order.createdAt)
      } else {
        return false
      }
      if (isNaN(orderDate.getTime())) return false

      if (detailedFilterRange === 'today') {
        return (
          orderDate.getDate() === now.getDate() &&
          orderDate.getMonth() === now.getMonth() &&
          orderDate.getFullYear() === now.getFullYear()
        )
      } else if (detailedFilterRange === '7d') {
        const sevenDaysAgo = new Date()
        sevenDaysAgo.setDate(now.getDate() - 7)
        return orderDate >= sevenDaysAgo
      } else if (detailedFilterRange === '30d') {
        const thirtyDaysAgo = new Date()
        thirtyDaysAgo.setDate(now.getDate() - 30)
        return orderDate >= thirtyDaysAgo
      } else if (detailedFilterRange === 'custom') {
        if (!customStartDate || !customEndDate) return true
        const start = new Date(customStartDate + 'T00:00:00')
        const end = new Date(customEndDate + 'T23:59:59')
        return orderDate >= start && orderDate <= end
      }
      return true // 'all'
    })

    // Now, aggregate details for all items across these orders
    const itemsMap = {}
    const dailySalesMap = {} // dateStr -> totalSalesForDay
    let totalPeriodRevenue = 0
    let totalPeriodQty = 0

    // Compute overall total item revenue in this period to keep contribution percentages correct
    let overallRevenue = 0
    filteredOrdersForItems.forEach((order) => {
      const isPaid = order.status?.toUpperCase() === 'PAID'
      if (!isPaid) return
      if (Array.isArray(order.items)) {
        order.items.forEach((item) => {
          overallRevenue += Number(item.qty || 1) * Number(item.price || 0)
        })
      }
    })

    filteredOrdersForItems.forEach((order) => {
      const isPaid = order.status?.toUpperCase() === 'PAID'
      if (!isPaid) return

      const dateStr = order.createdAt.split('T')[0]

      if (Array.isArray(order.items)) {
        order.items.forEach((item) => {
          const name = item.name || 'Unnamed Item'

          // Apply search query filter if provided
          if (searchQuery && !name.toLowerCase().includes(searchQuery.toLowerCase())) {
            return
          }

          const qty = Number(item.qty || 1)
          const price = Number(item.price || 0)
          const itemTotal = qty * price

          totalPeriodQty += qty
          totalPeriodRevenue += itemTotal
          dailySalesMap[dateStr] = (dailySalesMap[dateStr] || 0) + itemTotal

          if (!itemsMap[name]) {
            itemsMap[name] = {
              name,
              qty: 0,
              revenue: 0,
              prices: [],
            }
          }
          itemsMap[name].qty += qty
          itemsMap[name].revenue += itemTotal
          itemsMap[name].prices.push(price)
        })
      }
    })

    // Convert items map to sorted array
    const itemsList = Object.keys(itemsMap).map((name) => {
      const item = itemsMap[name]
      const avgPrice = item.qty > 0 ? item.revenue / item.qty : (item.prices.length > 0 ? item.prices.reduce((a,b)=>a+b, 0) / item.prices.length : 0)
      const contributionPct = overallRevenue > 0 ? (item.revenue / overallRevenue) * 100 : 0
      return {
        name,
        qty: item.qty,
        revenue: item.revenue,
        avgPrice,
        contributionPct,
      }
    }).sort((a, b) => b.qty - a.qty)

    // Format daily sales trend for the chart
    const dailyTrend = Object.keys(dailySalesMap)
      .sort()
      .map((date) => {
        const d = new Date(date)
        const formattedDate = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
        return {
          dateStr: formattedDate,
          rawDate: date,
          earnings: dailySalesMap[date],
        }
      })

    return {
      itemsList,
      dailyTrend,
      totalPeriodRevenue,
      totalPeriodQty,
    }
  }, [orders, detailedFilterRange, customStartDate, customEndDate, searchQuery])

  const detailedChartPoints = useMemo(() => {
    const trend = allItemsStats.dailyTrend
    if (trend.length === 0) return []

    const maxEarn = Math.max(...trend.map((t) => t.earnings), 10)
    const xRange = chartWidth - chartPadding.left - chartPadding.right
    const yRange = chartHeight - chartPadding.top - chartPadding.bottom

    return trend.map((t, index) => {
      const x = chartPadding.left + (index / Math.max(trend.length - 1, 1)) * xRange
      const y = chartPadding.top + yRange - (t.earnings / maxEarn) * yRange
      return { x, y, date: t.dateStr, earnings: t.earnings }
    })
  }, [allItemsStats])

  const detailedChartPath = useMemo(() => {
    if (detailedChartPoints.length === 0) return ''
    let d = `M ${detailedChartPoints[0].x} ${detailedChartPoints[0].y}`
    for (let i = 1; i < detailedChartPoints.length; i++) {
      const cpX1 = detailedChartPoints[i - 1].x + (detailedChartPoints[i].x - detailedChartPoints[i - 1].x) / 2
      const cpY1 = detailedChartPoints[i - 1].y
      const cpX2 = detailedChartPoints[i - 1].x + (detailedChartPoints[i].x - detailedChartPoints[i - 1].x) / 2
      const cpY2 = detailedChartPoints[i].y
      d += ` C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${detailedChartPoints[i].x} ${detailedChartPoints[i].y}`
    }
    return d
  }, [detailedChartPoints])

  const detailedChartAreaPath = useMemo(() => {
    if (detailedChartPoints.length === 0) return ''
    const bottomY = chartHeight - chartPadding.bottom
    let d = detailedChartPath
    d += ` L ${detailedChartPoints[detailedChartPoints.length - 1].x} ${bottomY}`
    d += ` L ${detailedChartPoints[0].x} ${bottomY} Z`
    return d
  }, [detailedChartPoints, detailedChartPath])

  const currencySymbol = restaurantSettings?.currency === 'LKR' ? 'Rs. ' : '$'

  // Render unconfigured UI state
  if (!isConfigured) {
    return (
      <div className="p-6 sm:p-8 flex flex-col items-center justify-center min-h-[70vh] max-w-xl mx-auto text-center">
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-3xl" style={{ background: 'linear-gradient(135deg, #dcfce7, #bbf7d0)' }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="20" x2="18" y2="10" />
            <line x1="12" y1="20" x2="12" y2="4" />
            <line x1="6" y1="20" x2="6" y2="14" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-neutral-900">Unlock Restaurant Analytics</h2>
        <p className="mt-3 text-sm text-neutral-500 leading-relaxed">
          Link your restaurant POS cloud database in Settings to access live revenue data, order tracking, popular menu item insights, and fee breakdowns.
        </p>
        <button
          onClick={() => setActiveSection('settings')}
          className="btn-green mt-8 flex items-center gap-2 px-6 py-3 font-semibold"
        >
          Setup Database Connection
        </button>
      </div>
    )
  }

  // Render loading state
  if (loading) {
    return (
      <div className="p-6 sm:p-8 space-y-6">
        <div className="flex items-center justify-between border-b pb-4">
          <div className="h-8 w-48 bg-neutral-200 rounded animate-pulse" />
          <div className="h-10 w-32 bg-neutral-200 rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-white border border-neutral-100 rounded-2xl p-5 space-y-3 shadow-sm animate-pulse">
              <div className="h-4 w-20 bg-neutral-200 rounded" />
              <div className="h-8 w-28 bg-neutral-200 rounded" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-72 bg-white border border-neutral-100 rounded-2xl shadow-sm animate-pulse" />
          <div className="h-72 bg-white border border-neutral-100 rounded-2xl shadow-sm animate-pulse" />
        </div>
      </div>
    )
  }

  // Render error state
  if (error) {
    return (
      <div className="p-6 sm:p-8 flex flex-col items-center justify-center min-h-[70vh] max-w-xl mx-auto text-center">
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-red-50 text-red-500">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-neutral-900">Database Connection Failed</h2>
        <p className="mt-3 text-sm text-red-600 leading-relaxed border border-red-200 bg-red-50/50 p-4 rounded-xl font-mono text-left text-xs max-w-lg">
          {error}
        </p>
        <div className="mt-8 flex gap-4">
          <button
            onClick={() => window.location.reload()}
            className="btn-ghost px-5 py-2.5 font-semibold text-sm"
          >
            Retry Connection
          </button>
          <button
            onClick={() => setActiveSection('settings')}
            className="btn-green px-5 py-2.5 font-semibold text-sm"
          >
            Check Credentials
          </button>
        </div>
      </div>
    )
  }

  if (viewMode === 'detailed-items') {
    return (
      <div className="p-6 sm:p-8 space-y-6">
        {/* Back Button & Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-green-100 pb-4">
          <div>
            <button
              onClick={() => {
                setHoveredItemPoint(null)
                setViewMode('dashboard')
              }}
              className="flex items-center gap-1.5 text-xs font-bold text-neutral-500 hover:text-green-600 transition uppercase tracking-wider mb-2"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="19" y1="12" x2="5" y2="12" strokeLinecap="round" strokeLinejoin="round" />
                <polyline points="12 19 5 12 12 5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Back to Dashboard
            </button>
            <h2 className="text-2xl font-bold text-neutral-900 flex items-center gap-2">
              Menu Items Analytics
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Timeframe Filter Dropdown */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-neutral-500 font-semibold">Timeframe:</span>
              <select
                value={detailedFilterRange}
                onChange={(e) => {
                  setHoveredItemPoint(null)
                  setDetailedFilterRange(e.target.value)
                }}
                className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 outline-none transition focus:border-green-500"
              >
                <option value="today">Today</option>
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
                <option value="all">All Time</option>
                <option value="custom">Custom Range...</option>
              </select>

              {detailedFilterRange === 'custom' && (
                <div className="flex items-center gap-1.5 ml-2">
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="rounded-lg border border-neutral-300 bg-white px-2 py-1 text-xs font-semibold text-neutral-700 outline-none focus:border-green-500"
                  />
                  <span className="text-xs text-neutral-400 font-bold">to</span>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="rounded-lg border border-neutral-300 bg-white px-2 py-1 text-xs font-semibold text-neutral-700 outline-none focus:border-green-500"
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Detailed KPI Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Quantity */}
          <div className="relative overflow-hidden rounded-2xl p-5 text-white shadow-sm" style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)' }}>
            <div className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full bg-white/10" />
            <p className="text-xs font-bold uppercase tracking-widest text-indigo-100">Total Items Sold</p>
            <p className="mt-3 text-3xl font-extrabold">{allItemsStats.totalPeriodQty}</p>
            <div className="mt-3 text-xs text-indigo-100/90 font-medium">
              <span>Units sold in timeframe</span>
            </div>
          </div>

          {/* Total Earnings */}
          <div className="relative overflow-hidden rounded-2xl p-5 text-white shadow-sm" style={{ background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)' }}>
            <div className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full bg-white/10" />
            <p className="text-xs font-bold uppercase tracking-widest text-emerald-100">Revenue Earned</p>
            <p className="mt-3 text-3xl font-extrabold">
              {currencySymbol}
              {allItemsStats.totalPeriodRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <div className="mt-3 text-xs text-emerald-100/90 font-medium">
              <span>Direct sales income</span>
            </div>
          </div>

          {/* Unique Items Sold */}
          <div className="relative overflow-hidden rounded-2xl p-5 text-white shadow-sm" style={{ background: 'linear-gradient(135deg, #d97706 0%, #f59e0b 100%)' }}>
            <div className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full bg-white/10" />
            <p className="text-xs font-bold uppercase tracking-widest text-amber-100">Unique Items Sold</p>
            <p className="mt-3 text-3xl font-extrabold">
              {allItemsStats.itemsList.length}
            </p>
            <div className="mt-3 text-xs text-amber-100/90 font-medium">
              <span>Menu items active</span>
            </div>
          </div>

          {/* Active Sales Days */}
          <div className="relative overflow-hidden rounded-2xl p-5 text-white shadow-sm" style={{ background: 'linear-gradient(135deg, #db2777 0%, #ec4899 100%)' }}>
            <div className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full bg-white/10" />
            <p className="text-xs font-bold uppercase tracking-widest text-pink-100">Active Sales Days</p>
            <p className="mt-3 text-3xl font-extrabold">
              {allItemsStats.dailyTrend.length}
            </p>
            <div className="mt-3 text-xs text-pink-100/90 font-medium">
              <span>Days with POS transactions</span>
            </div>
          </div>
        </div>

        {/* Daily Sales Chart */}
        <div className="card p-5 flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-neutral-900">Per Day Total Sales</h3>
            <p className="text-xs text-neutral-500">Gross revenue generated per day for all menu items</p>
          </div>

          <div className="mt-6 relative h-[210px] w-full">
            {allItemsStats.dailyTrend.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-neutral-400 font-medium">
                No sales recorded in this timeframe.
              </div>
            ) : (
              <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="h-full w-full overflow-visible">
                <defs>
                  <linearGradient id="itemChartGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="#6366f1" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Y Grid Lines */}
                {[0, 0.25, 0.5, 0.75, 1].map((val, idx) => {
                  const maxEarn = Math.max(...allItemsStats.dailyTrend.map((t) => t.earnings), 10)
                  const lineY = chartPadding.top + val * (chartHeight - chartPadding.top - chartPadding.bottom)
                  const textLabel = (maxRev => (maxRev * (1 - val)).toFixed(0))(maxEarn)
                  return (
                    <g key={idx}>
                      <line
                        x1={chartPadding.left}
                        y1={lineY}
                        x2={chartWidth - chartPadding.right}
                        y2={lineY}
                        stroke="#e5e7eb"
                        strokeWidth="1"
                        strokeDasharray="4 4"
                      />
                      <text
                        x={chartPadding.left - 10}
                        y={lineY + 4}
                        fill="#9ca3af"
                        fontSize="9"
                        fontWeight="600"
                        textAnchor="end"
                      >
                        {currencySymbol}{textLabel}
                      </text>
                    </g>
                  )
                })}

                {/* Area under curve */}
                <path d={detailedChartAreaPath} fill="url(#itemChartGradient)" />

                {/* Main Curved Line */}
                <path d={detailedChartPath} fill="none" stroke="#6366f1" strokeWidth="3" strokeLinecap="round" />

                {/* Point nodes & interaction */}
                {detailedChartPoints.map((pt, idx) => (
                  <g key={idx}>
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r="4"
                      fill="#ffffff"
                      stroke="#6366f1"
                      strokeWidth="2.5"
                      className="cursor-pointer transition-transform hover:scale-150"
                      onMouseEnter={() => setHoveredItemPoint(pt)}
                      onMouseLeave={() => setHoveredItemPoint(null)}
                    />
                  </g>
                ))}

                {/* X Axis Labels */}
                {detailedChartPoints.map((pt, idx) => {
                  const step = Math.ceil(detailedChartPoints.length / 6)
                  if (idx % step !== 0 && idx !== detailedChartPoints.length - 1) return null

                  return (
                    <text
                      key={idx}
                      x={pt.x}
                      y={chartHeight - 10}
                      fill="#9ca3af"
                      fontSize="9"
                      fontWeight="600"
                      textAnchor="middle"
                    >
                      {pt.date}
                    </text>
                  )
                })}
              </svg>
            )}

            {/* Hover Tooltip */}
            {hoveredItemPoint && (
              <div
                className="absolute z-10 rounded-xl bg-neutral-900 p-2.5 text-xs text-white shadow-md border border-neutral-800"
                style={{
                  left: `${(hoveredItemPoint.x / chartWidth) * 100}%`,
                  top: `${(hoveredItemPoint.y / chartHeight) * 100 - 25}%`,
                  transform: 'translate(-50%, -100%)',
                }}
              >
                <p className="font-semibold text-neutral-400">{hoveredItemPoint.date}</p>
                <p className="mt-0.5 font-bold text-sm">
                  {currencySymbol}
                  {hoveredItemPoint.earnings.toFixed(2)}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* All Items Performance Table */}
        <div className="card p-5 overflow-hidden space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-neutral-900">Menu Items Performance</h3>
              <p className="text-xs text-neutral-500">List of all items sold with quantities, pricing, and revenue share</p>
            </div>

            {/* Search Input Box */}
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <svg className="w-4 h-4 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </span>
              <input
                type="text"
                placeholder="Filter by item name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-1.5 w-full sm:w-60 text-xs font-semibold rounded-lg border border-neutral-300 bg-white text-neutral-700 placeholder-neutral-400 outline-none transition focus:border-green-500 focus:ring-1 focus:ring-green-500"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-neutral-100 text-neutral-400 uppercase font-bold tracking-wider">
                  <th className="py-2.5 font-semibold">Item Name</th>
                  <th className="py-2.5 font-semibold text-center">Quantity Sold</th>
                  <th className="py-2.5 font-semibold text-right">Avg Unit Price</th>
                  <th className="py-2.5 font-semibold text-right">Total Revenue</th>
                  <th className="py-2.5 font-semibold text-right">Revenue Share</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-50 font-medium text-neutral-700">
                {allItemsStats.itemsList.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="py-6 text-center text-neutral-400 font-medium">
                      No sales recorded in this timeframe.
                    </td>
                  </tr>
                ) : (
                  allItemsStats.itemsList.map((item) => (
                    <tr key={item.name} className="hover:bg-neutral-50/50">
                      <td className="py-3 font-bold text-neutral-900">{item.name}</td>
                      <td className="py-3 text-center text-neutral-800 font-semibold">{item.qty}</td>
                      <td className="py-3 text-right text-neutral-600">
                        {currencySymbol}
                        {item.avgPrice.toFixed(2)}
                      </td>
                      <td className="py-3 text-right font-extrabold text-neutral-900">
                        {currencySymbol}
                        {item.revenue.toFixed(2)}
                      </td>
                      <td className="py-3 text-right">
                        <span className="badge-green font-bold text-[10px]">
                          {item.contributionPct.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 sm:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-green-100 pb-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500">POS Sales</p>
          <h2 className="mt-1 text-2xl font-bold text-neutral-900 flex items-center gap-2">
            Restaurant Analytics
            <span className="flex items-center gap-1 text-[11px] font-semibold text-green-700 bg-green-50 border border-green-200 rounded-full px-2 py-0.5">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-ping" />
              Connected
            </span>
          </h2>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-center">
          <span className="text-xs text-neutral-500 font-medium mr-1">Timeframe:</span>
          {['today', '7d', '30d', 'all'].map((range) => (
            <button
              key={range}
              onClick={() => setFilterRange(range)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold uppercase transition ${
                filterRange === range
                  ? 'bg-green-600 text-white shadow-sm'
                  : 'bg-white border border-neutral-200 text-neutral-600 hover:bg-neutral-50'
              }`}
            >
              {range === '7d' ? '7 Days' : range === '30d' ? '30 Days' : range}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Revenue */}
        <div
          className="relative overflow-hidden rounded-2xl p-5 text-white shadow-sm"
          style={{ background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)' }}
        >
          <div className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full bg-white/10" />
          <p className="text-xs font-bold uppercase tracking-widest text-emerald-100">Revenue</p>
          <p className="mt-3 text-3xl font-extrabold">{currencySymbol}{stats.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          <div className="mt-3 flex items-center justify-between text-xs text-emerald-100/90 font-medium">
            <span>Card Fees: {currencySymbol}{stats.cardFees.toFixed(2)}</span>
            <span>Service Fees: {currencySymbol}{stats.serviceFees.toFixed(2)}</span>
          </div>
        </div>

        {/* Orders */}
        <div
          className="relative overflow-hidden rounded-2xl p-5 text-white shadow-sm"
          style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)' }}
        >
          <div className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full bg-white/10" />
          <p className="text-xs font-bold uppercase tracking-widest text-indigo-100">Orders</p>
          <p className="mt-3 text-3xl font-extrabold">{stats.totalOrders}</p>
          <div className="mt-3 text-xs text-indigo-100/90 font-medium">
            <span>Completed POS checkouts</span>
          </div>
        </div>

        {/* Average Order Value (AOV) */}
        <div
          className="relative overflow-hidden rounded-2xl p-5 text-white shadow-sm"
          style={{ background: 'linear-gradient(135deg, #d97706 0%, #f59e0b 100%)' }}
        >
          <div className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full bg-white/10" />
          <p className="text-xs font-bold uppercase tracking-widest text-amber-100">Average Order (AOV)</p>
          <p className="mt-3 text-3xl font-extrabold">{currencySymbol}{stats.aov.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          <div className="mt-3 text-xs text-amber-100/90 font-medium">
            <span>Max Order: {currencySymbol}{stats.highestOrder.toFixed(2)}</span>
          </div>
        </div>

        {/* Items Sold */}
        <div
          className="relative overflow-hidden rounded-2xl p-5 text-white shadow-sm"
          style={{ background: 'linear-gradient(135deg, #db2777 0%, #ec4899 100%)' }}
        >
          <div className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full bg-white/10" />
          <p className="text-xs font-bold uppercase tracking-widest text-pink-100">Items Sold</p>
          <p className="mt-3 text-3xl font-extrabold">{stats.itemsSold}</p>
          <div className="mt-3 text-xs text-pink-100/90 font-medium">
            <span>Avg items/order: {stats.totalOrders > 0 ? (stats.itemsSold / stats.totalOrders).toFixed(1) : 0}</span>
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Trend Line Chart */}
        <div className="card lg:col-span-2 p-5 flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-neutral-900">Revenue Trend</h3>
            <p className="text-xs text-neutral-500">Sales volume performance over selected period</p>
          </div>

          <div className="mt-6 relative h-[210px] w-full">
            {stats.dailyTrend.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-neutral-400 font-medium">
                No paid orders recorded in this period.
              </div>
            ) : (
              <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="h-full w-full overflow-visible">
                <defs>
                  <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Y Grid Lines */}
                {[0, 0.25, 0.5, 0.75, 1].map((val, idx) => {
                  const maxRev = Math.max(...stats.dailyTrend.map((t) => t.revenue), 100)
                  const lineY = chartPadding.top + val * (chartHeight - chartPadding.top - chartPadding.bottom)
                  const textLabel = (maxRev * (1 - val)).toFixed(0)
                  return (
                    <g key={idx}>
                      <line
                        x1={chartPadding.left}
                        y1={lineY}
                        x2={chartWidth - chartPadding.right}
                        y2={lineY}
                        stroke="#e5e7eb"
                        strokeWidth="1"
                        strokeDasharray="4 4"
                      />
                      <text
                        x={chartPadding.left - 10}
                        y={lineY + 4}
                        fill="#9ca3af"
                        fontSize="9"
                        fontWeight="600"
                        textAnchor="end"
                      >
                        {currencySymbol}{textLabel}
                      </text>
                    </g>
                  )
                })}

                {/* Area under curve */}
                <path d={chartAreaPath} fill="url(#chartGradient)" />

                {/* Main Curved Line */}
                <path d={chartPath} fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" />

                {/* Point nodes & interaction */}
                {chartPoints.map((pt, idx) => (
                  <g key={idx}>
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r="4"
                      fill="#ffffff"
                      stroke="#10b981"
                      strokeWidth="2.5"
                      className="cursor-pointer transition-transform hover:scale-150"
                      onMouseEnter={() => setHoveredPoint(pt)}
                      onMouseLeave={() => setHoveredPoint(null)}
                    />
                  </g>
                ))}

                {/* X Axis Labels */}
                {chartPoints.map((pt, idx) => {
                  // Only show subset of labels if there are too many points
                  const step = Math.ceil(chartPoints.length / 6)
                  if (idx % step !== 0 && idx !== chartPoints.length - 1) return null

                  return (
                    <text
                      key={idx}
                      x={pt.x}
                      y={chartHeight - 10}
                      fill="#9ca3af"
                      fontSize="9"
                      fontWeight="600"
                      textAnchor="middle"
                    >
                      {pt.date}
                    </text>
                  )
                })}
              </svg>
            )}

            {/* Hover Tooltip */}
            {hoveredPoint && (
              <div
                className="absolute z-10 rounded-xl bg-neutral-900 p-2.5 text-xs text-white shadow-md border border-neutral-800"
                style={{
                  left: `${(hoveredPoint.x / chartWidth) * 100}%`,
                  top: `${(hoveredPoint.y / chartHeight) * 100 - 25}%`,
                  transform: 'translate(-50%, -100%)',
                }}
              >
                <p className="font-semibold text-neutral-400">{hoveredPoint.date}</p>
                <p className="mt-0.5 font-bold text-sm">
                  {currencySymbol}
                  {hoveredPoint.revenue.toFixed(2)}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Popular Items Horizontal Bar Chart */}
        <div className="card p-5">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="text-base font-bold text-neutral-900">Popular Items</h3>
              <p className="text-xs text-neutral-500">Top menu choices by quantities sold</p>
            </div>
            <button
              onClick={() => {
                setViewMode('detailed-items')
              }}
              className="text-xs font-semibold text-green-600 hover:text-green-700 hover:underline transition"
            >
              View Details →
            </button>
          </div>

          <div className="mt-4 space-y-4">
            {stats.popularItemsList.length === 0 ? (
              <div className="flex h-44 items-center justify-center text-sm text-neutral-400 font-medium">
                No items sold yet.
              </div>
            ) : (
              stats.popularItemsList.map((item, idx) => {
                const maxQty = Math.max(...stats.popularItemsList.map((i) => i.qty), 1)
                const percentage = (item.qty / maxQty) * 100
                const colors = ['bg-emerald-500', 'bg-indigo-500', 'bg-amber-500', 'bg-pink-500', 'bg-sky-500']

                return (
                  <div key={idx} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-bold text-neutral-800 truncate max-w-[150px]">{item.name}</span>
                      <span className="font-medium text-neutral-500">
                        {item.qty} sold ({currencySymbol}
                        {item.revenue.toFixed(2)})
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-neutral-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${colors[idx % colors.length]}`}
                        style={{ width: `${percentage}%`, transition: 'width 0.5s ease-out' }}
                      />
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>

      {/* Detailed Insights Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Payment Methods & Channels */}
        <div className="card p-5 space-y-6">
          <div>
            <h3 className="text-base font-bold text-neutral-900">Channels & Payment Types</h3>
            <p className="text-xs text-neutral-500">Breakdown of orders and transaction value</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Payment Method Breakdown */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-widest text-neutral-400">Payment Types</h4>
              <div className="space-y-3">
                {Object.keys(stats.paymentMethods).length === 0 ? (
                  <p className="text-xs text-neutral-400 font-medium">No sales recorded.</p>
                ) : (
                  Object.keys(stats.paymentMethods).map((method) => {
                    const value = stats.paymentMethods[method]
                    const pct = (value / stats.totalRevenue) * 100
                    return (
                      <div key={method} className="space-y-1">
                        <div className="flex justify-between text-xs font-semibold text-neutral-700">
                          <span>{method}</span>
                          <span>
                            {pct.toFixed(0)}% ({currencySymbol}
                            {value.toFixed(2)})
                          </span>
                        </div>
                        <div className="h-1.5 w-full bg-neutral-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${method === 'CARD' ? 'bg-emerald-500' : 'bg-amber-500'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>

            {/* Channels Breakdown */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-widest text-neutral-400">Order Source</h4>
              <div className="space-y-3">
                {Object.keys(stats.orderSources).length === 0 ? (
                  <p className="text-xs text-neutral-400 font-medium">No sales recorded.</p>
                ) : (
                  Object.keys(stats.orderSources).map((source) => {
                    const value = stats.orderSources[source]
                    const pct = (value / stats.totalRevenue) * 100
                    const colors = {
                      COUNTER: 'bg-indigo-500',
                      TABLE: 'bg-pink-500',
                      ONLINE: 'bg-sky-500',
                    }
                    return (
                      <div key={source} className="space-y-1">
                        <div className="flex justify-between text-xs font-semibold text-neutral-700">
                          <span>{source}</span>
                          <span>
                            {pct.toFixed(0)}% ({currencySymbol}
                            {value.toFixed(2)})
                          </span>
                        </div>
                        <div className="h-1.5 w-full bg-neutral-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${colors[source] || 'bg-neutral-400'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Table Performance */}
        <div className="card p-5">
          <h3 className="text-base font-bold text-neutral-900">Table Sales Performance</h3>
          <p className="text-xs text-neutral-500 mb-4">Top performing tables based on total billing</p>

          <div className="space-y-4">
            {stats.tablePerformanceList.length === 0 ? (
              <div className="flex h-40 items-center justify-center text-sm text-neutral-400 font-medium">
                No dine-in table transactions recorded in this timeframe.
              </div>
            ) : (
              stats.tablePerformanceList.map((tbl, idx) => {
                const maxTableRev = Math.max(...stats.tablePerformanceList.map((t) => t.revenue), 1)
                const percentage = (tbl.revenue / maxTableRev) * 100

                return (
                  <div key={idx} className="space-y-1">
                    <div className="flex justify-between text-xs font-bold text-neutral-700">
                      <span>{tbl.table}</span>
                      <span>
                        {currencySymbol}
                        {tbl.revenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-neutral-100 overflow-hidden">
                      <div className="h-full rounded-full bg-green-500" style={{ width: `${percentage}%` }} />
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="card p-5 overflow-hidden">
        <div className="mb-4">
          <h3 className="text-base font-bold text-neutral-900">Recent Transactions</h3>
          <p className="text-xs text-neutral-500">Last checkout operations synced from POS app</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-neutral-100 text-neutral-400 uppercase font-bold tracking-wider">
                <th className="py-2.5 font-semibold">Order ID</th>
                <th className="py-2.5 font-semibold">Date/Time</th>
                <th className="py-2.5 font-semibold">Table</th>
                <th className="py-2.5 font-semibold">Source</th>
                <th className="py-2.5 font-semibold">Payment</th>
                <th className="py-2.5 font-semibold">Items</th>
                <th className="py-2.5 font-semibold text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-50 font-medium text-neutral-700">
              {stats.rawSortedOrders.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-6 text-center text-neutral-400 font-medium">
                    No transactions to show.
                  </td>
                </tr>
              ) : (
                [...stats.rawSortedOrders]
                  .reverse()
                  .slice(0, 5)
                  .map((order) => {
                    const date = new Date(order.createdAt)
                    const formattedDate = date.toLocaleString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                    const itemsCount = Array.isArray(order.items)
                      ? order.items.reduce((acc, item) => acc + (item.qty || 1), 0)
                      : 0

                    return (
                      <tr key={order.id} className="hover:bg-neutral-50/50">
                        <td className="py-3 font-mono font-bold text-neutral-900">#{order.id}</td>
                        <td className="py-3 text-neutral-500">{formattedDate}</td>
                        <td className="py-3">
                          {order.tableNumber !== undefined && order.tableNumber !== null
                            ? `Table ${order.tableNumber}`
                            : 'Walk-in'}
                        </td>
                        <td className="py-3">
                          <span
                            className={`badge-green font-bold text-[10px] ${
                              order.source === 'ONLINE' ? 'bg-sky-50 text-sky-700 border-sky-200' : ''
                            }`}
                          >
                            {order.source || 'COUNTER'}
                          </span>
                        </td>
                        <td className="py-3">
                          <span
                            className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                              order.paymentMethod === 'CARD'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-amber-50 text-amber-700 border border-amber-200'
                            }`}
                          >
                            {order.paymentMethod || 'CASH'}
                          </span>
                        </td>
                        <td className="py-3 text-neutral-500">{itemsCount} items</td>
                        <td className="py-3 text-right font-extrabold text-neutral-900">
                          {currencySymbol}
                          {Number(order.total || 0).toFixed(2)}
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
  )
}
