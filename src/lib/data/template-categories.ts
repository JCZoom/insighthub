// Predefined template categories for better organization and discovery

export interface TemplateCategory {
  id: string;
  name: string;
  description: string;
  color: string;
  icon: string;
  suggestedTags: string[];
}

export const TEMPLATE_CATEGORIES: Record<string, TemplateCategory> = {
  'executive': {
    id: 'executive',
    name: 'Executive & KPIs',
    description: 'High-level business metrics and key performance indicators',
    color: 'purple',
    icon: 'Crown',
    suggestedTags: ['executive', 'kpi', 'revenue', 'performance', 'metrics', 'overview'],
  },
  'sales': {
    id: 'sales',
    name: 'Sales & Revenue',
    description: 'Sales pipeline, revenue tracking, and deal analysis',
    color: 'blue',
    icon: 'TrendingUp',
    suggestedTags: ['sales', 'pipeline', 'deals', 'revenue', 'forecasting', 'conversion'],
  },
  'support': {
    id: 'support',
    name: 'Support & Operations',
    description: 'Customer support metrics, ticket analysis, and operational performance',
    color: 'green',
    icon: 'Headphones',
    suggestedTags: ['support', 'tickets', 'csat', 'performance', 'resolution', 'customer'],
  },
  'product': {
    id: 'product',
    name: 'Product & Usage',
    description: 'Product analytics, user engagement, and feature adoption',
    color: 'orange',
    icon: 'Smartphone',
    suggestedTags: ['product', 'usage', 'engagement', 'features', 'adoption', 'analytics'],
  },
  'marketing': {
    id: 'marketing',
    name: 'Marketing & Growth',
    description: 'Marketing campaigns, lead generation, and growth metrics',
    color: 'pink',
    icon: 'Megaphone',
    suggestedTags: ['marketing', 'campaigns', 'leads', 'growth', 'acquisition', 'conversion'],
  },
  'operations': {
    id: 'operations',
    name: 'Business Operations',
    description: 'Operational efficiency, cost analysis, and process metrics',
    color: 'gray',
    icon: 'Settings',
    suggestedTags: ['operations', 'efficiency', 'costs', 'processes', 'workflow', 'automation'],
  },
  'finance': {
    id: 'finance',
    name: 'Finance & Accounting',
    description: 'Financial performance, budgeting, and accounting metrics',
    color: 'emerald',
    icon: 'DollarSign',
    suggestedTags: ['finance', 'accounting', 'budget', 'costs', 'profit', 'financial'],
  },
  'hr': {
    id: 'hr',
    name: 'Human Resources',
    description: 'Employee metrics, hiring, and HR analytics',
    color: 'indigo',
    icon: 'Users',
    suggestedTags: ['hr', 'employees', 'hiring', 'performance', 'retention', 'workforce'],
  },
  'customer': {
    id: 'customer',
    name: 'Customer Analytics',
    description: 'Customer behavior, retention, churn, and satisfaction analysis',
    color: 'red',
    icon: 'Heart',
    suggestedTags: ['customer', 'retention', 'churn', 'satisfaction', 'loyalty', 'analysis'],
  },
  'custom': {
    id: 'custom',
    name: 'Industry Specific',
    description: 'Templates tailored for specific industries or use cases',
    color: 'amber',
    icon: 'Briefcase',
    suggestedTags: ['industry', 'specialized', 'custom', 'specific', 'tailored'],
  },
};

// Helper functions for working with template categories
export function getCategoryForTags(tags: string[]): TemplateCategory | null {
  for (const [categoryId, category] of Object.entries(TEMPLATE_CATEGORIES)) {
    const hasMatchingTag = tags.some(tag =>
      category.suggestedTags.some(suggestedTag =>
        tag.toLowerCase().includes(suggestedTag.toLowerCase()) ||
        suggestedTag.toLowerCase().includes(tag.toLowerCase())
      )
    );
    if (hasMatchingTag) {
      return category;
    }
  }
  return null;
}

export function getCategoryById(id: string): TemplateCategory | null {
  return TEMPLATE_CATEGORIES[id] || null;
}

export function getAllCategories(): TemplateCategory[] {
  return Object.values(TEMPLATE_CATEGORIES);
}

export function getTagsForCategory(categoryId: string): string[] {
  const category = TEMPLATE_CATEGORIES[categoryId];
  return category ? category.suggestedTags : [];
}

// Color mappings for UI
export const CATEGORY_COLORS = {
  purple: 'bg-purple-100 text-purple-700 border-purple-200',
  blue: 'bg-blue-100 text-blue-700 border-blue-200',
  green: 'bg-green-100 text-green-700 border-green-200',
  orange: 'bg-orange-100 text-orange-700 border-orange-200',
  pink: 'bg-pink-100 text-pink-700 border-pink-200',
  gray: 'bg-gray-100 text-gray-700 border-gray-200',
  emerald: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  indigo: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  red: 'bg-red-100 text-red-700 border-red-200',
  amber: 'bg-amber-100 text-amber-700 border-amber-200',
} as const;