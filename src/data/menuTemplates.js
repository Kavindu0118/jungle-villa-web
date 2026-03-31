const createTemplate = ({
  id,
  label,
  description,
  restaurantName,
  menuTitle,
  sections,
}) => ({
  id,
  label,
  description,
  restaurantName,
  menuTitle,
  sections,
})

const item = (id, name, description, price) => ({
  id,
  name,
  description,
  price,
})

export const menuTemplates = [
  createTemplate({
    id: 'minimal-cafe',
    label: 'Minimal Cafe',
    description: 'Compact menu with beverage-first sections and simple pricing.',
    restaurantName: 'Northline Cafe',
    menuTitle: 'All Day Menu',
    sections: [
      {
        id: 'coffee',
        title: 'Coffee',
        items: [
          item('coffee-1', 'Espresso', 'Single shot, rich and bold', '$3.50'),
          item('coffee-2', 'Cappuccino', 'Foamed milk with cocoa finish', '$5.00'),
        ],
      },
      {
        id: 'bakes',
        title: 'Bakery',
        items: [
          item('bakes-1', 'Butter Croissant', 'Baked fresh each morning', '$4.50'),
          item('bakes-2', 'Banana Bread', 'Toasted with sea salt butter', '$4.00'),
        ],
      },
    ],
  }),
  createTemplate({
    id: 'chef-signature',
    label: 'Chef Signature',
    description: 'Three-part structure for starters, mains, and desserts.',
    restaurantName: 'Maison 87',
    menuTitle: 'Chef Tasting',
    sections: [
      {
        id: 'starters',
        title: 'Starters',
        items: [
          item('starters-1', 'Smoked Tomato Soup', 'Herb oil and garlic crumb', '$8.00'),
          item('starters-2', 'Crispy Calamari', 'Lemon aioli and parsley', '$12.00'),
        ],
      },
      {
        id: 'mains',
        title: 'Mains',
        items: [
          item('mains-1', 'Seared Salmon', 'Quinoa, charred greens, citrus butter', '$22.00'),
          item('mains-2', 'Truffle Mushroom Risotto', 'Parmesan and cracked pepper', '$19.00'),
        ],
      },
      {
        id: 'desserts',
        title: 'Desserts',
        items: [
          item('desserts-1', 'Dark Chocolate Tart', 'Vanilla creme and berries', '$9.00'),
        ],
      },
    ],
  }),
  createTemplate({
    id: 'quick-bites',
    label: 'Quick Bites',
    description: 'Fast layout for snacks, bowls, and drinks with concise text.',
    restaurantName: 'Urban Fork',
    menuTitle: 'Lunch Express',
    sections: [
      {
        id: 'snacks',
        title: 'Snacks',
        items: [
          item('snacks-1', 'Loaded Fries', 'Cheddar sauce and chive', '$7.00'),
          item('snacks-2', 'Chicken Sliders', 'Two mini brioche sliders', '$9.50'),
        ],
      },
      {
        id: 'bowls',
        title: 'Power Bowls',
        items: [
          item('bowls-1', 'Teriyaki Tofu Bowl', 'Brown rice, bok choy, sesame', '$11.00'),
          item('bowls-2', 'Chicken Grain Bowl', 'Avocado, greens, spicy mayo', '$12.50'),
        ],
      },
      {
        id: 'drinks',
        title: 'Drinks',
        items: [
          item('drinks-1', 'Sparkling Lime', 'Fresh citrus and mint', '$3.50'),
          item('drinks-2', 'Cold Brew', 'Single-origin beans', '$4.25'),
        ],
      },
    ],
  }),
]

export const findTemplateById = (templateId) =>
  menuTemplates.find((template) => template.id === templateId)

export const cloneTemplate = (template) => {
  if (typeof structuredClone === 'function') {
    return structuredClone(template)
  }

  return JSON.parse(JSON.stringify(template))
}