import { useState, useEffect, useMemo } from 'react'
import { initializeApp, getApps } from 'firebase/app'
import { getFirestore, collection, getDocs } from 'firebase/firestore'
import { IconAnalytics, IconDownload, IconFileText, IconPrinter, IconSearch } from '../Icons'

export default function AnalyticsScreen({ profile, restaurantSettings, setActiveSection }) {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [filterRange, setFilterRange] = useState('7d') // 'today', '7d', '30d', 'all', 'custom'
  const [hoveredPoint, setHoveredPoint] = useState(null) // for chart tooltips
  const [viewMode, setViewMode] = useState('dashboard') // 'dashboard', 'detailed-items', or 'reports'
  const [detailedFilterRange, setDetailedFilterRange] = useState('7d')
  const [hoveredItemPoint, setHoveredItemPoint] = useState(null)
  const [customStartDateTime, setCustomStartDateTime] = useState('')
  const [customEndDateTime, setCustomEndDateTime] = useState('')
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  // Reports state
  const [reportType, setReportType] = useState('itemized_bill') // 'itemized_bill', 'summary_80mm', 'transactions', 'items', 'payments'
  const [reportSearchQuery, setReportSearchQuery] = useState('')
  const [reportPaymentFilter, setReportPaymentFilter] = useState('all')
  const [reportSourceFilter, setReportSourceFilter] = useState('all')
  const [reportStatusFilter, setReportStatusFilter] = useState('PAID')
  const [reportSortField, setReportSortField] = useState('date')
  const [reportSortDir, setReportSortDir] = useState('desc')
  const [copyStatus, setCopyStatus] = useState(false)

  const setQuickCustomRange = (preset) => {
    const now = new Date()
    const pad = (n) => String(n).padStart(2, '0')
    const formatDT = (d) =>
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`

    if (preset === 'today_full') {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0)
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
      setCustomStartDateTime(formatDT(start))
      setCustomEndDateTime(formatDT(end))
    } else if (preset === 'yesterday') {
      const yesterday = new Date(now)
      yesterday.setDate(now.getDate() - 1)
      const start = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 0, 0, 0)
      const end = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59)
      setCustomStartDateTime(formatDT(start))
      setCustomEndDateTime(formatDT(end))
    } else if (preset === 'lunch') {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 11, 0, 0)
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 15, 0, 0)
      setCustomStartDateTime(formatDT(start))
      setCustomEndDateTime(formatDT(end))
    } else if (preset === 'dinner') {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 17, 0, 0)
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 30, 0)
      setCustomStartDateTime(formatDT(start))
      setCustomEndDateTime(formatDT(end))
    } else if (preset === 'last24h') {
      const start = new Date(now.getTime() - 24 * 60 * 60 * 1000)
      setCustomStartDateTime(formatDT(start))
      setCustomEndDateTime(formatDT(now))
    } else if (preset === 'clear') {
      setCustomStartDateTime('')
      setCustomEndDateTime('')
    }
  }

  const handleSelectFilterRange = (range) => {
    setFilterRange(range)
    if (range === 'custom' && !customStartDateTime && !customEndDateTime) {
      setQuickCustomRange('today_full')
    }
  }

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
        if (typeof order.createdAt === 'object' && typeof order.createdAt.toDate === 'function') {
          orderDate = order.createdAt.toDate()
        } else if (typeof order.createdAt === 'object' && order.createdAt.seconds) {
          orderDate = new Date(order.createdAt.seconds * 1000)
        } else {
          orderDate = new Date(order.createdAt)
        }
      } else {
        return false
      }

      if (!orderDate || isNaN(orderDate.getTime())) return false

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
      } else if (filterRange === 'custom') {
        if (!customStartDateTime && !customEndDateTime) return true
        let match = true
        if (customStartDateTime) {
          const start = new Date(customStartDateTime)
          if (!isNaN(start.getTime())) {
            match = match && orderDate >= start
          }
        }
        if (customEndDateTime) {
          const end = new Date(customEndDateTime)
          if (!isNaN(end.getTime())) {
            match = match && orderDate <= end
          }
        }
        return match
      }
      return true // 'all'
    })
  }, [orders, filterRange, customStartDateTime, customEndDateTime])

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
        if (!customStartDateTime && !customEndDateTime && !customStartDate && !customEndDate) return true
        let match = true
        const startVal = customStartDateTime || (customStartDate ? `${customStartDate}T00:00` : '')
        const endVal = customEndDateTime || (customEndDate ? `${customEndDate}T23:59:59` : '')
        if (startVal) {
          const start = new Date(startVal)
          if (!isNaN(start.getTime())) {
            match = match && orderDate >= start
          }
        }
        if (endVal) {
          const end = new Date(endVal)
          if (!isNaN(end.getTime())) {
            match = match && orderDate <= end
          }
        }
        return match
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

  // Helper for CSV export
  const exportToCSV = (filename, rows) => {
    const processRow = (row) => {
      return row
        .map((val) => {
          let finalVal = val === null || val === undefined ? '' : String(val)
          if (finalVal.search(/("|,|\n|\r)/g) >= 0) {
            finalVal = `"${finalVal.replace(/"/g, '""')}"`
          }
          return finalVal
        })
        .join(',')
    }

    const csvContent = '\uFEFF' + rows.map(processRow).join('\r\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', filename)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  // Aggregate Report Data
  const reportData = useMemo(() => {
    const now = new Date()

    // 1. Filter orders by date/time
    const timeFiltered = orders.filter((order) => {
      let orderDate
      if (order.createdAt) {
        if (typeof order.createdAt === 'object' && typeof order.createdAt.toDate === 'function') {
          orderDate = order.createdAt.toDate()
        } else if (typeof order.createdAt === 'object' && order.createdAt.seconds) {
          orderDate = new Date(order.createdAt.seconds * 1000)
        } else {
          orderDate = new Date(order.createdAt)
        }
      } else {
        return false
      }

      if (!orderDate || isNaN(orderDate.getTime())) return false

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
      } else if (filterRange === 'custom') {
        if (!customStartDateTime && !customEndDateTime) return true
        let match = true
        if (customStartDateTime) {
          const start = new Date(customStartDateTime)
          if (!isNaN(start.getTime())) match = match && orderDate >= start
        }
        if (customEndDateTime) {
          const end = new Date(customEndDateTime)
          if (!isNaN(end.getTime())) match = match && orderDate <= end
        }
        return match
      }
      return true
    })

    // 2. Filter by search query, payment method, source, status
    const fullyFiltered = timeFiltered.filter((order) => {
      if (reportStatusFilter !== 'all') {
        const s = (order.status || 'PAID').toUpperCase()
        if (s !== reportStatusFilter.toUpperCase()) return false
      }

      if (reportPaymentFilter !== 'all') {
        const pm = (order.paymentMethod || 'CASH').toUpperCase()
        if (pm !== reportPaymentFilter.toUpperCase()) return false
      }

      if (reportSourceFilter !== 'all') {
        const src = (order.source || 'COUNTER').toUpperCase()
        if (src !== reportSourceFilter.toUpperCase()) return false
      }

      if (reportSearchQuery.trim()) {
        const q = reportSearchQuery.toLowerCase()
        const matchId = String(order.id || '').toLowerCase().includes(q)
        const matchTable = String(order.tableNumber || '').toLowerCase().includes(q)
        const matchRoom = String(order.roomNumber || '').toLowerCase().includes(q)
        const matchPay = String(order.paymentMethod || '').toLowerCase().includes(q)
        const matchSource = String(order.source || '').toLowerCase().includes(q)
        const matchItems = Array.isArray(order.items) && order.items.some((i) => (i.name || '').toLowerCase().includes(q))
        if (!matchId && !matchTable && !matchRoom && !matchPay && !matchSource && !matchItems) return false
      }

      return true
    })

    // Summary calculations
    let totalGrossRevenue = 0
    let totalCardFees = 0
    let totalServiceFees = 0
    let totalOrdersCount = 0
    let totalItemsSold = 0

    // Datasets
    const itemsMap = {}
    const paymentMap = {}
    const dailyMap = {}
    const channelMap = {
      'COUNTER': { channel: 'Counter / Walk-in', count: 0, total: 0 },
      'TABLE': { channel: 'Dine-In (Tables)', count: 0, total: 0 },
      'ONLINE': { channel: 'Online / QR Orders', count: 0, total: 0 },
    }

    // Sort orders
    const sortedOrders = [...fullyFiltered].sort((a, b) => {
      const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0)
      const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0)
      if (reportSortField === 'total') {
        return reportSortDir === 'asc' ? Number(a.total || 0) - Number(b.total || 0) : Number(b.total || 0) - Number(a.total || 0)
      }
      return reportSortDir === 'asc' ? dateA.getTime() - dateB.getTime() : dateB.getTime() - dateA.getTime()
    })

    // Totals & datasets
    let totalDiscounts = 0
    let grossItemsSubtotal = 0
    let cashTotal = 0
    let cardGrossTotal = 0
    let onlineTotal = 0

    sortedOrders.forEach((order) => {
      const total = Number(order.total || 0)
      const cardFee = Number(order.cardFeeAmount || 0)
      const serviceFee = Number(order.serviceFeeAmount || 0)
      const subtotal = total - cardFee - serviceFee

      totalOrdersCount += 1
      totalGrossRevenue += total
      totalCardFees += cardFee
      totalServiceFees += serviceFee
      grossItemsSubtotal += subtotal

      // Payment aggregation
      const payKey = (order.paymentMethod || 'CASH').toUpperCase()
      if (!paymentMap[payKey]) {
        paymentMap[payKey] = { method: payKey, count: 0, gross: 0, fees: 0 }
      }
      paymentMap[payKey].count += 1
      paymentMap[payKey].gross += total
      paymentMap[payKey].fees += cardFee + serviceFee

      if (payKey === 'CASH') {
        cashTotal += total
      } else if (payKey === 'CARD') {
        cardGrossTotal += total
      } else if (payKey === 'ONLINE') {
        onlineTotal += total
      }

      // Date aggregation
      const dateObj = order.createdAt?.toDate ? order.createdAt.toDate() : new Date(order.createdAt || 0)
      const dateKey = !isNaN(dateObj.getTime()) ? dateObj.toISOString().split('T')[0] : 'Unknown Date'
      if (!dailyMap[dateKey]) {
        dailyMap[dateKey] = { date: dateKey, count: 0, items: 0, gross: 0, fees: 0 }
      }
      dailyMap[dateKey].count += 1
      dailyMap[dateKey].gross += total
      dailyMap[dateKey].fees += cardFee + serviceFee

      // Items aggregation
      if (Array.isArray(order.items)) {
        order.items.forEach((it) => {
          const name = it.name || 'Unnamed Item'
          const qty = Number(it.qty || 1)
          const price = Number(it.price || 0)
          const disc = Number(it.discountAmount || 0)
          const itemSubtotal = qty * price
          const itemPaid = Math.max(0, itemSubtotal - disc)

          totalItemsSold += qty
          totalDiscounts += disc
          dailyMap[dateKey].items += qty

          if (!itemsMap[name]) {
            itemsMap[name] = {
              name,
              qty: 0,
              price,
              subtotal: 0,
              discount: 0,
              paid: 0,
              revenue: 0,
            }
          }
          itemsMap[name].qty += qty
          itemsMap[name].subtotal += itemSubtotal
          itemsMap[name].discount += disc
          itemsMap[name].paid += itemPaid
          itemsMap[name].revenue += itemPaid
        })
      }

      // Channel aggregation
      if (order.source === 'ONLINE') {
        channelMap['ONLINE'].count += 1
        channelMap['ONLINE'].total += total
      } else if (order.tableNumber !== null && order.tableNumber !== undefined && String(order.tableNumber).trim() !== '') {
        channelMap['TABLE'].count += 1
        channelMap['TABLE'].total += total
      } else {
        channelMap['COUNTER'].count += 1
        channelMap['COUNTER'].total += total
      }
    })

    const totalFees = totalCardFees + totalServiceFees
    const totalNetRevenue = totalGrossRevenue - totalFees
    const aov = totalOrdersCount > 0 ? totalGrossRevenue / totalOrdersCount : 0
    const cashlessTotal = Math.max(0, totalGrossRevenue - cashTotal)
    const channelList = Object.values(channelMap).filter((c) => c.count > 0)

    // Items list
    const itemsList = Object.values(itemsMap)
      .map((it) => ({
        ...it,
        percentage: totalGrossRevenue > 0 ? (it.revenue / totalGrossRevenue) * 100 : 0,
      }))
      .sort((a, b) => b.qty - a.qty)

    // Payments list
    const paymentsList = Object.values(paymentMap)
      .map((pm) => ({
        ...pm,
        net: pm.gross - pm.fees,
        percentage: totalGrossRevenue > 0 ? (pm.gross / totalGrossRevenue) * 100 : 0,
      }))
      .sort((a, b) => b.gross - a.gross)

    return {
      filteredOrders: sortedOrders,
      totalGrossRevenue,
      totalNetRevenue,
      totalFees,
      totalCardFees,
      totalServiceFees,
      totalOrdersCount,
      totalItemsSold,
      totalDiscounts,
      grossItemsSubtotal,
      cashTotal,
      cardGrossTotal,
      onlineTotal,
      cashlessTotal,
      channelList,
      aov,
      itemsList,
      paymentsList,
    }
  }, [orders, filterRange, customStartDateTime, customEndDateTime, reportStatusFilter, reportPaymentFilter, reportSourceFilter, reportSearchQuery, reportSortField, reportSortDir])

  const handlePrint80mm = () => {
    const restaurantName = restaurantSettings?.name || 'KAIFF'
    const waiterName = profile?.displayName || profile?.name || 'Sergey'

    let fromDateStr = ''
    let tillDateStr = ''
    let firstDateFormatted = ''

    if (filterRange === 'custom' && customStartDateTime && customEndDateTime) {
      const startD = new Date(customStartDateTime)
      const endD = new Date(customEndDateTime)
      const pad = (n) => String(n).padStart(2, '0')
      const fmt = (d) => `${d.getDate()} ${d.toLocaleString('default', { month: 'long' })} ${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
      fromDateStr = !isNaN(startD.getTime()) ? fmt(startD) : customStartDateTime
      tillDateStr = !isNaN(endD.getTime()) ? fmt(endD) : customEndDateTime
      firstDateFormatted = !isNaN(startD.getTime())
        ? `${startD.getDate()} ${startD.toLocaleString('default', { month: 'long' })} ${startD.getFullYear()}`
        : customStartDateTime.split('T')[0]
    } else if (filterRange === 'today') {
      const now = new Date()
      const pad = (n) => String(n).padStart(2, '0')
      const dStr = `${now.getDate()} ${now.toLocaleString('default', { month: 'long' })} ${now.getFullYear()}`
      fromDateStr = `${dStr} 00:00`
      tillDateStr = `${dStr} 23:59`
      firstDateFormatted = dStr
    } else if (filterRange === '7d') {
      const startD = new Date()
      startD.setDate(startD.getDate() - 7)
      const endD = new Date()
      const fmt = (d) => `${d.getDate()} ${d.toLocaleString('default', { month: 'long' })} ${d.getFullYear()}`
      fromDateStr = `${fmt(startD)} 00:00`
      tillDateStr = `${fmt(endD)} 23:59`
      firstDateFormatted = fmt(startD)
    } else if (filterRange === '30d') {
      const startD = new Date()
      startD.setDate(startD.getDate() - 30)
      const endD = new Date()
      const fmt = (d) => `${d.getDate()} ${d.toLocaleString('default', { month: 'long' })} ${d.getFullYear()}`
      fromDateStr = `${fmt(startD)} 00:00`
      tillDateStr = `${fmt(endD)} 23:59`
      firstDateFormatted = fmt(startD)
    } else {
      if (reportData.filteredOrders.length > 0) {
        const earliestOrder = reportData.filteredOrders[reportData.filteredOrders.length - 1]
        const d = earliestOrder.createdAt?.toDate ? earliestOrder.createdAt.toDate() : new Date(earliestOrder.createdAt || 0)
        firstDateFormatted = !isNaN(d.getTime()) ? `${d.getDate()} ${d.toLocaleString('default', { month: 'long' })} ${d.getFullYear()}` : 'All Time'
      } else {
        firstDateFormatted = 'All Time'
      }
      fromDateStr = 'Beginning'
      tillDateStr = 'Current'
    }

    if (reportType === 'itemized_bill') {
      const printHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8" />
          <title>Daily_Report_1_${firstDateFormatted.replace(/\s+/g, '_')}</title>
          <style>
            @page {
              size: 80mm auto;
              margin: 0;
            }
            * { box-sizing: border-box; }
            body {
              font-family: 'Courier New', Courier, monospace, -apple-system, sans-serif;
              width: 72mm;
              margin: 0 auto;
              padding: 4mm 2mm;
              color: #000;
              background: #fff;
              font-size: 11px;
              line-height: 1.35;
              -webkit-print-color-adjust: exact;
            }
            .center { text-align: center; }
            .right { text-align: right; }
            .bold { font-weight: bold; }
            .title { font-size: 14px; font-weight: bold; text-align: center; margin-bottom: 8px; }
            .divider { border-top: 1px dashed #000; margin: 6px 0; }
            .double-divider { border-top: 2px solid #000; margin: 6px 0; }
            .meta-table { width: 100%; margin-bottom: 4px; font-size: 11px; }
            .meta-table td { padding: 1.5px 0; vertical-align: top; }
            .meta-label { width: 75px; color: #000; font-weight: normal; }
            .meta-val { font-weight: bold; }
            .item-table { width: 100%; border-collapse: collapse; font-size: 8.5px; line-height: 1.25; margin: 3px 0; }
            .item-table th { border-bottom: 1px dashed #000; padding: 2px 1px; font-size: 8px; font-weight: bold; text-transform: uppercase; }
            .item-table td { padding: 1.8px 1px; vertical-align: top; }
            .summary-table { width: 100%; font-size: 11.5px; margin-top: 6px; }
            .summary-table td { padding: 3.5px 0; }
            .total-line { font-size: 13.5px; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="title">Report for ${firstDateFormatted}</div>
          <table class="meta-table">
            <tr><td class="meta-label">Location</td><td class="meta-val">${restaurantName}</td></tr>
            <tr><td class="meta-label">Waiter</td><td class="meta-val">${waiterName}</td></tr>
            <tr><td class="meta-label">From</td><td class="meta-val">${fromDateStr}</td></tr>
            <tr><td class="meta-label">Till</td><td class="meta-val">${tillDateStr}</td></tr>
          </table>

          <div class="divider"></div>

          <table class="item-table">
            <thead>
              <tr>
                <th align="left" style="width: 32%;">Name</th>
                <th align="center" style="width: 10%;">Quantity</th>
                <th align="right" style="width: 14%;">Price</th>
                <th align="right" style="width: 16%;">Subtotal</th>
                <th align="right" style="width: 12%;">Discount</th>
                <th align="right" style="width: 16%;">Paid</th>
              </tr>
            </thead>
            <tbody>
              ${reportData.itemsList
                .map(
                  (it) => `
                <tr>
                  <td style="word-break: break-word;">${it.name}</td>
                  <td align="center">${it.qty}</td>
                  <td align="right">${Number(it.price || 0).toFixed(2)}</td>
                  <td align="right">${Number(it.subtotal || it.qty * it.price).toFixed(2)}</td>
                  <td align="right">${it.discount > 0 ? Number(it.discount).toFixed(2) : '--'}</td>
                  <td align="right" class="bold">${Number(it.paid || it.revenue).toFixed(2)}</td>
                </tr>
              `
                )
                .join('')}
            </tbody>
          </table>

          <div class="divider"></div>

          <table class="summary-table">
            <tr>
              <td>Number of orders</td>
              <td align="right" class="bold">${reportData.totalOrdersCount}</td>
            </tr>
            <tr><td colspan="2" style="height: 6px;"></td></tr>
            <tr>
              <td>Subtotal</td>
              <td align="right" class="bold">${reportData.grossItemsSubtotal.toFixed(2)} Rs</td>
            </tr>
            <tr><td colspan="2" style="height: 6px;"></td></tr>
            <tr>
              <td>Discounts</td>
              <td align="right" class="bold">${reportData.totalDiscounts > 0 ? reportData.totalDiscounts.toFixed(2) : '0.00'} Rs</td>
            </tr>
            <tr><td colspan="2" style="height: 6px;"></td></tr>
            <tr>
              <td>Service charge fee</td>
              <td align="right" class="bold">${reportData.totalServiceFees.toFixed(2)} Rs</td>
            </tr>
            <tr><td colspan="2" style="height: 6px;"></td></tr>
            <tr class="total-line">
              <td>Total, incl. discounts</td>
              <td align="right" class="bold">${reportData.totalGrossRevenue.toFixed(2)} Rs</td>
            </tr>
            <tr><td colspan="2" style="height: 6px;"></td></tr>
            <tr>
              <td>Cash payments</td>
              <td align="right" class="bold">${reportData.cashTotal.toFixed(2)} Rs</td>
            </tr>
            <tr><td colspan="2" style="height: 6px;"></td></tr>
            <tr>
              <td>Cashless payments</td>
              <td align="right" class="bold">${reportData.cashlessTotal.toFixed(2)} Rs</td>
            </tr>
          </table>

          <div class="divider" style="margin-top: 12px;"></div>
          <div class="center bold" style="font-size: 10px; margin-top: 6px;">*** END OF REPORT ***</div>
        </body>
        </html>
      `

      const printWindow = window.open('', '_blank', 'width=380,height=650')
      if (printWindow) {
        printWindow.document.write(printHtml)
        printWindow.document.close()
        printWindow.focus()
        setTimeout(() => {
          printWindow.print()
        }, 350)
      }
      return
    }

    const printDate = new Date().toLocaleString()
    const firstId = reportData.filteredOrders.length > 0 ? reportData.filteredOrders[reportData.filteredOrders.length - 1].id : '—'
    const lastId = reportData.filteredOrders.length > 0 ? reportData.filteredOrders[0].id : '—'

    const printHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>80mm_Closing_${filterRange}</title>
        <style>
          @page { size: 80mm auto; margin: 0; }
          * { box-sizing: border-box; }
          body {
            font-family: 'Courier New', Courier, monospace, -apple-system, sans-serif;
            width: 72mm;
            margin: 0 auto;
            padding: 4mm 2mm;
            color: #000;
            background: #fff;
            font-size: 12px;
            line-height: 1.35;
            -webkit-print-color-adjust: exact;
          }
          .center { text-align: center; }
          .right { text-align: right; }
          .bold { font-weight: bold; }
          .divider { border-top: 1px dashed #000; margin: 6px 0; }
          .double-divider { border-top: 2px solid #000; margin: 6px 0; }
          .title { font-size: 15px; font-weight: bold; }
          .subtitle { font-size: 12px; font-weight: bold; }
          .row { display: flex; justify-content: space-between; margin: 2px 0; }
          .row-3 { display: grid; grid-template-columns: 2.2fr 0.8fr 1.5fr; margin: 2px 0; }
          .sign-box { margin-top: 16px; font-size: 11px; }
        </style>
      </head>
      <body>
        <div class="center">
          <div class="title">${restaurantName}</div>
          ${restaurantSettings?.address ? `<div>${restaurantSettings.address}</div>` : ''}
          ${restaurantSettings?.phone ? `<div>Tel: ${restaurantSettings.phone}</div>` : ''}
          <div class="divider"></div>
          <div class="subtitle">DAILY SALES CLOSING REPORT</div>
          <div>(Z-REPORT / 80MM SLIP)</div>
        </div>
        <div class="divider"></div>
        <div class="row"><span>Period:</span><span class="bold">${reportPeriodTitle}</span></div>
        <div class="row"><span>Printed:</span><span>${printDate}</span></div>
        <div class="row"><span>Orders Range:</span><span>#${firstId} - #${lastId} (${reportData.totalOrdersCount} Total)</span></div>
        <div class="divider"></div>

        <div class="bold">1. FINANCIAL SUMMARY</div>
        <div class="divider"></div>
        <div class="row"><span>Gross Subtotal:</span><span>${currencySymbol}${reportData.grossItemsSubtotal.toFixed(2)}</span></div>
        <div class="row"><span>Service Fee:</span><span>${currencySymbol}${reportData.totalServiceFees.toFixed(2)}</span></div>
        <div class="row"><span>Card Fee:</span><span>${currencySymbol}${reportData.totalCardFees.toFixed(2)}</span></div>
        <div class="double-divider"></div>
        <div class="row bold" style="font-size: 13px;"><span>GRAND TOTAL:</span><span>${currencySymbol}${reportData.totalGrossRevenue.toFixed(2)}</span></div>
        <div class="double-divider"></div>

        <div class="bold" style="margin-top: 8px;">2. PAYMENT RECONCILIATION</div>
        <div class="divider"></div>
        <div class="row-3 bold" style="font-size: 11px;"><span>Method</span><span class="center">Orders</span><span class="right">Amount</span></div>
        <div class="divider"></div>
        ${reportData.paymentsList
          .map(
            (p) => `
          <div class="row-3">
            <span>${p.method}</span>
            <span class="center">${p.count}</span>
            <span class="right">${currencySymbol}${p.gross.toFixed(2)}</span>
          </div>
        `
          )
          .join('')}
        <div class="divider"></div>
        <div class="row bold"><span>Cash in Drawer:</span><span>${currencySymbol}${reportData.cashTotal.toFixed(2)}</span></div>
        <div class="divider"></div>

        <div class="bold" style="margin-top: 8px;">3. SALES BY CHANNEL</div>
        <div class="divider"></div>
        ${reportData.channelList
          .map(
            (c) => `
          <div class="row">
            <span>${c.channel} (${c.count})</span>
            <span class="right">${currencySymbol}${c.total.toFixed(2)}</span>
          </div>
        `
          )
          .join('')}
        <div class="divider"></div>

        <div class="bold" style="margin-top: 8px;">4. MENU ITEMS SOLD</div>
        <div class="divider"></div>
        <div class="row-3 bold" style="font-size: 11px;"><span>Item</span><span class="center">Qty</span><span class="right">Total</span></div>
        <div class="divider"></div>
        ${reportData.itemsList
          .map(
            (it) => `
          <div class="row-3">
            <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${it.name}</span>
            <span class="center">${it.qty}</span>
            <span class="right">${currencySymbol}${it.revenue.toFixed(2)}</span>
          </div>
        `
          )
          .join('')}
        <div class="divider"></div>
        <div class="row bold"><span>Total Units Sold:</span><span>${reportData.totalItemsSold}</span></div>
        <div class="divider"></div>

        <div class="sign-box">
          <div class="row"><span>Cashier Name:</span><span>____________________</span></div>
          <div class="row" style="margin-top: 10px;"><span>Cashier Sign:</span><span>____________________</span></div>
          <div class="row" style="margin-top: 12px;"><span>Manager Verified:</span><span>____________________</span></div>
        </div>

        <div class="divider"></div>
        <div class="center bold" style="margin-top: 8px;">*** END OF DAY REPORT ***</div>
      </body>
      </html>
    `

    const printWindow = window.open('', '_blank', 'width=380,height=650')
    if (printWindow) {
      printWindow.document.write(printHtml)
      printWindow.document.close()
      printWindow.focus()
      setTimeout(() => {
        printWindow.print()
      }, 350)
    }
  }

  const handleDownloadReport = () => {
    const restaurantName = restaurantSettings?.name || 'KAIFF'
    const waiterName = profile?.displayName || profile?.name || 'Sergey'
    const cleanRestName = restaurantName.toLowerCase().replace(/[^a-z0-9]/g, '_')
    const timeRangeStr =
      filterRange === 'custom' && customStartDateTime && customEndDateTime
        ? `${customStartDateTime.replace(/[:]/g, '-')}_to_${customEndDateTime.replace(/[:]/g, '-')}`
        : filterRange
    const filename = `${cleanRestName}_${reportType === 'itemized_bill' ? 'daily_report_1' : reportType}_${timeRangeStr}.csv`

    if (reportType === 'itemized_bill') {
      const rows = [
        [`DAILY REPORT 1 FOR ${restaurantName.toUpperCase()}`],
        ['Location:', restaurantName],
        ['Waiter:', waiterName],
        ['Period:', timeRangeStr],
        ['Total Checkouts:', reportData.totalOrdersCount],
        ['Generated At:', new Date().toLocaleString()],
        [],
        ['Name', 'Quantity', `Price (${currencySymbol})`, `Subtotal (${currencySymbol})`, `Discount (${currencySymbol})`, `Paid (${currencySymbol})`],
        ...reportData.itemsList.map((i) => [
          i.name,
          i.qty,
          Number(i.price || 0).toFixed(2),
          Number(i.subtotal || i.qty * i.price).toFixed(2),
          i.discount > 0 ? Number(i.discount).toFixed(2) : '--',
          Number(i.paid || i.revenue).toFixed(2),
        ]),
        [],
        ['Number of orders', reportData.totalOrdersCount],
        ['Subtotal', `${reportData.grossItemsSubtotal.toFixed(2)} ${currencySymbol}`],
        ['Discounts', `${reportData.totalDiscounts.toFixed(2)} ${currencySymbol}`],
        ['Service charge fee', `${reportData.totalServiceFees.toFixed(2)} ${currencySymbol}`],
        ['Total, incl. discounts', `${reportData.totalGrossRevenue.toFixed(2)} ${currencySymbol}`],
        ['Cash payments', `${reportData.cashTotal.toFixed(2)} ${currencySymbol}`],
        ['Cashless payments', `${reportData.cashlessTotal.toFixed(2)} ${currencySymbol}`],
      ]
      exportToCSV(filename, rows)
      return
    }

    if (reportType === 'summary_80mm') {
      const rows = [
        ['DAILY SALES CLOSING & FINANCIAL REPORT (80MM Z-REPORT)'],
        ['Restaurant:', restaurantName],
        ['Address:', restaurantSettings?.address || ''],
        ['Phone:', restaurantSettings?.phone || ''],
        ['Report Period:', timeRangeStr],
        ['Total Orders:', reportData.totalOrdersCount],
        ['Printed At:', new Date().toLocaleString()],
        [],
        ['1. FINANCIAL SUMMARY'],
        ['Gross Items Subtotal', `${currencySymbol}${reportData.grossItemsSubtotal.toFixed(2)}`],
        ['Service Charge Collected', `${currencySymbol}${reportData.totalServiceFees.toFixed(2)}`],
        ['Card Processing Fees', `${currencySymbol}${reportData.totalCardFees.toFixed(2)}`],
        ['GRAND TOTAL REVENUE', `${currencySymbol}${reportData.totalGrossRevenue.toFixed(2)}`],
        [],
        ['2. PAYMENT RECONCILIATION & CASH DRAWER'],
        ['Payment Method', 'Orders Count', `Gross Amount (${currencySymbol})`, `Fees Deducted (${currencySymbol})`, `Net Amount (${currencySymbol})`],
        ...reportData.paymentsList.map((p) => [p.method, p.count, p.gross.toFixed(2), p.fees.toFixed(2), p.net.toFixed(2)]),
        ['EXPECTED CASH IN DRAWER', '', `${currencySymbol}${reportData.cashTotal.toFixed(2)}`],
        [],
        ['3. SALES BY CHANNEL'],
        ['Channel', 'Orders Count', `Total Revenue (${currencySymbol})`],
        ...reportData.channelList.map((c) => [c.channel, c.count, c.total.toFixed(2)]),
        [],
        ['4. MENU ITEMS SOLD SUMMARY'],
        ['Item Name', 'Units Sold', `Unit Price (${currencySymbol})`, `Total Revenue (${currencySymbol})`, '% Contribution'],
        ...reportData.itemsList.map((i) => [i.name, i.qty, i.price.toFixed(2), i.revenue.toFixed(2), `${i.percentage.toFixed(1)}%`]),
        ['TOTAL UNITS SOLD', reportData.totalItemsSold, '', `${currencySymbol}${reportData.grossItemsSubtotal.toFixed(2)}`, '100.0%'],
      ]
      exportToCSV(filename, rows)
      return
    }

    if (reportType === 'transactions') {
      const headers = [
        'Order ID',
        'Date & Time',
        'Channel',
        'Table / Room',
        'Items Ordered',
        'Status',
        'Payment Method',
        `Subtotal (${currencySymbol})`,
        `Service Fee (${currencySymbol})`,
        `Card Fee (${currencySymbol})`,
        `Total Amount (${currencySymbol})`,
      ]
      const rows = reportData.filteredOrders.map((o) => {
        const dateObj = o.createdAt?.toDate ? o.createdAt.toDate() : new Date(o.createdAt || 0)
        const dateFormatted = !isNaN(dateObj.getTime()) ? dateObj.toLocaleString() : ''
        const itemsSummary = Array.isArray(o.items)
          ? o.items.map((i) => `${i.qty || 1}x ${i.name || 'Item'} (${currencySymbol}${Number(i.price || 0).toFixed(2)})`).join('; ')
          : 'No items'
        const total = Number(o.total || 0)
        const sFee = Number(o.serviceFeeAmount || 0)
        const cFee = Number(o.cardFeeAmount || 0)
        const subtotal = total - sFee - cFee
        return [
          o.id,
          dateFormatted,
          o.source || 'COUNTER',
          o.tableNumber !== undefined && o.tableNumber !== null
            ? `Table ${o.tableNumber}`
            : o.roomNumber
            ? `Room ${o.roomNumber}`
            : 'Walk-in',
          itemsSummary,
          o.status || 'PAID',
          o.paymentMethod || 'CASH',
          subtotal.toFixed(2),
          sFee.toFixed(2),
          cFee.toFixed(2),
          total.toFixed(2),
        ]
      })

      // Add summary row
      rows.push([])
      rows.push([
        'SUMMARY TOTALS',
        '',
        '',
        '',
        `${reportData.totalItemsSold} items total`,
        `${reportData.totalOrdersCount} orders`,
        '',
        (reportData.totalGrossRevenue - reportData.totalFees).toFixed(2),
        reportData.totalServiceFees.toFixed(2),
        reportData.totalCardFees.toFixed(2),
        reportData.totalGrossRevenue.toFixed(2),
      ])

      exportToCSV(filename, [headers, ...rows])
    } else if (reportType === 'items') {
      const headers = ['Item Name', 'Units Sold', `Unit Price (${currencySymbol})`, `Total Revenue (${currencySymbol})`, '% Contribution']
      const rows = reportData.itemsList.map((i) => [
        i.name,
        i.qty,
        i.price.toFixed(2),
        i.revenue.toFixed(2),
        `${i.percentage.toFixed(1)}%`,
      ])
      rows.push([])
      rows.push(['SUMMARY TOTALS', reportData.totalItemsSold, '', reportData.totalGrossRevenue.toFixed(2), '100.0%'])
      exportToCSV(filename, [headers, ...rows])
    } else if (reportType === 'payments') {
      const headers = ['Payment Method', 'Orders Count', `Gross Volume (${currencySymbol})`, `Fees Deducted (${currencySymbol})`, `Net Revenue (${currencySymbol})`, '% Share']
      const rows = reportData.paymentsList.map((p) => [
        p.method,
        p.count,
        p.gross.toFixed(2),
        p.fees.toFixed(2),
        p.net.toFixed(2),
        `${p.percentage.toFixed(1)}%`,
      ])
      rows.push([])
      rows.push(['SUMMARY TOTALS', reportData.totalOrdersCount, reportData.totalGrossRevenue.toFixed(2), reportData.totalFees.toFixed(2), reportData.totalNetRevenue.toFixed(2), '100.0%'])
      exportToCSV(filename, [headers, ...rows])
    }
  }

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

  const handleCopyTable = () => {
    let text = ''
    if (reportType === 'itemized_bill') {
      const firstDateText = filterRange === 'custom' && customStartDateTime
        ? new Date(customStartDateTime).toLocaleDateString([], { day: 'numeric', month: 'long', year: 'numeric' })
        : new Date().toLocaleDateString([], { day: 'numeric', month: 'long', year: 'numeric' })

      text = [
        `DAILY REPORT 1 FOR ${firstDateText.toUpperCase()}`,
        `Location:\t${restaurantSettings?.name || 'KAIFF'}`,
        `Waiter:\t${profile?.displayName || profile?.name || 'Sergey'}`,
        `Period:\t${filterRange}`,
        '',
        'Name\tQuantity\tPrice\tSubtotal\tDiscount\tPaid',
        ...reportData.itemsList.map(
          (i) => `${i.name}\t${i.qty}\t${Number(i.price || 0).toFixed(2)}\t${Number(i.subtotal || i.qty * i.price).toFixed(2)}\t${i.discount > 0 ? Number(i.discount).toFixed(2) : '--'}\t${Number(i.paid || i.revenue).toFixed(2)}`
        ),
        '',
        `Number of orders:\t${reportData.totalOrdersCount}`,
        `Subtotal:\t${reportData.grossItemsSubtotal.toFixed(2)} Rs`,
        `Discounts:\t${reportData.totalDiscounts.toFixed(2)} Rs`,
        `Service charge fee:\t${reportData.totalServiceFees.toFixed(2)} Rs`,
        `Total, incl. discounts:\t${reportData.totalGrossRevenue.toFixed(2)} Rs`,
        `Cash payments:\t${reportData.cashTotal.toFixed(2)} Rs`,
        `Cashless payments:\t${reportData.cashlessTotal.toFixed(2)} Rs`,
      ].join('\n')
    } else if (reportType === 'summary_80mm') {
      text = [
        'DAILY SALES CLOSING REPORT (80MM Z-REPORT)',
        `Period:\t${filterRange}`,
        `Total Orders:\t${reportData.totalOrdersCount}`,
        `Gross Subtotal:\t${reportData.grossItemsSubtotal.toFixed(2)}`,
        `Service Fees:\t${reportData.totalServiceFees.toFixed(2)}`,
        `Card Fees:\t${reportData.totalCardFees.toFixed(2)}`,
        `Grand Total Revenue:\t${reportData.totalGrossRevenue.toFixed(2)}`,
        `Cash in Drawer:\t${reportData.cashTotal.toFixed(2)}`,
        '',
        'PAYMENTS BREAKDOWN:',
        ...reportData.paymentsList.map((p) => `${p.method}\t${p.count} orders\t${p.gross.toFixed(2)}`),
        '',
        'SALES BY CHANNEL:',
        ...reportData.channelList.map((c) => `${c.channel}\t${c.count} orders\t${c.total.toFixed(2)}`),
        '',
        'ITEMS SOLD SUMMARY:',
        ...reportData.itemsList.map((i) => `${i.name}\t${i.qty} units\t${i.revenue.toFixed(2)}`),
      ].join('\n')
    } else if (reportType === 'transactions') {
      text = ['Order ID\tDate\tChannel\tTable\tItems\tStatus\tPayment\tSubtotal\tService Fee\tCard Fee\tTotal']
        .concat(
          reportData.filteredOrders.map((o) => {
            const d = o.createdAt?.toDate ? o.createdAt.toDate() : new Date(o.createdAt || 0)
            const itemsSummary = Array.isArray(o.items)
              ? o.items.map((i) => `${i.qty || 1}x ${i.name || 'Item'}`).join(', ')
              : ''
            const total = Number(o.total || 0)
            const sFee = Number(o.serviceFeeAmount || 0)
            const cFee = Number(o.cardFeeAmount || 0)
            return `${o.id}\t${d.toLocaleString()}\t${o.source || 'COUNTER'}\t${o.tableNumber || o.roomNumber || 'Walk-in'}\t${itemsSummary}\t${o.status || 'PAID'}\t${o.paymentMethod || 'CASH'}\t${(total - sFee - cFee).toFixed(2)}\t${sFee.toFixed(2)}\t${cFee.toFixed(2)}\t${total.toFixed(2)}`
          })
        )
        .join('\n')
    } else if (reportType === 'items') {
      text = ['Item Name\tUnits Sold\tPrice\tRevenue\t% Share']
        .concat(
          reportData.itemsList.map(
            (i) => `${i.name}\t${i.qty}\t${i.price.toFixed(2)}\t${i.revenue.toFixed(2)}\t${i.percentage.toFixed(1)}%`
          )
        )
        .join('\n')
    } else if (reportType === 'payments') {
      text = ['Payment Method\tOrders\tGross\tFees\tNet\t% Share']
        .concat(
          reportData.paymentsList.map(
            (p) => `${p.method}\t${p.count}\t${p.gross.toFixed(2)}\t${p.fees.toFixed(2)}\t${p.net.toFixed(2)}\t${p.percentage.toFixed(1)}%`
          )
        )
        .join('\n')
    }
    navigator.clipboard.writeText(text)
    setCopyStatus(true)
    setTimeout(() => setCopyStatus(false), 2500)
  }

  // ── Render Reports View ───────────────────────────────────────────────────
  if (viewMode === 'reports') {
    return (
      <div className="p-6 sm:p-8 space-y-6">
        {/* Top Navigation Tabs & Header */}
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4 border-b border-green-100/80 pb-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <button
                onClick={() => setViewMode('dashboard')}
                className="text-[11px] font-bold text-neutral-400 hover:text-green-600 transition uppercase tracking-wider flex items-center gap-1"
              >
                Analytics
              </button>
              <span className="text-neutral-300">/</span>
              <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">Reports & Exports</span>
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-neutral-900 flex items-center gap-2">
              Sales & Financial Reports
            </h2>
          </div>

          {/* View Mode Switcher */}
          <div className="inline-flex items-center p-1 bg-neutral-100/90 rounded-xl border border-neutral-200/60 shadow-2xs">
            <button
              type="button"
              onClick={() => setViewMode('dashboard')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-neutral-600 hover:text-neutral-900 hover:bg-white/40 transition-all"
            >
              <IconAnalytics />
              <span>Overview</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('reports')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white text-emerald-800 shadow-xs transition-all"
            >
              <IconFileText />
              <span>Sales Reports</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('detailed-items')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-neutral-600 hover:text-neutral-900 hover:bg-white/40 transition-all"
            >
              <span>Menu Items</span>
            </button>
          </div>
        </div>

        {/* Report Controls & Custom Date-Time Filter Card */}
        <div className="card p-5 space-y-4">
          {/* Report Type Selector Tabs */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 mb-2.5">Select Report Type</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
              {[
                { id: 'itemized_bill', label: 'Daily Report 1', desc: 'Itemized 80mm Bill (Name, Qty, Price, Disc, Paid)' },
                { id: 'summary_80mm', label: 'Daily Closing (80mm Z-Report)', desc: 'Drawer audit, channels & slip' },
                { id: 'transactions', label: 'Detailed Sales & Orders', desc: 'Itemized receipts & tickets' },
                { id: 'items', label: 'Product Sales Breakdown', desc: 'Units & item revenues' },
                { id: 'payments', label: 'Payment Methods Summary', desc: 'Cash vs Card vs Online' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setReportType(tab.id)}
                  className={`p-3 rounded-xl text-left border transition ${
                    reportType === tab.id
                      ? 'border-emerald-600 bg-emerald-50/60 shadow-2xs'
                      : 'border-neutral-200 bg-white hover:bg-neutral-50/80 text-neutral-700'
                  }`}
                >
                  <p className={`text-xs font-bold ${reportType === tab.id ? 'text-emerald-800' : 'text-neutral-800'}`}>
                    {tab.label}
                  </p>
                  <p className="text-[11px] text-neutral-400 mt-0.5">{tab.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Timeframe & Custom Date Time Controls */}
          <div className="pt-3 border-t border-neutral-100 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">Timeframe:</span>
                <div className="inline-flex items-center p-0.5 bg-neutral-100/90 rounded-lg border border-neutral-200/60 shadow-2xs">
                  {[
                    { id: 'today', label: 'Today' },
                    { id: '7d', label: '7 Days' },
                    { id: '30d', label: '30 Days' },
                    { id: 'all', label: 'All' },
                    { id: 'custom', label: 'Custom Range', isCustom: true },
                  ].map(({ id, label, isCustom }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => handleSelectFilterRange(id)}
                      className={`flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-md transition-all ${
                        filterRange === id
                          ? 'bg-emerald-600 text-white font-semibold shadow-2xs'
                          : 'text-neutral-600 hover:text-neutral-900 hover:bg-white/60'
                      }`}
                    >
                      {isCustom && (
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                          <line x1="16" y1="2" x2="16" y2="6" />
                          <line x1="8" y1="2" x2="8" y2="6" />
                          <line x1="3" y1="10" x2="21" y2="10" />
                        </svg>
                      )}
                      <span>{label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Date-Time Presets & Clear */}
              {filterRange === 'custom' && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] font-bold text-neutral-400 uppercase">Presets:</span>
                  <button
                    type="button"
                    onClick={() => setQuickCustomRange('today_full')}
                    className="rounded-md bg-neutral-100 hover:bg-neutral-200/80 px-2 py-0.5 text-[11px] font-semibold text-neutral-700 transition"
                  >
                    Today
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuickCustomRange('yesterday')}
                    className="rounded-md bg-neutral-100 hover:bg-neutral-200/80 px-2 py-0.5 text-[11px] font-semibold text-neutral-700 transition"
                  >
                    Yesterday
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuickCustomRange('last24h')}
                    className="rounded-md bg-neutral-100 hover:bg-neutral-200/80 px-2 py-0.5 text-[11px] font-semibold text-neutral-700 transition"
                  >
                    Last 24h
                  </button>
                  {(customStartDateTime || customEndDateTime) && (
                    <button
                      type="button"
                      onClick={() => setQuickCustomRange('clear')}
                      className="rounded-md bg-red-50 hover:bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-600 transition"
                    >
                      Clear
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Custom Range Date & Time Inputs Panel */}
            {filterRange === 'custom' && (
              <div className="p-3.5 bg-emerald-50/40 rounded-xl border border-emerald-100 space-y-2.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-emerald-900 mb-1 flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-emerald-500" />
                      From (Start Date & Time)
                    </label>
                    <input
                      type="datetime-local"
                      value={customStartDateTime}
                      onChange={(e) => setCustomStartDateTime(e.target.value)}
                      className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-800 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 shadow-2xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-emerald-900 mb-1 flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-red-500" />
                      Till (End Date & Time)
                    </label>
                    <input
                      type="datetime-local"
                      value={customEndDateTime}
                      onChange={(e) => setCustomEndDateTime(e.target.value)}
                      className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-800 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 shadow-2xs"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Summary Metrics Bar */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="rounded-2xl p-4 bg-emerald-700 text-white shadow-xs">
            <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-200">Gross Sales</p>
            <p className="text-2xl font-extrabold mt-1">
              {currencySymbol}{reportData.totalGrossRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="text-[10px] text-emerald-200 mt-0.5 font-medium">{reportData.totalOrdersCount} orders</p>
          </div>

          <div className="rounded-2xl p-4 bg-white border border-neutral-200 shadow-2xs">
            <p className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">Net Sales</p>
            <p className="text-xl font-bold text-neutral-900 mt-1">
              {currencySymbol}{reportData.totalNetRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="text-[10px] text-neutral-500 mt-0.5 font-medium">Excluding taxes & fees</p>
          </div>

          <div className="rounded-2xl p-4 bg-white border border-neutral-200 shadow-2xs">
            <p className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">Total Fees</p>
            <p className="text-xl font-bold text-neutral-900 mt-1">
              {currencySymbol}{reportData.totalFees.toFixed(2)}
            </p>
            <p className="text-[10px] text-neutral-500 mt-0.5 font-medium">Card & service charges</p>
          </div>

          <div className="rounded-2xl p-4 bg-white border border-neutral-200 shadow-2xs">
            <p className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">Items Sold</p>
            <p className="text-xl font-bold text-neutral-900 mt-1">
              {reportData.totalItemsSold}
            </p>
            <p className="text-[10px] text-neutral-500 mt-0.5 font-medium">Total quantity</p>
          </div>

          <div className="col-span-2 lg:col-span-1 rounded-2xl p-4 bg-white border border-neutral-200 shadow-2xs">
            <p className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">Avg Ticket</p>
            <p className="text-xl font-bold text-neutral-900 mt-1">
              {currencySymbol}{reportData.aov.toFixed(2)}
            </p>
            <p className="text-[10px] text-neutral-500 mt-0.5 font-medium">Per checkout</p>
          </div>
        </div>

        {/* Download & Actions Toolbar + Data Table */}
        <div className="card overflow-hidden">
          {/* Action Toolbar */}
          <div className="p-4 bg-neutral-50/70 border-b border-neutral-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-neutral-900">
                {reportType === 'itemized_bill' && 'Daily Report 1 (80mm Bill)'}
                {reportType === 'summary_80mm' && 'Day-End Sales & Closing Report (80mm Z-Report)'}
                {reportType === 'transactions' && 'Itemized Sales & Orders Table'}
                {reportType === 'items' && 'Product Sales Breakdown Table'}
                {reportType === 'payments' && 'Payment Methods Summary Table'}
              </h3>
              <p className="text-xs text-neutral-500">
                {reportType === 'itemized_bill' && 'Item-by-item sales with quantities, unit prices, discounts, paid amount and bottom-line overall totals'}
                {reportType === 'summary_80mm' && 'Complete financial audit, cash drawer count, channel breakdown & 80mm thermal slip'}
                {reportType === 'transactions' && `${reportData.filteredOrders.length} transaction records found`}
                {reportType === 'items' && `${reportData.itemsList.length} distinct items sold`}
                {reportType === 'payments' && `${reportData.paymentsList.length} payment channels`}
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={handleCopyTable}
                className="btn-ghost !text-xs !px-2.5 !py-1 font-semibold flex items-center gap-1.5 rounded-lg border border-neutral-200 shadow-2xs [&>svg]:w-3.5 [&>svg]:h-3.5"
                title="Copy table to clipboard for Excel"
              >
                {copyStatus ? '✓ Copied!' : 'Copy Data'}
              </button>
              {reportType === 'itemized_bill' || reportType === 'summary_80mm' ? (
                <button
                  type="button"
                  onClick={handlePrint80mm}
                  className="btn-green !text-xs !px-3 !py-1 font-bold flex items-center gap-1.5 shadow-2xs rounded-lg [&>svg]:w-3.5 [&>svg]:h-3.5"
                  title="Direct print to 80mm WiFi / Thermal POS Printer"
                >
                  <IconPrinter />
                  Print 80mm Slip
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="btn-ghost !text-xs !px-2.5 !py-1 font-semibold flex items-center gap-1.5 rounded-lg border border-neutral-200 shadow-2xs [&>svg]:w-3.5 [&>svg]:h-3.5"
                  title="Print or save as PDF"
                >
                  <IconPrinter />
                  Print / PDF
                </button>
              )}
              <button
                type="button"
                onClick={handleDownloadReport}
                className="btn-green !text-xs !px-3 !py-1 font-semibold flex items-center gap-1.5 shadow-2xs rounded-lg [&>svg]:w-3.5 [&>svg]:h-3.5"
              >
                <IconDownload />
                {reportType === 'itemized_bill' ? 'Download CSV' : reportType === 'summary_80mm' ? 'Download Closing CSV' : 'Download CSV'}
              </button>
            </div>
          </div>

          {/* Report Container */}
          <div className="overflow-x-auto max-h-[680px] overflow-y-auto">
            {reportType === 'itemized_bill' && (
              <div className="p-4 sm:p-6 bg-neutral-50/40">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  {/* Left Column: Itemized Table and Overall Details (8 cols) */}
                  <div className="lg:col-span-7 xl:col-span-8 space-y-4">
                    {/* Shift Information Header */}
                    <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-2xs">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block">Location</span>
                          <span className="font-bold text-neutral-900 text-sm">{restaurantSettings?.name || 'KAIFF'}</span>
                        </div>
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block">Waiter / Cashier</span>
                          <span className="font-bold text-neutral-900 text-sm">{profile?.displayName || profile?.name || 'Sergey'}</span>
                        </div>
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block">From</span>
                          <span className="font-semibold text-neutral-700">
                            {customStartDateTime ? new Date(customStartDateTime).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Beginning 00:00'}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block">Till</span>
                          <span className="font-semibold text-neutral-700">
                            {customEndDateTime ? new Date(customEndDateTime).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Current 23:59'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* 1. Itemized Table: Name | Quantity | Price | Subtotal | Discount | Paid */}
                    <div className="rounded-2xl border border-neutral-200 bg-white shadow-2xs overflow-hidden">
                      <div className="p-3.5 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/60">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-800 flex items-center gap-2">
                          <span className="flex h-5 w-5 items-center justify-center rounded bg-emerald-100 text-emerald-800 text-[10px] font-extrabold">1</span>
                          Daily Report 1 — Itemized Sales
                        </h4>
                        <span className="text-xs text-neutral-500 font-semibold">{reportData.itemsList.length} unique items</span>
                      </div>

                      <div className="overflow-x-auto max-h-[360px] overflow-y-auto">
                        <table className="w-full text-xs text-left">
                          <thead className="bg-neutral-50 text-neutral-500 font-bold uppercase tracking-wider border-b border-neutral-100 sticky top-0 z-10">
                            <tr>
                              <th className="py-2.5 px-3.5">Name</th>
                              <th className="py-2.5 px-3 text-center">Quantity</th>
                              <th className="py-2.5 px-3 text-right">Price</th>
                              <th className="py-2.5 px-3 text-right">Subtotal</th>
                              <th className="py-2.5 px-3 text-right">Discount</th>
                              <th className="py-2.5 px-3.5 text-right font-black text-neutral-800">Paid</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-neutral-100 font-medium text-neutral-700">
                            {reportData.itemsList.length === 0 ? (
                              <tr>
                                <td colSpan="6" className="py-8 text-center text-neutral-400 font-medium">
                                  No items sold in this timeframe.
                                </td>
                              </tr>
                            ) : (
                              reportData.itemsList.map((it, idx) => (
                                <tr key={idx} className="hover:bg-neutral-50/70 transition">
                                  <td className="py-2.5 px-3.5 font-bold text-neutral-900">{it.name}</td>
                                  <td className="py-2.5 px-3 text-center font-bold text-neutral-800">{it.qty}</td>
                                  <td className="py-2.5 px-3 text-right text-neutral-600">{Number(it.price || 0).toFixed(2)}</td>
                                  <td className="py-2.5 px-3 text-right font-semibold text-neutral-800">{Number(it.subtotal || it.qty * it.price).toFixed(2)}</td>
                                  <td className="py-2.5 px-3 text-right text-amber-700 font-semibold">
                                    {it.discount > 0 ? Number(it.discount).toFixed(2) : '--'}
                                  </td>
                                  <td className="py-2.5 px-3.5 text-right font-black text-emerald-700">
                                    {Number(it.paid || it.revenue).toFixed(2)}
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* 2. Overall Details Section */}
                    <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-2xs space-y-3">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-800 flex items-center gap-2 border-b border-neutral-100 pb-2.5">
                        <span className="flex h-5 w-5 items-center justify-center rounded bg-blue-100 text-blue-800 text-[10px] font-extrabold">2</span>
                        Overall Details & Financial Totals
                      </h4>

                      <div className="space-y-2.5 text-xs text-neutral-700 divide-y divide-neutral-100">
                        <div className="flex justify-between pt-1 font-medium">
                          <span className="text-neutral-500 font-semibold">Number of orders</span>
                          <span className="font-bold text-neutral-900 text-sm">{reportData.totalOrdersCount}</span>
                        </div>

                        <div className="flex justify-between pt-2">
                          <span className="text-neutral-500 font-semibold">Subtotal</span>
                          <span className="font-bold text-neutral-900">{reportData.grossItemsSubtotal.toFixed(2)} Rs</span>
                        </div>

                        <div className="flex justify-between pt-2">
                          <span className="text-neutral-500 font-semibold">Discounts</span>
                          <span className="font-bold text-amber-700">{reportData.totalDiscounts > 0 ? reportData.totalDiscounts.toFixed(2) : '0.00'} Rs</span>
                        </div>

                        <div className="flex justify-between pt-2">
                          <span className="text-neutral-500 font-semibold">Service charge fee</span>
                          <span className="font-bold text-neutral-900">{reportData.totalServiceFees.toFixed(2)} Rs</span>
                        </div>

                        <div className="flex justify-between pt-2.5 pb-1 bg-emerald-50/80 -mx-5 px-5 border-y border-emerald-100">
                          <span className="font-black text-emerald-900 uppercase text-xs">Total, incl. discounts</span>
                          <span className="font-black text-emerald-800 text-base">{reportData.totalGrossRevenue.toFixed(2)} Rs</span>
                        </div>

                        <div className="flex justify-between pt-2.5">
                          <span className="text-neutral-500 font-semibold">Cash payments</span>
                          <span className="font-bold text-neutral-900">{reportData.cashTotal.toFixed(2)} Rs</span>
                        </div>

                        <div className="flex justify-between pt-2">
                          <span className="text-neutral-500 font-semibold">Cashless payments</span>
                          <span className="font-bold text-neutral-900">{reportData.cashlessTotal.toFixed(2)} Rs</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Exact Thermal Bill Simulation Preview (4 cols) */}
                  <div className="lg:col-span-5 xl:col-span-4 bg-neutral-900 text-neutral-100 rounded-2xl p-4 sm:p-5 shadow-lg border border-neutral-800 sticky top-4 space-y-3">
                    <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                          <IconPrinter />
                          80mm Thermal Bill Preview
                        </h4>
                        <p className="text-[11px] text-neutral-400 mt-0.5">Daily Report 1 (Exact Match)</p>
                      </div>
                      <button
                        type="button"
                        onClick={handlePrint80mm}
                        className="btn-green !text-xs !px-2.5 !py-1 font-bold shadow-xs flex items-center gap-1.5 rounded-lg [&>svg]:w-3.5 [&>svg]:h-3.5"
                      >
                        <IconPrinter />
                        Print 80mm Slip
                      </button>
                    </div>

                    {/* Paper Simulation Box */}
                    <div className="bg-white text-neutral-900 rounded-xl p-4 font-mono text-[10.5px] leading-snug shadow-inner border border-neutral-200 max-h-[580px] overflow-y-auto">
                      <div className="text-center font-bold text-sm tracking-tight text-black mb-1">
                        Report for {filterRange === 'custom' && customStartDateTime ? new Date(customStartDateTime).toLocaleDateString([], { day: 'numeric', month: 'long', year: 'numeric' }) : new Date().toLocaleDateString([], { day: 'numeric', month: 'long', year: 'numeric' })}
                      </div>

                      <div className="space-y-0.5 text-[10.5px] mt-1.5">
                        <div className="flex"><span className="w-20 text-neutral-500">Location</span><span className="font-bold">{restaurantSettings?.name || 'KAIFF'}</span></div>
                        <div className="flex"><span className="w-20 text-neutral-500">Waiter</span><span className="font-bold">{profile?.displayName || profile?.name || 'Sergey'}</span></div>
                        <div className="flex"><span className="w-20 text-neutral-500">From</span><span>{customStartDateTime ? new Date(customStartDateTime).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Beginning 00:00'}</span></div>
                        <div className="flex"><span className="w-20 text-neutral-500">Till</span><span>{customEndDateTime ? new Date(customEndDateTime).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Current 23:59'}</span></div>
                      </div>

                      <div className="border-t border-dashed border-neutral-400 my-2" />

                      {/* Table Header */}
                      <div className="grid grid-cols-12 gap-0.5 font-bold text-[8.5px] border-b border-dashed border-neutral-400 pb-1 uppercase">
                        <span className="col-span-4 truncate">Name</span>
                        <span className="col-span-1 text-center">Qty</span>
                        <span className="col-span-2 text-right">Price</span>
                        <span className="col-span-2 text-right">Subtot</span>
                        <span className="col-span-1 text-right">Disc</span>
                        <span className="col-span-2 text-right">Paid</span>
                      </div>

                      {/* Table Rows (Smaller Font) */}
                      <div className="space-y-1 text-[9px] my-2">
                        {reportData.itemsList.map((it, idx) => (
                          <div key={idx} className="grid grid-cols-12 gap-0.5 items-baseline">
                            <span className="col-span-4 truncate font-medium text-neutral-900">{it.name}</span>
                            <span className="col-span-1 text-center">{it.qty}</span>
                            <span className="col-span-2 text-right text-neutral-600">{Number(it.price || 0).toFixed(0)}</span>
                            <span className="col-span-2 text-right text-neutral-600">{Number(it.subtotal || it.qty * it.price).toFixed(0)}</span>
                            <span className="col-span-1 text-right text-neutral-500">{it.discount > 0 ? Number(it.discount).toFixed(0) : '--'}</span>
                            <span className="col-span-2 text-right font-bold text-neutral-900">{Number(it.paid || it.revenue).toFixed(0)}</span>
                          </div>
                        ))}
                      </div>

                      <div className="border-t border-neutral-800 my-2.5" />

                      {/* Overall Details */}
                      <div className="space-y-2 text-[11px]">
                        <div className="flex justify-between">
                          <span>Number of orders</span>
                          <span className="font-bold">{reportData.totalOrdersCount}</span>
                        </div>

                        <div className="flex justify-between">
                          <span>Subtotal</span>
                          <span className="font-bold">{reportData.grossItemsSubtotal.toFixed(2)} Rs</span>
                        </div>

                        <div className="flex justify-between">
                          <span>Discounts</span>
                          <span className="font-bold">{reportData.totalDiscounts > 0 ? reportData.totalDiscounts.toFixed(2) : '0.00'} Rs</span>
                        </div>

                        <div className="flex justify-between">
                          <span>Service charge fee</span>
                          <span className="font-bold">{reportData.totalServiceFees.toFixed(2)} Rs</span>
                        </div>

                        <div className="flex justify-between font-extrabold text-xs text-neutral-900 border-y border-neutral-900 py-1">
                          <span>Total, incl. discounts</span>
                          <span>{reportData.totalGrossRevenue.toFixed(2)} Rs</span>
                        </div>

                        <div className="flex justify-between">
                          <span>Cash payments</span>
                          <span className="font-bold">{reportData.cashTotal.toFixed(2)} Rs</span>
                        </div>

                        <div className="flex justify-between">
                          <span>Cashless payments</span>
                          <span className="font-bold">{reportData.cashlessTotal.toFixed(2)} Rs</span>
                        </div>
                      </div>

                      <div className="border-t border-dashed border-neutral-400 my-2.5" />
                      <div className="text-center font-bold text-[10px] uppercase">*** END OF REPORT ***</div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            {reportType === 'summary_80mm' && (
              <div className="p-4 sm:p-6 bg-neutral-50/40">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  {/* Left Column: Structured Reconciliation & Audit (7 cols) */}
                  <div className="lg:col-span-7 xl:col-span-8 space-y-4">
                    {/* 1. Financial Summary */}
                    <div className="rounded-2xl border border-neutral-200 bg-white p-4 sm:p-5 shadow-2xs space-y-3">
                      <div className="flex items-center justify-between border-b border-neutral-100 pb-2.5">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-800 flex items-center gap-2">
                          <span className="flex h-5 w-5 items-center justify-center rounded bg-emerald-100 text-emerald-800 text-[10px] font-extrabold">1</span>
                          Financial & Revenue Breakdown
                        </h4>
                        <span className="text-xs text-neutral-400 font-semibold">{reportData.totalOrdersCount} checkouts</span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                        <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200/60">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Gross Subtotal</p>
                          <p className="text-sm sm:text-base font-bold text-neutral-900 mt-1">
                            {currencySymbol}{reportData.grossItemsSubtotal.toFixed(2)}
                          </p>
                        </div>
                        <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200/60">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Service Fee (10%)</p>
                          <p className="text-sm sm:text-base font-bold text-neutral-900 mt-1">
                            {currencySymbol}{reportData.totalServiceFees.toFixed(2)}
                          </p>
                        </div>
                        <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200/60">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Card Fee (3%)</p>
                          <p className="text-sm sm:text-base font-bold text-neutral-900 mt-1">
                            {currencySymbol}{reportData.totalCardFees.toFixed(2)}
                          </p>
                        </div>
                        <div className="p-3 bg-emerald-700 text-white rounded-xl shadow-xs">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-200">Grand Total</p>
                          <p className="text-base sm:text-lg font-black text-white mt-0.5">
                            {currencySymbol}{reportData.totalGrossRevenue.toFixed(2)}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* 2. Payment Method & Cash Drawer Reconciliation */}
                    <div className="rounded-2xl border border-neutral-200 bg-white p-4 sm:p-5 shadow-2xs space-y-3">
                      <div className="flex items-center justify-between border-b border-neutral-100 pb-2.5">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-800 flex items-center gap-2">
                          <span className="flex h-5 w-5 items-center justify-center rounded bg-blue-100 text-blue-800 text-[10px] font-extrabold">2</span>
                          Payment Reconciliation & Cash Drawer Audit
                        </h4>
                        <span className="text-[10px] font-bold uppercase text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">Reconciled</span>
                      </div>

                      {/* Cash in Drawer Hero Box */}
                      <div className="p-4 bg-emerald-50/80 border border-emerald-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                            💵 Expected Physical Cash in Register
                          </p>
                          <p className="text-[11px] text-emerald-600 mt-0.5">Count drawer notes & coins to balance against this figure</p>
                        </div>
                        <div className="text-left sm:text-right">
                          <p className="text-xl sm:text-2xl font-black text-emerald-800">
                            {currencySymbol}{reportData.cashTotal.toFixed(2)}
                          </p>
                        </div>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-xs text-left">
                          <thead>
                            <tr className="border-b border-neutral-100 text-neutral-400 font-semibold uppercase">
                              <th className="py-2">Payment Method</th>
                              <th className="py-2 text-center">Orders Count</th>
                              <th className="py-2 text-right">Gross Volume</th>
                              <th className="py-2 text-right">Fees Deducted</th>
                              <th className="py-2 text-right">Net Settlement</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-neutral-50 font-medium text-neutral-700">
                            {reportData.paymentsList.map((pm, idx) => (
                              <tr key={idx} className="hover:bg-neutral-50/60">
                                <td className="py-2 font-bold text-neutral-900">{pm.method}</td>
                                <td className="py-2 text-center text-neutral-600">{pm.count}</td>
                                <td className="py-2 text-right font-semibold text-neutral-900">{currencySymbol}{pm.gross.toFixed(2)}</td>
                                <td className="py-2 text-right text-neutral-500">{currencySymbol}{pm.fees.toFixed(2)}</td>
                                <td className="py-2 text-right font-bold text-emerald-700">{currencySymbol}{pm.net.toFixed(2)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* 3. Sales By Channel */}
                    <div className="rounded-2xl border border-neutral-200 bg-white p-4 sm:p-5 shadow-2xs space-y-3">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-800 flex items-center gap-2 border-b border-neutral-100 pb-2.5">
                        <span className="flex h-5 w-5 items-center justify-center rounded bg-amber-100 text-amber-800 text-[10px] font-extrabold">3</span>
                        Sales by Order Channel
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        {reportData.channelList.map((c, idx) => (
                          <div key={idx} className="p-3 rounded-xl border border-neutral-200/60 bg-neutral-50/70">
                            <p className="text-xs font-bold text-neutral-800">{c.channel}</p>
                            <div className="flex items-baseline justify-between mt-2">
                              <span className="text-xs text-neutral-500">{c.count} checkouts</span>
                              <span className="text-sm font-extrabold text-neutral-900">{currencySymbol}{c.total.toFixed(2)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* 4. Menu Items Summary */}
                    <div className="rounded-2xl border border-neutral-200 bg-white p-4 sm:p-5 shadow-2xs space-y-3">
                      <div className="flex items-center justify-between border-b border-neutral-100 pb-2.5">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-800 flex items-center gap-2">
                          <span className="flex h-5 w-5 items-center justify-center rounded bg-indigo-100 text-indigo-800 text-[10px] font-extrabold">4</span>
                          Product Sales Summary
                        </h4>
                        <span className="text-xs text-neutral-500 font-semibold">{reportData.totalItemsSold} total units</span>
                      </div>
                      <div className="max-h-52 overflow-y-auto">
                        <table className="w-full text-xs text-left">
                          <thead className="sticky top-0 bg-white text-neutral-400 font-semibold uppercase border-b border-neutral-100">
                            <tr>
                              <th className="py-2">Item Name</th>
                              <th className="py-2 text-center">Qty</th>
                              <th className="py-2 text-right">Unit Price</th>
                              <th className="py-2 text-right">Total Revenue</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-neutral-50 font-medium text-neutral-700">
                            {reportData.itemsList.map((it, idx) => (
                              <tr key={idx} className="hover:bg-neutral-50/60">
                                <td className="py-2 font-bold text-neutral-900">{it.name}</td>
                                <td className="py-2 text-center font-semibold">{it.qty}</td>
                                <td className="py-2 text-right text-neutral-500">{currencySymbol}{it.price.toFixed(2)}</td>
                                <td className="py-2 text-right font-extrabold text-neutral-900">{currencySymbol}{it.revenue.toFixed(2)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: 80mm Thermal Receipt Simulation (5 cols) */}
                  <div className="lg:col-span-5 xl:col-span-4 bg-neutral-900 text-neutral-100 rounded-2xl p-4 sm:p-5 shadow-lg border border-neutral-800 sticky top-4 space-y-3">
                    <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                          <IconPrinter />
                          80mm WiFi Print Slip
                        </h4>
                        <p className="text-[11px] text-neutral-400 mt-0.5">Thermal POS Preview</p>
                      </div>
                      <button
                        type="button"
                        onClick={handlePrint80mm}
                        className="btn-green text-xs px-3 py-1.5 font-bold shadow-xs flex items-center gap-1.5"
                      >
                        <IconPrinter />
                        Print 80mm Slip
                      </button>
                    </div>

                    {/* Paper Simulation Box */}
                    <div className="bg-white text-neutral-900 rounded-xl p-4 font-mono text-[11px] leading-relaxed shadow-inner border border-neutral-200 max-h-[580px] overflow-y-auto">
                      <div className="text-center font-bold text-sm tracking-tight text-black">
                        {restaurantSettings?.name || 'Restaurant POS'}
                      </div>
                      {restaurantSettings?.address && (
                        <div className="text-center text-[10px] text-neutral-600 mt-0.5">{restaurantSettings.address}</div>
                      )}
                      {restaurantSettings?.phone && (
                        <div className="text-center text-[10px] text-neutral-600">Tel: {restaurantSettings.phone}</div>
                      )}
                      <div className="border-t border-dashed border-neutral-400 my-2" />
                      <div className="text-center font-bold text-xs uppercase tracking-tight text-neutral-900">
                        DAILY SALES CLOSING REPORT
                      </div>
                      <div className="text-center text-[10px] text-neutral-500 font-sans font-semibold">(Z-REPORT / 80MM)</div>
                      <div className="border-t border-dashed border-neutral-400 my-2" />

                      <div className="space-y-1 text-[10.5px]">
                        <div className="flex justify-between">
                          <span className="text-neutral-500">Period:</span>
                          <span className="font-bold">{filterRange === 'today' ? 'Today' : filterRange === '7d' ? 'Last 7 Days' : filterRange === '30d' ? 'Last 30 Days' : 'Custom'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-neutral-500">Orders:</span>
                          <span>#{reportData.filteredOrders.length > 0 ? reportData.filteredOrders[reportData.filteredOrders.length - 1].id : 0} - #{reportData.filteredOrders.length > 0 ? reportData.filteredOrders[0].id : 0} ({reportData.totalOrdersCount})</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-neutral-500">Printed:</span>
                          <span>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </div>

                      <div className="border-t border-neutral-800 my-2" />
                      <div className="font-bold text-[11px] uppercase tracking-tight text-neutral-900">1. FINANCIAL SUMMARY</div>
                      <div className="border-t border-dashed border-neutral-400 my-1" />
                      <div className="space-y-1 text-[10.5px]">
                        <div className="flex justify-between">
                          <span>Gross Subtotal:</span>
                          <span>{currencySymbol}{reportData.grossItemsSubtotal.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Service Fee:</span>
                          <span>{currencySymbol}{reportData.totalServiceFees.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Card Fee:</span>
                          <span>{currencySymbol}{reportData.totalCardFees.toFixed(2)}</span>
                        </div>
                        <div className="border-t-2 border-neutral-900 my-1" />
                        <div className="flex justify-between font-extrabold text-xs text-neutral-900">
                          <span>GRAND TOTAL:</span>
                          <span>{currencySymbol}{reportData.totalGrossRevenue.toFixed(2)}</span>
                        </div>
                        <div className="border-t-2 border-neutral-900 my-1" />
                      </div>

                      <div className="font-bold text-[11px] uppercase tracking-tight text-neutral-900 mt-2.5">2. PAYMENT RECONCILIATION</div>
                      <div className="border-t border-dashed border-neutral-400 my-1" />
                      <div className="space-y-1 text-[10.5px]">
                        {reportData.paymentsList.map((p, idx) => (
                          <div key={idx} className="flex justify-between">
                            <span>{p.method} ({p.count})</span>
                            <span className="font-bold">{currencySymbol}{p.gross.toFixed(2)}</span>
                          </div>
                        ))}
                        <div className="border-t border-dashed border-neutral-400 my-1" />
                        <div className="flex justify-between font-bold text-[10.5px] text-emerald-800 bg-emerald-50 px-1 py-0.5 rounded">
                          <span>CASH IN REGISTER:</span>
                          <span>{currencySymbol}{reportData.cashTotal.toFixed(2)}</span>
                        </div>
                      </div>

                      <div className="font-bold text-[11px] uppercase tracking-tight text-neutral-900 mt-2.5">3. SALES BY CHANNEL</div>
                      <div className="border-t border-dashed border-neutral-400 my-1" />
                      <div className="space-y-1 text-[10.5px]">
                        {reportData.channelList.map((c, idx) => (
                          <div key={idx} className="flex justify-between">
                            <span>{c.channel} ({c.count})</span>
                            <span>{currencySymbol}{c.total.toFixed(2)}</span>
                          </div>
                        ))}
                      </div>

                      <div className="font-bold text-[11px] uppercase tracking-tight text-neutral-900 mt-2.5">4. ITEMS SOLD</div>
                      <div className="border-t border-dashed border-neutral-400 my-1" />
                      <div className="space-y-1 text-[10px]">
                        {reportData.itemsList.slice(0, 8).map((it, idx) => (
                          <div key={idx} className="flex justify-between">
                            <span className="truncate max-w-[130px]">{it.name}</span>
                            <span>{it.qty}x</span>
                            <span className="font-semibold">{currencySymbol}{it.revenue.toFixed(2)}</span>
                          </div>
                        ))}
                      </div>

                      <div className="border-t border-dashed border-neutral-400 my-2.5" />
                      <div className="space-y-1.5 text-[10px] text-neutral-600 font-sans">
                        <div>Cashier: _______________________</div>
                        <div>Manager: _______________________</div>
                      </div>

                      <div className="border-t border-neutral-900 my-2" />
                      <div className="text-center font-bold text-[10.5px] uppercase">*** END OF REPORT ***</div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            {reportType === 'transactions' && (
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-neutral-50 text-neutral-600 font-bold uppercase tracking-wider border-b border-neutral-200 sticky top-0 z-10">
                  <tr>
                    <th className="py-3 px-4">Order ID</th>
                    <th className="py-3 px-4">Date & Time</th>
                    <th className="py-3 px-4">Channel</th>
                    <th className="py-3 px-4">Table / Room</th>
                    <th className="py-3 px-4">Items Summary</th>
                    <th className="py-3 px-4">Payment</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Fees</th>
                    <th className="py-3 px-4 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 font-medium text-neutral-700">
                  {reportData.filteredOrders.length === 0 ? (
                    <tr>
                      <td colSpan="9" className="py-10 text-center text-neutral-400 font-medium">
                        No transactions found for the selected date/time window.
                      </td>
                    </tr>
                  ) : (
                    reportData.filteredOrders.map((order) => {
                      const dateObj = order.createdAt?.toDate ? order.createdAt.toDate() : new Date(order.createdAt || 0)
                      const dateFormatted = !isNaN(dateObj.getTime())
                        ? dateObj.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                        : '—'
                      const total = Number(order.total || 0)
                      const fees = Number(order.serviceFeeAmount || 0) + Number(order.cardFeeAmount || 0)

                      return (
                        <tr key={order.id} className="hover:bg-neutral-50/80 transition">
                          <td className="py-3 px-4 font-mono font-bold text-neutral-900">#{order.id}</td>
                          <td className="py-3 px-4 text-neutral-500 whitespace-nowrap">{dateFormatted}</td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${order.source === 'ONLINE' ? 'bg-sky-50 text-sky-700 border border-sky-200' : 'bg-neutral-100 text-neutral-700'}`}>
                              {order.source || 'COUNTER'}
                            </span>
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            {order.tableNumber !== undefined && order.tableNumber !== null
                              ? `Table ${order.tableNumber}`
                              : order.roomNumber
                              ? `Room ${order.roomNumber}`
                              : 'Walk-in'}
                          </td>
                          <td className="py-3 px-4 max-w-xs truncate" title={Array.isArray(order.items) ? order.items.map(i => `${i.qty || 1}x ${i.name}`).join(', ') : ''}>
                            {Array.isArray(order.items) && order.items.length > 0 ? (
                              order.items.map((i, idx) => (
                                <span key={idx} className="mr-1 inline-block bg-neutral-100 px-1.5 py-0.5 rounded text-[11px] text-neutral-800">
                                  {i.qty || 1}x {i.name}
                                </span>
                              ))
                            ) : (
                              <span className="text-neutral-400">No items</span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${order.paymentMethod === 'CARD' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                              {order.paymentMethod || 'CASH'}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-green-50 text-green-700 border border-green-200">
                              {order.status || 'PAID'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right text-neutral-500 whitespace-nowrap">
                            {currencySymbol}{fees.toFixed(2)}
                          </td>
                          <td className="py-3 px-4 text-right font-extrabold text-neutral-900 whitespace-nowrap">
                            {currencySymbol}{total.toFixed(2)}
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
                {reportData.filteredOrders.length > 0 && (
                  <tfoot className="bg-neutral-100/80 font-bold text-neutral-900 border-t border-neutral-300 sticky bottom-0 z-10">
                    <tr>
                      <td colSpan="4" className="py-3 px-4">TOTALS ({reportData.filteredOrders.length} Transactions)</td>
                      <td className="py-3 px-4 text-neutral-600">{reportData.totalItemsSold} items sold</td>
                      <td colSpan="2"></td>
                      <td className="py-3 px-4 text-right text-neutral-700">{currencySymbol}{reportData.totalFees.toFixed(2)}</td>
                      <td className="py-3 px-4 text-right font-black text-emerald-700 text-sm">
                        {currencySymbol}{reportData.totalGrossRevenue.toFixed(2)}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            )}

            {reportType === 'items' && (
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-neutral-50 text-neutral-600 font-bold uppercase tracking-wider border-b border-neutral-200 sticky top-0 z-10">
                  <tr>
                    <th className="py-3 px-4">Menu Item Name</th>
                    <th className="py-3 px-4 text-center">Units Sold</th>
                    <th className="py-3 px-4 text-right">Unit Price</th>
                    <th className="py-3 px-4 text-right">Total Revenue</th>
                    <th className="py-3 px-4 text-right">% Contribution</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 font-medium text-neutral-700">
                  {reportData.itemsList.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="py-10 text-center text-neutral-400 font-medium">
                        No item sales recorded for this period.
                      </td>
                    </tr>
                  ) : (
                    reportData.itemsList.map((item, idx) => (
                      <tr key={idx} className="hover:bg-neutral-50/80 transition">
                        <td className="py-3 px-4 font-bold text-neutral-900">{item.name}</td>
                        <td className="py-3 px-4 text-center font-semibold text-neutral-800">{item.qty}</td>
                        <td className="py-3 px-4 text-right text-neutral-600">{currencySymbol}{item.price.toFixed(2)}</td>
                        <td className="py-3 px-4 text-right font-extrabold text-neutral-900">{currencySymbol}{item.revenue.toFixed(2)}</td>
                        <td className="py-3 px-4 text-right">
                          <span className="bg-green-50 text-green-700 px-2 py-0.5 rounded font-bold text-[11px]">
                            {item.percentage.toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {reportData.itemsList.length > 0 && (
                  <tfoot className="bg-neutral-100/80 font-bold text-neutral-900 border-t border-neutral-300 sticky bottom-0 z-10">
                    <tr>
                      <td className="py-3 px-4">TOTALS ({reportData.itemsList.length} Items)</td>
                      <td className="py-3 px-4 text-center">{reportData.totalItemsSold}</td>
                      <td></td>
                      <td className="py-3 px-4 text-right font-black text-emerald-700 text-sm">
                        {currencySymbol}{reportData.totalGrossRevenue.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right font-bold">100.0%</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            )}

            {reportType === 'payments' && (
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-neutral-50 text-neutral-600 font-bold uppercase tracking-wider border-b border-neutral-200 sticky top-0 z-10">
                  <tr>
                    <th className="py-3 px-4">Payment Method</th>
                    <th className="py-3 px-4 text-center">Transactions Count</th>
                    <th className="py-3 px-4 text-right">Gross Volume</th>
                    <th className="py-3 px-4 text-right">Fees Deducted</th>
                    <th className="py-3 px-4 text-right">Net Revenue</th>
                    <th className="py-3 px-4 text-right">% Volume Share</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 font-medium text-neutral-700">
                  {reportData.paymentsList.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="py-10 text-center text-neutral-400 font-medium">
                        No payments recorded in this period.
                      </td>
                    </tr>
                  ) : (
                    reportData.paymentsList.map((pm, idx) => (
                      <tr key={idx} className="hover:bg-neutral-50/80 transition">
                        <td className="py-3 px-4 font-bold text-neutral-900 flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${pm.method === 'CARD' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                            {pm.method}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center font-semibold text-neutral-800">{pm.count}</td>
                        <td className="py-3 px-4 text-right font-extrabold text-neutral-900">{currencySymbol}{pm.gross.toFixed(2)}</td>
                        <td className="py-3 px-4 text-right text-neutral-500">{currencySymbol}{pm.fees.toFixed(2)}</td>
                        <td className="py-3 px-4 text-right font-bold text-emerald-700">{currencySymbol}{pm.net.toFixed(2)}</td>
                        <td className="py-3 px-4 text-right font-bold text-neutral-700">{pm.percentage.toFixed(1)}%</td>
                      </tr>
                    ))
                  )}
                </tbody>
                {reportData.paymentsList.length > 0 && (
                  <tfoot className="bg-neutral-100/80 font-bold text-neutral-900 border-t border-neutral-300 sticky bottom-0 z-10">
                    <tr>
                      <td className="py-3 px-4">TOTALS</td>
                      <td className="py-3 px-4 text-center">{reportData.totalOrdersCount}</td>
                      <td className="py-3 px-4 text-right font-black text-emerald-700 text-sm">
                        {currencySymbol}{reportData.totalGrossRevenue.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right text-neutral-700">{currencySymbol}{reportData.totalFees.toFixed(2)}</td>
                      <td className="py-3 px-4 text-right font-bold text-emerald-800">{currencySymbol}{reportData.totalNetRevenue.toFixed(2)}</td>
                      <td className="py-3 px-4 text-right font-bold">100.0%</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (viewMode === 'detailed-items') {
    return (
      <div className="p-6 sm:p-8 space-y-6">
        {/* Back Button & Header */}
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4 border-b border-green-100/80 pb-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <button
                onClick={() => {
                  setHoveredItemPoint(null)
                  setViewMode('dashboard')
                }}
                className="text-[11px] font-bold text-neutral-400 hover:text-green-600 transition uppercase tracking-wider flex items-center gap-1"
              >
                Analytics
              </button>
              <span className="text-neutral-300">/</span>
              <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">Menu Items</span>
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-neutral-900 flex items-center gap-2">
              Menu Items Analytics
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
            {/* View Mode Switcher */}
            <div className="inline-flex items-center p-1 bg-neutral-100/90 rounded-xl border border-neutral-200/60 shadow-2xs">
              <button
                type="button"
                onClick={() => { setHoveredItemPoint(null); setViewMode('dashboard'); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-neutral-600 hover:text-neutral-900 hover:bg-white/40 transition-all"
              >
                <IconAnalytics />
                <span>Overview</span>
              </button>
              <button
                type="button"
                onClick={() => { setHoveredItemPoint(null); setViewMode('reports'); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-neutral-600 hover:text-neutral-900 hover:bg-white/40 transition-all"
              >
                <IconFileText />
                <span>Sales Reports</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('detailed-items')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white text-emerald-800 shadow-xs transition-all"
              >
                <span>Menu Items</span>
              </button>
            </div>

            {/* Timeframe Compact Segmented Control */}
            <div className="inline-flex items-center p-0.5 bg-neutral-100/90 rounded-lg border border-neutral-200/60 shadow-2xs">
              {[
                { id: 'today', label: 'Today' },
                { id: '7d', label: '7 Days' },
                { id: '30d', label: '30 Days' },
                { id: 'all', label: 'All' },
                { id: 'custom', label: 'Custom', isCustom: true },
              ].map(({ id, label, isCustom }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setHoveredItemPoint(null)
                    setDetailedFilterRange(id)
                    if (id === 'custom' && !customStartDateTime && !customEndDateTime) {
                      setQuickCustomRange('today_full')
                    }
                  }}
                  className={`flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-md transition-all ${
                    detailedFilterRange === id
                      ? 'bg-emerald-600 text-white font-semibold shadow-2xs'
                      : 'text-neutral-600 hover:text-neutral-900 hover:bg-white/60'
                  }`}
                >
                  {isCustom && (
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                      <line x1="16" y1="2" x2="16" y2="6" />
                      <line x1="8" y1="2" x2="8" y2="6" />
                      <line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                  )}
                  <span>{label}</span>
                </button>
              ))}
            </div>

            {detailedFilterRange === 'custom' && (
              <div className="flex flex-wrap items-center gap-1.5 ml-1">
                <input
                  type="datetime-local"
                  value={customStartDateTime}
                  onChange={(e) => setCustomStartDateTime(e.target.value)}
                  className="rounded-lg border border-neutral-300 bg-white px-2 py-1 text-[11px] font-semibold text-neutral-700 outline-none focus:border-green-500 shadow-2xs"
                />
                <span className="text-xs text-neutral-400 font-bold">to</span>
                <input
                  type="datetime-local"
                  value={customEndDateTime}
                  onChange={(e) => setCustomEndDateTime(e.target.value)}
                  className="rounded-lg border border-neutral-300 bg-white px-2 py-1 text-[11px] font-semibold text-neutral-700 outline-none focus:border-green-500 shadow-2xs"
                />
              </div>
            )}
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
              <p className="text-xs text-neutral-500">List of all items sold with quantities and pricing</p>
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
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-50 font-medium text-neutral-700">
                {allItemsStats.itemsList.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="py-6 text-center text-neutral-400 font-medium">
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
      <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4 border-b border-green-100/80 pb-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">POS Sales</p>
          <div className="mt-0.5 flex items-center gap-2.5">
            <h2 className="text-2xl font-bold tracking-tight text-neutral-900">Restaurant Analytics</h2>
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200/80 rounded-full px-2.5 py-0.5 shadow-2xs">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Connected
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
          {/* View Mode Switcher */}
          <div className="inline-flex items-center p-1 bg-neutral-100/90 rounded-xl border border-neutral-200/60 shadow-2xs">
            <button
              type="button"
              onClick={() => setViewMode('dashboard')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                viewMode === 'dashboard'
                  ? 'bg-white text-emerald-800 shadow-xs'
                  : 'text-neutral-600 hover:text-neutral-900 hover:bg-white/40'
              }`}
            >
              <IconAnalytics />
              <span>Overview</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('reports')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                viewMode === 'reports'
                  ? 'bg-white text-emerald-800 shadow-xs'
                  : 'text-neutral-600 hover:text-neutral-900 hover:bg-white/40'
              }`}
            >
              <IconFileText />
              <span>Sales Reports</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('detailed-items')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                viewMode === 'detailed-items'
                  ? 'bg-white text-emerald-800 shadow-xs'
                  : 'text-neutral-600 hover:text-neutral-900 hover:bg-white/40'
              }`}
            >
              <span>Menu Items</span>
            </button>
          </div>

          {/* Timeframe Compact Segmented Control */}
          <div className="inline-flex items-center p-0.5 bg-neutral-100/90 rounded-lg border border-neutral-200/60 shadow-2xs">
            {[
              { id: 'today', label: 'Today' },
              { id: '7d', label: '7 Days' },
              { id: '30d', label: '30 Days' },
              { id: 'all', label: 'All' },
              { id: 'custom', label: 'Custom', isCustom: true },
            ].map(({ id, label, isCustom }) => (
              <button
                key={id}
                type="button"
                onClick={() => handleSelectFilterRange(id)}
                className={`flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-md transition-all ${
                  filterRange === id
                    ? 'bg-emerald-600 text-white font-semibold shadow-2xs'
                    : 'text-neutral-600 hover:text-neutral-900 hover:bg-white/60'
                }`}
              >
                {isCustom && (
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                )}
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Custom Date & Time Selector Panel */}
      {filterRange === 'custom' && (
        <div className="rounded-2xl border border-green-200 bg-gradient-to-br from-green-50/80 via-white to-emerald-50/40 p-4 sm:p-5 shadow-sm space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-green-100/80 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-600 text-white shadow-sm flex-shrink-0">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
              </div>
              <div>
                <h4 className="text-sm font-bold text-neutral-900">Custom Date & Time Range</h4>
                <p className="text-xs text-neutral-500">Select dates and exact hours via calendar view to filter POS sales data</p>
              </div>
            </div>

            {/* Quick Shift / Window Presets */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider mr-1">Presets:</span>
              <button
                type="button"
                onClick={() => setQuickCustomRange('today_full')}
                className="rounded-lg bg-white border border-neutral-200 px-2.5 py-1 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 transition shadow-2xs"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => setQuickCustomRange('yesterday')}
                className="rounded-lg bg-white border border-neutral-200 px-2.5 py-1 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 transition shadow-2xs"
              >
                Yesterday
              </button>
              <button
                type="button"
                onClick={() => setQuickCustomRange('last24h')}
                className="rounded-lg bg-white border border-neutral-200 px-2.5 py-1 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 transition shadow-2xs"
              >
                Last 24h
              </button>
              {(customStartDateTime || customEndDateTime) && (
                <button
                  type="button"
                  onClick={() => setQuickCustomRange('clear')}
                  className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-100 transition"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Date & Time Selectors */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1.5 flex items-center gap-1.5">
                <span className="flex h-2 w-2 rounded-full bg-green-500" />
                Start Date & Time (From)
              </label>
              <input
                type="datetime-local"
                value={customStartDateTime}
                onChange={(e) => setCustomStartDateTime(e.target.value)}
                className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm font-semibold text-neutral-800 outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-100 shadow-2xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1.5 flex items-center gap-1.5">
                <span className="flex h-2 w-2 rounded-full bg-red-500" />
                End Date & Time (To)
              </label>
              <input
                type="datetime-local"
                value={customEndDateTime}
                onChange={(e) => setCustomEndDateTime(e.target.value)}
                className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm font-semibold text-neutral-800 outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-100 shadow-2xs"
              />
            </div>
          </div>

          {/* Active Range Summary Pill */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-neutral-600 bg-white/80 backdrop-blur-sm rounded-xl p-3 border border-green-100">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-green-800">Filtered Window:</span>
              <span className="font-mono text-neutral-800">
                {customStartDateTime ? new Date(customStartDateTime).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Beginning'}
                {' → '}
                {customEndDateTime ? new Date(customEndDateTime).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Latest'}
              </span>
            </div>
            <div className="font-bold text-green-700 bg-green-100/70 px-2.5 py-1 rounded-lg">
              {filteredOrders.length} {filteredOrders.length === 1 ? 'order' : 'orders'} matched
            </div>
          </div>
        </div>
      )}

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
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-base font-bold text-neutral-900">Recent Transactions</h3>
            <p className="text-xs text-neutral-500">Last checkout operations synced from POS app</p>
          </div>
          <button
            onClick={() => setViewMode('reports')}
            className="text-xs font-semibold text-green-600 hover:text-green-700 hover:underline transition flex items-center gap-1"
          >
            <span>Full Sales Report</span>
            <span>→</span>
          </button>
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
