import { initializeApp, getApps } from 'firebase/app'
import {
  getFirestore,
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  where,
  limit,
  serverTimestamp,
  onSnapshot,
} from 'firebase/firestore'

export const BAR_CATEGORIES = [
  'Beer',
  'Wine & Champagne',
  'Whiskey & Bourbon',
  'Vodka',
  'Gin',
  'Rum',
  'Tequila & Mezcal',
  'Brandy & Cognac',
  'Liqueurs & Cordials',
  'Cocktail Pre-mixes / Shots',
  'Soft Drinks & Mixers',
  'Juices & Energy Drinks',
  'Mineral Water',
  'Bar Supplies & Garnishes',
  'Other Bar Items',
]

export const DEFAULT_UNITS = [
  'Bottles',
  'Cans',
  'Pcs',
  'Liters (L)',
  'Milliliters (ml)',
  'Kegs',
  'Cases / Crates',
  'Shots (25ml/50ml)',
  'Glasses',
]

export const MOVEMENT_TYPES = {
  STOCK_IN: 'stock_in',
  STOCK_OUT: 'stock_out',
  ADJUSTMENT: 'adjustment',
  SALE: 'sale',
  DAMAGE: 'damage',
  WASTE: 'waste',
  INTERNAL_USE: 'internal_use',
  REFUND: 'refund',
}

export const STOCK_OUT_REASONS = [
  { id: 'damaged', label: 'Damaged' },
  { id: 'expired', label: 'Expired' },
  { id: 'wasted', label: 'Wasted / Spilled' },
  { id: 'lost', label: 'Lost / Discrepancy' },
  { id: 'internal_use', label: 'Internal / Staff / Promo Use' },
  { id: 'adjustment', label: 'Stock Adjustment' },
  { id: 'other', label: 'Other' },
]

/**
 * Initializes and returns the Firestore instance for the backup database.
 */
export const getBackupFirestore = (backupConfig) => {
  if (!backupConfig?.apiKey || !backupConfig?.projectId || !backupConfig?.appId) {
    return null
  }

  const config = {
    apiKey: backupConfig.apiKey,
    authDomain: backupConfig.authDomain || `${backupConfig.projectId}.firebaseapp.com`,
    projectId: backupConfig.projectId,
    storageBucket: backupConfig.storageBucket || `${backupConfig.projectId}.appspot.com`,
    messagingSenderId: backupConfig.messagingSenderId,
    appId: backupConfig.appId,
  }

  const appName = `backup_inventory_${backupConfig.projectId}`
  const apps = getApps()
  const existingApp = apps.find((app) => app.name === appName)
  const app = existingApp || initializeApp(config, appName)
  return getFirestore(app)
}

/**
 * Checks if backup database is properly configured
 */
export const isBackupDbConfigured = (backupConfig) => {
  return Boolean(backupConfig?.apiKey && backupConfig?.projectId && backupConfig?.appId)
}

/**
 * Fetch all bar inventory items from backup database
 */
export const getBarInventoryItems = async (backupConfig) => {
  const db = getBackupFirestore(backupConfig)
  if (!db) return []

  try {
    const itemsRef = collection(db, 'inventory_items')
    const snapshot = await getDocs(itemsRef)
    const items = []
    snapshot.forEach((docSnap) => {
      const data = docSnap.data()
      items.push({
        id: docSnap.id,
        ...data,
        currentStock: Number(data.currentStock ?? 0),
        reorderLevel: Number(data.reorderLevel ?? 10),
        maxStock: data.maxStock ? Number(data.maxStock) : null,
        costPrice: Number(data.costPrice ?? 0),
        sellingPrice: Number(data.sellingPrice ?? 0),
      })
    })
    return items
  } catch (error) {
    console.error('Error fetching bar inventory items:', error)
    throw error
  }
}

/**
 * Subscribe to bar inventory items in real-time
 */
export const subscribeToBarInventoryItems = (backupConfig, onUpdate, onError) => {
  const db = getBackupFirestore(backupConfig)
  if (!db) {
    onUpdate([])
    return () => {}
  }

  try {
    const itemsRef = collection(db, 'inventory_items')
    return onSnapshot(
      itemsRef,
      (snapshot) => {
        const items = []
        snapshot.forEach((docSnap) => {
          const data = docSnap.data()
          items.push({
            id: docSnap.id,
            ...data,
            currentStock: Number(data.currentStock ?? 0),
            reorderLevel: Number(data.reorderLevel ?? 10),
            maxStock: data.maxStock ? Number(data.maxStock) : null,
            costPrice: Number(data.costPrice ?? 0),
            sellingPrice: Number(data.sellingPrice ?? 0),
          })
        })
        onUpdate(items)
      },
      (err) => {
        console.error('Error listening to bar inventory items:', err)
        if (onError) onError(err)
      }
    )
  } catch (err) {
    if (onError) onError(err)
    return () => {}
  }
}

/**
 * Add or update a bar inventory item
 */
export const saveBarInventoryItem = async (backupConfig, itemData) => {
  const db = getBackupFirestore(backupConfig)
  if (!db) throw new Error('Backup database is not configured.')

  const { id, ...dataToSave } = itemData

  const payload = {
    name: dataToSave.name?.trim() || 'Unnamed Item',
    sku: dataToSave.sku?.trim() || '',
    category: dataToSave.category || 'Other Bar Items',
    currentStock: Number(dataToSave.currentStock ?? 0),
    reorderLevel: Number(dataToSave.reorderLevel ?? 10),
    maxStock: dataToSave.maxStock ? Number(dataToSave.maxStock) : null,
    unit: dataToSave.unit || 'Bottles',
    costPrice: Number(dataToSave.costPrice ?? 0),
    sellingPrice: Number(dataToSave.sellingPrice ?? 0),
    trackingEnabled: dataToSave.trackingEnabled !== false,
    supplier: dataToSave.supplier?.trim() || '',
    notes: dataToSave.notes?.trim() || '',
    linkedMenuItemId: dataToSave.linkedMenuItemId || null,
    updatedAt: new Date().toISOString(),
  }

  if (id) {
    const itemRef = doc(db, 'inventory_items', id)
    await updateDoc(itemRef, payload)
    return id
  } else {
    payload.createdAt = new Date().toISOString()
    const colRef = collection(db, 'inventory_items')
    const docRef = await addDoc(colRef, payload)
    return docRef.id
  }
}

/**
 * Delete a bar inventory item
 */
export const deleteBarInventoryItem = async (backupConfig, itemId) => {
  const db = getBackupFirestore(backupConfig)
  if (!db) throw new Error('Backup database is not configured.')

  const itemRef = doc(db, 'inventory_items', itemId)
  await deleteDoc(itemRef)
  return true
}

/**
 * Record a stock movement in inventory_movements ledger
 */
export const recordStockMovement = async (backupConfig, movement) => {
  const db = getBackupFirestore(backupConfig)
  if (!db) throw new Error('Backup database is not configured.')

  const payload = {
    itemId: movement.itemId,
    itemName: movement.itemName || '',
    sku: movement.sku || '',
    category: movement.category || '',
    type: movement.type, // 'stock_in', 'stock_out', 'adjustment', 'sale', 'damage', 'waste', 'internal_use', 'refund'
    quantity: Number(movement.quantity || 0), // signed or delta
    previousStock: Number(movement.previousStock ?? 0),
    newStock: Number(movement.newStock ?? 0),
    costPrice: Number(movement.costPrice ?? 0),
    sellingPrice: Number(movement.sellingPrice ?? 0),
    totalCost: Number(movement.totalCost || (Math.abs(Number(movement.quantity || 0)) * Number(movement.costPrice ?? 0))),
    supplier: movement.supplier?.trim() || '',
    invoiceNumber: movement.invoiceNumber?.trim() || '',
    reason: movement.reason?.trim() || '',
    notes: movement.notes?.trim() || '',
    user: movement.user?.trim() || 'Admin',
    createdAt: movement.createdAt || new Date().toISOString(),
  }

  const movementsCol = collection(db, 'inventory_movements')
  const docRef = await addDoc(movementsCol, payload)
  return docRef.id
}

/**
 * Perform Stock In (Adding incoming stock)
 */
export const executeStockIn = async (backupConfig, { itemId, item, quantity, costPrice, supplier, invoiceNumber, notes, user }) => {
  const db = getBackupFirestore(backupConfig)
  if (!db) throw new Error('Backup database is not configured.')

  const qtyToAdd = Number(quantity)
  if (isNaN(qtyToAdd) || qtyToAdd <= 0) {
    throw new Error('Quantity must be greater than 0.')
  }

  let targetItem = item
  if (!targetItem) {
    const itemSnap = await getDoc(doc(db, 'inventory_items', itemId))
    if (!itemSnap.exists()) throw new Error('Item not found.')
    targetItem = { id: itemSnap.id, ...itemSnap.data() }
  }

  const previousStock = Number(targetItem.currentStock || 0)
  const newStock = previousStock + qtyToAdd
  const unitCost = costPrice !== undefined ? Number(costPrice) : Number(targetItem.costPrice || 0)

  // Update item in inventory_items
  const itemRef = doc(db, 'inventory_items', itemId)
  await updateDoc(itemRef, {
    currentStock: newStock,
    costPrice: unitCost,
    ...(supplier ? { supplier: supplier.trim() } : {}),
    updatedAt: new Date().toISOString(),
  })

  // Record movement in ledger
  await recordStockMovement(backupConfig, {
    itemId,
    itemName: targetItem.name,
    sku: targetItem.sku,
    category: targetItem.category,
    type: MOVEMENT_TYPES.STOCK_IN,
    quantity: qtyToAdd,
    previousStock,
    newStock,
    costPrice: unitCost,
    sellingPrice: Number(targetItem.sellingPrice || 0),
    totalCost: qtyToAdd * unitCost,
    supplier,
    invoiceNumber,
    notes,
    user,
  })

  return { previousStock, newStock }
}

/**
 * Perform Stock Out (Manual reduction / damage / waste / internal use)
 */
export const executeStockOut = async (backupConfig, { itemId, item, quantity, reason, notes, user }) => {
  const db = getBackupFirestore(backupConfig)
  if (!db) throw new Error('Backup database is not configured.')

  const qtyToSubtract = Number(quantity)
  if (isNaN(qtyToSubtract) || qtyToSubtract <= 0) {
    throw new Error('Quantity must be greater than 0.')
  }

  let targetItem = item
  if (!targetItem) {
    const itemSnap = await getDoc(doc(db, 'inventory_items', itemId))
    if (!itemSnap.exists()) throw new Error('Item not found.')
    targetItem = { id: itemSnap.id, ...itemSnap.data() }
  }

  const previousStock = Number(targetItem.currentStock || 0)
  const newStock = Math.max(0, previousStock - qtyToSubtract)

  // Update item in inventory_items
  const itemRef = doc(db, 'inventory_items', itemId)
  await updateDoc(itemRef, {
    currentStock: newStock,
    updatedAt: new Date().toISOString(),
  })

  // Determine movement type
  let movementType = MOVEMENT_TYPES.STOCK_OUT
  if (reason === 'damaged') movementType = MOVEMENT_TYPES.DAMAGE
  else if (reason === 'wasted') movementType = MOVEMENT_TYPES.WASTE
  else if (reason === 'internal_use') movementType = MOVEMENT_TYPES.INTERNAL_USE

  // Record movement in ledger
  await recordStockMovement(backupConfig, {
    itemId,
    itemName: targetItem.name,
    sku: targetItem.sku,
    category: targetItem.category,
    type: movementType,
    quantity: -qtyToSubtract,
    previousStock,
    newStock,
    costPrice: Number(targetItem.costPrice || 0),
    sellingPrice: Number(targetItem.sellingPrice || 0),
    reason,
    notes,
    user,
  })

  return { previousStock, newStock }
}

/**
 * Perform Stock Adjustment (Audit physical count correction)
 */
export const executeStockAdjustment = async (backupConfig, { itemId, item, actualCount, notes, user }) => {
  const db = getBackupFirestore(backupConfig)
  if (!db) throw new Error('Backup database is not configured.')

  const newStock = Number(actualCount)
  if (isNaN(newStock) || newStock < 0) {
    throw new Error('Actual count must be 0 or greater.')
  }

  let targetItem = item
  if (!targetItem) {
    const itemSnap = await getDoc(doc(db, 'inventory_items', itemId))
    if (!itemSnap.exists()) throw new Error('Item not found.')
    targetItem = { id: itemSnap.id, ...itemSnap.data() }
  }

  const previousStock = Number(targetItem.currentStock || 0)
  const delta = newStock - previousStock

  // Update item
  const itemRef = doc(db, 'inventory_items', itemId)
  await updateDoc(itemRef, {
    currentStock: newStock,
    updatedAt: new Date().toISOString(),
  })

  // Record movement
  await recordStockMovement(backupConfig, {
    itemId,
    itemName: targetItem.name,
    sku: targetItem.sku,
    category: targetItem.category,
    type: MOVEMENT_TYPES.ADJUSTMENT,
    quantity: delta,
    previousStock,
    newStock,
    costPrice: Number(targetItem.costPrice || 0),
    sellingPrice: Number(targetItem.sellingPrice || 0),
    reason: `Physical count adjustment (${delta >= 0 ? `+${delta}` : delta})`,
    notes,
    user,
  })

  return { previousStock, newStock, delta }
}

/**
 * Fetch stock movements with optional limits / filters
 */
export const getInventoryMovements = async (backupConfig, maxRecords = 100) => {
  const db = getBackupFirestore(backupConfig)
  if (!db) return []

  try {
    const movementsRef = collection(db, 'inventory_movements')
    const q = query(movementsRef, orderBy('createdAt', 'desc'), limit(maxRecords))
    const snapshot = await getDocs(q)
    const movements = []
    snapshot.forEach((docSnap) => {
      movements.push({
        id: docSnap.id,
        ...docSnap.data(),
      })
    })
    return movements
  } catch (error) {
    console.error('Error fetching inventory movements:', error)
    // Fallback if index on createdAt is missing or pending
    try {
      const movementsRef = collection(db, 'inventory_movements')
      const snapshot = await getDocs(movementsRef)
      const movements = []
      snapshot.forEach((docSnap) => {
        movements.push({
          id: docSnap.id,
          ...docSnap.data(),
        })
      })
      return movements.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)).slice(0, maxRecords)
    } catch (fallbackErr) {
      console.error('Fallback error fetching movements:', fallbackErr)
      return []
    }
  }
}

/**
 * Helper to fetch POS orders from backup database to calculate today's bar sales
 */
export const getTodayPosOrders = async (backupConfig) => {
  const db = getBackupFirestore(backupConfig)
  if (!db) return []

  try {
    const ordersRef = collection(db, 'orders')
    const snapshot = await getDocs(ordersRef)
    const orders = []
    const todayStr = new Date().toISOString().split('T')[0]

    snapshot.forEach((docSnap) => {
      const data = docSnap.data()
      if (data.createdAt && String(data.createdAt).startsWith(todayStr)) {
        orders.push({
          id: docSnap.id,
          ...data,
        })
      }
    })
    return orders
  } catch (err) {
    console.error('Error fetching POS orders for inventory sync:', err)
    return []
  }
}
