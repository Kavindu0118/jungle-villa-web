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
        subcategories: [
          {
            id: 'coffee-hot',
            title: 'Hot Drinks',
            items: [
              item('coffee-1', 'Espresso', 'Single shot, rich and bold', '$3.50'),
              item('coffee-2', 'Cappuccino', 'Foamed milk with cocoa finish', '$5.00'),
            ],
          },
          {
            id: 'coffee-cold',
            title: 'Iced Coffee',
            items: [
              item('coffee-3', 'Iced Latte', 'Espresso over ice with chilled milk', '$5.50'),
              item('coffee-4', 'Cold Brew', 'Steeped 18 hours, served over ice', '$4.50'),
            ],
          },
        ],
      },
      {
        id: 'bakes',
        title: 'Bakery',
        subcategories: [
          {
            id: 'bakes-pastries',
            title: 'Pastries',
            items: [
              item('bakes-1', 'Butter Croissant', 'Flaky, buttery French pastry', '$4.50'),
              item('bakes-3', 'Chocolate Croissant', 'Filled with dark Belgian chocolate', '$5.00'),
            ],
          },
          {
            id: 'bakes-loaves',
            title: 'Loaves & Cakes',
            items: [
              item('bakes-2', 'Banana Bread', 'Toasted, served with sea salt butter', '$4.00'),
            ],
          },
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
        subcategories: [
          {
            id: 'starters-soups',
            title: 'Soups',
            items: [
              item('starters-1', 'Smoked Tomato Soup', 'Herb oil and garlic crumb', '$8.00'),
            ],
          },
          {
            id: 'starters-apps',
            title: 'Salads & Appetizers',
            items: [
              item('starters-2', 'Crispy Calamari', 'Lemon aioli and parsley', '$12.00'),
              item('starters-3', 'Caesar Salad', 'Romaine, parmesan, croutons, creamy dressing', '$10.00'),
            ],
          },
        ],
      },
      {
        id: 'mains',
        title: 'Mains',
        subcategories: [
          {
            id: 'mains-seafood',
            title: 'Seafood & Grill',
            items: [
              item('mains-1', 'Seared Salmon', 'Quinoa, charred greens, citrus butter', '$22.00'),
            ],
          },
          {
            id: 'mains-pasta',
            title: 'Pasta & Grains',
            items: [
              item('mains-2', 'Truffle Mushroom Risotto', 'Parmesan and cracked pepper', '$19.00'),
            ],
          },
        ],
      },
      {
        id: 'desserts',
        title: 'Desserts',
        subcategories: [
          {
            id: 'desserts-sweet',
            title: 'Sweet Endings',
            items: [
              item('desserts-1', 'Dark Chocolate Tart', 'Vanilla creme and berries', '$9.00'),
              item('desserts-2', 'Warm Apple Galette', 'Caramel drizzle, vanilla bean ice cream', '$10.50'),
            ],
          },
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
        subcategories: [
          {
            id: 'snacks-fries',
            title: 'Fries & Bites',
            items: [
              item('snacks-1', 'Loaded Fries', 'Cheddar sauce and chive', '$7.00'),
              item('snacks-3', 'Onion Rings', 'Crispy beer-battered rings', '$6.00'),
            ],
          },
          {
            id: 'snacks-sliders',
            title: 'Sliders',
            items: [
              item('snacks-2', 'Chicken Sliders', 'Two mini brioche sliders', '$9.50'),
            ],
          },
        ],
      },
      {
        id: 'bowls',
        title: 'Power Bowls',
        subcategories: [
          {
            id: 'bowls-rice',
            title: 'Warm Bowls',
            items: [
              item('bowls-1', 'Teriyaki Tofu Bowl', 'Brown rice, bok choy, sesame', '$11.00'),
              item('bowls-2', 'Chicken Grain Bowl', 'Avocado, greens, spicy mayo', '$12.50'),
            ],
          },
        ],
      },
      {
        id: 'drinks',
        title: 'Drinks',
        subcategories: [
          {
            id: 'drinks-cold',
            title: 'Infusions & Sodas',
            items: [
              item('drinks-1', 'Sparkling Lime', 'Fresh citrus and mint', '$3.50'),
            ],
          },
          {
            id: 'drinks-brew',
            title: 'Cold Coffee',
            items: [
              item('drinks-2', 'Cold Brew', 'Single-origin beans', '$4.25'),
            ],
          },
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