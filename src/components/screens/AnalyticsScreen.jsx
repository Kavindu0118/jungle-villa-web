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
  const [detailedItemName, setDetailedItemName] = useState('')
  const [detailedFilterRange, setDetailedFilterRange] = useState('7d')
  const [hoveredItemPoint, setHoveredItemPoint] = useState(null)

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



  const allUniqueItems = useMemo(() => {
    const names = new Set()
    orders.forEach((order) => {
      if (Array.isArray(order.items)) {
        order.items.forEach((item) => {
          if (item.name) names.add(item.name)
        })
      }
    })
    return Array.from(names).sort()
  }, [orders])

  const itemDetailedStats = useMemo(() => {
    if (!detailedItemName) return null

    const now = new Date()
    
    const itemOrders = orders.filter((order) => {
      let orderDate
      if (order.createdAt) {
        orderDate = new Date(order.createdAt)
      } else {
        return false
      }
      if (isNaN(orderDate.getTime())) return false

      if (detailedFilterRange === 'today') {
        if (!(orderDate.getDate() === now.getDate() &&
              orderDate.getMonth() === now.getMonth() &&
              orderDate.getFullYear() === now.getFullYear())) {
          return false
        }
      } else if (detailedFilterRange === '7d') {
        const sevenDaysAgo = new Date()
        sevenDaysAgo.setDate(now.getDate() - 7)
        if (orderDate < sevenDaysAgo) return false
      } else if (detailedFilterRange === '30d') {
        const thirtyDaysAgo = new Date()
        thirtyDaysAgo.setDate(now.getDate() - 30)
        if (orderDate < thirtyDaysAgo) return false
      }

      const hasItem = Array.isArray(order.items) && order.items.some(it => it.name === detailedItemName)
      return hasItem && order.status?.toUpperCase() === 'PAID'
    })

    let totalQty = 0
    let totalRevenue = 0
    let occurrences = 0
    let priceSum = 0
    const dailyEarningsMap = {}
    const orderSources = {}
    const tablesMap = {}

    itemOrders.forEach((order) => {
      occurrences += 1
      const orderDateStr = order.createdAt.split('T')[0]
      const source = order.source?.toUpperCase() || 'COUNTER'
      
      order.items.forEach((item) => {
        if (item.name === detailedItemName) {
          const qty = Number(item.qty || 1)
          const price = Number(item.price || 0)
          const subtotal = qty * price

          totalQty += qty
          totalRevenue += subtotal
          priceSum += price
          
          dailyEarningsMap[orderDateStr] = (dailyEarningsMap[orderDateStr] || 0) + subtotal
          orderSources[source] = (orderSources[source] || 0) + subtotal

          if (order.tableNumber !== undefined && order.tableNumber !== null) {
            const tblKey = `Table ${order.tableNumber}`
            tablesMap[tblKey] = (tablesMap[tblKey] || 0) + subtotal
          }
        }
      })
    })

    const avgPrice = totalQty > 0 ? totalRevenue / totalQty : (occurrences > 0 ? priceSum / occurrences : 0)

    let totalPeriodRevenue = 0
    orders.forEach((order) => {
      const isPaid = order.status?.toUpperCase() === 'PAID'
      if (!isPaid) return

      let orderDate
      if (order.createdAt) {
        orderDate = new Date(order.createdAt)
      } else {
        return
      }
      if (isNaN(orderDate.getTime())) return

      let matchTime = true
      if (detailedFilterRange === 'today') {
        matchTime = orderDate.getDate() === now.getDate() &&
                    orderDate.getMonth() === now.getMonth() &&
                    orderDate.getFullYear() === now.getFullYear()
      } else if (detailedFilterRange === '7d') {
        const sevenDaysAgo = new Date()
        sevenDaysAgo.setDate(now.getDate() - 7)
        matchTime = orderDate >= sevenDaysAgo
      } else if (detailedFilterRange === '30d') {
        const thirtyDaysAgo = new Date()
        thirtyDaysAgo.setDate(now.getDate() - 30)
        matchTime = orderDate >= thirtyDaysAgo
      }

      if (matchTime) {
        totalPeriodRevenue += Number(order.total || 0)
      }
    })

    const contributionPct = totalPeriodRevenue > 0 ? (totalRevenue / totalPeriodRevenue) * 100 : 0

    const dailyTrend = Object.keys(dailyEarningsMap)
      .sort()
      .map((date) => {
        const d = new Date(date)
        const formattedDate = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
        return {
          dateStr: formattedDate,
          rawDate: date,
          earnings: dailyEarningsMap[date]
        }
      })

    const sourcesList = Object.keys(orderSources).map(key => ({
      source: key,
      revenue: orderSources[key]
    })).sort((a,b) => b.revenue - a.revenue)

    const tablesList = Object.keys(tablesMap).map(key => ({
      table: key,
      revenue: tablesMap[key]
    })).sort((a,b) => b.revenue - a.revenue).slice(0, 5)

    return {
      totalQty,
      totalRevenue,
      avgPrice,
      contributionPct,
      dailyTrend,
      sourcesList,
      tablesList,
      itemOrders: [...itemOrders].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    }
  }, [orders, detailedItemName, detailedFilterRange])

  const detailedChartPoints = useMemo(() => {
    if (!itemDetailedStats || itemDetailedStats.dailyTrend.length === 0) return []

    const trend = itemDetailedStats.dailyTrend
    const maxEarn = Math.max(...trend.map((t) => t.earnings), 10)
    const xRange = chartWidth - chartPadding.left - chartPadding.right
    const yRange = chartHeight - chartPadding.top - chartPadding.bottom

    return trend.map((t, index) => {
      const x = chartPadding.left + (index / Math.max(trend.length - 1, 1)) * xRange
      const y = chartPadding.top + yRange - (t.earnings / maxEarn) * yRange
      return { x, y, date: t.dateStr, earnings: t.earnings }
    })
  }, [itemDetailedStats])

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
    const itemStats = itemDetailedStats || {
      totalQty: 0,
      totalRevenue: 0,
      avgPrice: 0,
      contributionPct: 0,
      dailyTrend: [],
      sourcesList: [],
      tablesList: [],
      itemOrders: []
    }

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
              Item Sales Performance
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Item Selector Dropdown */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-neutral-500 font-semibold">Item:</span>
              <select
                value={detailedItemName}
                onChange={(e) => {
                  setHoveredItemPoint(null)
                  setDetailedItemName(e.target.value)
                }}
                className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 outline-none transition focus:border-green-500"
              >
                {allUniqueItems.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>

            {/* Timeframe Filter Dropdown */}
            <div className="flex items-center gap-2">
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
              </select>
            </div>
          </div>
        </div>

        {/* Detailed KPI Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Quantity */}
          <div className="relative overflow-hidden rounded-2xl p-5 text-white shadow-sm" style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)' }}>
            <div className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full bg-white/10" />
            <p className="text-xs font-bold uppercase tracking-widest text-indigo-100">Total Quantity Sold</p>
            <p className="mt-3 text-3xl font-extrabold">{itemStats.totalQty}</p>
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
              {itemStats.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <div className="mt-3 text-xs text-emerald-100/90 font-medium">
              <span>Direct sales income</span>
            </div>
          </div>

          {/* Average Price */}
          <div className="relative overflow-hidden rounded-2xl p-5 text-white shadow-sm" style={{ background: 'linear-gradient(135deg, #d97706 0%, #f59e0b 100%)' }}>
            <div className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full bg-white/10" />
            <p className="text-xs font-bold uppercase tracking-widest text-amber-100">Average Unit Price</p>
            <p className="mt-3 text-3xl font-extrabold">
              {currencySymbol}
              {itemStats.avgPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <div className="mt-3 text-xs text-amber-100/90 font-medium">
              <span>Calculated base value</span>
            </div>
          </div>

          {/* Contribution */}
          <div className="relative overflow-hidden rounded-2xl p-5 text-white shadow-sm" style={{ background: 'linear-gradient(135deg, #db2777 0%, #ec4899 100%)' }}>
            <div className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full bg-white/10" />
            <p className="text-xs font-bold uppercase tracking-widest text-pink-100">Sales Contribution</p>
            <p className="mt-3 text-3xl font-extrabold">
              {itemStats.contributionPct.toFixed(1)}%
            </p>
            <div className="mt-3 text-xs text-pink-100/90 font-medium">
              <span>Of total restaurant sales</span>
            </div>
          </div>
        </div>

        {/* Item Sales Trend & Details Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* SVG Trend Line Chart */}
          <div className="card lg:col-span-2 p-5 flex flex-col justify-between">
            <div>
              <h3 className="text-base font-bold text-neutral-900">Daily Earnings Trend</h3>
              <p className="text-xs text-neutral-500">Revenue generated per day for {detailedItemName}</p>
            </div>

            <div className="mt-6 relative h-[210px] w-full">
              {itemStats.dailyTrend.length === 0 ? (
                <div className="flex h-full items-center justify-center text-sm text-neutral-400 font-medium">
                  No sales recorded for this item in this timeframe.
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
                    const maxEarn = Math.max(...itemStats.dailyTrend.map((t) => t.earnings), 10)
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

          {/* Ordering Preferences */}
          <div className="card p-5 space-y-6">
            <div>
              <h3 className="text-base font-bold text-neutral-900">Ordering Preferences</h3>
              <p className="text-xs text-neutral-500">Channels and table demands for this item</p>
            </div>

            <div className="space-y-5">
              {/* Order Channels */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-widest text-neutral-400">Order Source</h4>
                <div className="space-y-2.5">
                  {itemStats.sourcesList.length === 0 ? (
                    <p className="text-xs text-neutral-400 font-medium">No sales recorded.</p>
                  ) : (
                    itemStats.sourcesList.map((src) => {
                      const pct = (src.revenue / itemStats.totalRevenue) * 100
                      const colors = {
                        COUNTER: 'bg-indigo-500',
                        TABLE: 'bg-pink-500',
                        ONLINE: 'bg-sky-500',
                      }
                      return (
                        <div key={src.source} className="space-y-1">
                          <div className="flex justify-between text-xs font-semibold text-neutral-700">
                            <span>{src.source}</span>
                            <span>{pct.toFixed(0)}%</span>
                          </div>
                          <div className="h-1.5 w-full bg-neutral-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${colors[src.source] || 'bg-neutral-400'}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>

              {/* Table Performance */}
              <div className="space-y-2 pt-2 border-t">
                <h4 className="text-xs font-bold uppercase tracking-widest text-neutral-400">Top Ordering Tables</h4>
                <div className="space-y-2.5">
                  {itemStats.tablesList.length === 0 ? (
                    <p className="text-xs text-neutral-400 font-medium">No table orders recorded.</p>
                  ) : (
                    itemStats.tablesList.map((tbl) => {
                      const pct = (tbl.revenue / itemStats.totalRevenue) * 100
                      return (
                        <div key={tbl.table} className="space-y-1">
                          <div className="flex justify-between text-xs font-semibold text-neutral-700">
                            <span>{tbl.table}</span>
                            <span>{pct.toFixed(0)}%</span>
                          </div>
                          <div className="h-1.5 w-full bg-neutral-100 rounded-full overflow-hidden">
                            <div className="h-full rounded-full bg-green-500" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Item Transactions Table */}
        <div className="card p-5 overflow-hidden">
          <div className="mb-4">
            <h3 className="text-base font-bold text-neutral-900">Recent Transactions containing this Item</h3>
            <p className="text-xs text-neutral-500">POS checkout details specifying quantity and price</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-neutral-100 text-neutral-400 uppercase font-bold tracking-wider">
                  <th className="py-2.5 font-semibold">Order ID</th>
                  <th className="py-2.5 font-semibold">Date/Time</th>
                  <th className="py-2.5 font-semibold">Table</th>
                  <th className="py-2.5 font-semibold">Source</th>
                  <th className="py-2.5 font-semibold">Qty Purchased</th>
                  <th className="py-2.5 font-semibold">Unit Price</th>
                  <th className="py-2.5 font-semibold text-right">Order Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-50 font-medium text-neutral-700">
                {itemStats.itemOrders.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="py-6 text-center text-neutral-400 font-medium">
                      No matching transactions to show.
                    </td>
                  </tr>
                ) : (
                  itemStats.itemOrders.slice(0, 8).map((order) => {
                    const date = new Date(order.createdAt)
                    const formattedDate = date.toLocaleString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                    
                    const itemMatch = order.items.find((it) => it.name === detailedItemName) || {}
                    const qty = itemMatch.qty || 1
                    const price = itemMatch.price || 0

                    return (
                      <tr key={order.id} className="hover:bg-neutral-50/50">
                        <td className="py-3 font-mono font-bold text-neutral-900">#{order.id}</td>
                        <td className="py-3 text-neutral-500">{formattedDate}</td>
                        <td className="py-3">
                          {order.tableNumber !== undefined && order.tableNumber !== null
                            ? `Table ${order.tableNumber}`
                            : 'Walk-in'}
                        </td>
                        <td className="py-3 text-neutral-500">
                          <span className="badge-green font-bold text-[10px]">
                            {order.source || 'COUNTER'}
                          </span>
                        </td>
                        <td className="py-3 font-bold text-neutral-800">{qty}</td>
                        <td className="py-3 text-neutral-600">
                          {currencySymbol}
                          {Number(price).toFixed(2)}
                        </td>
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
                if (stats.popularItemsList.length > 0) {
                  setDetailedItemName(stats.popularItemsList[0].name)
                } else if (allUniqueItems.length > 0) {
                  setDetailedItemName(allUniqueItems[0])
                }
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
