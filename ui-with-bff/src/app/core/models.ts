export interface NewProduct {
  name: string;
  description: string;
  price: number;
  category: string;
  imgUrl: string;
}

export interface Product extends NewProduct {
  id: number;
}

export interface CartItem {
  productId: number;
  quantity: number;
  name: string;
  category: string;
  price: number;
  total: number;
}

export interface AddToCart {
  productId: number;
  quantity: number;
}

export interface NewOrder {
  email: string;
}

export interface OrderDetail {
  productId: number;
  productName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface Order {
  id: number;
  email: string;
  orderDate: string;
  total: number;
  details: OrderDetail[];
}

export const CATEGORIES = [
  { value: 'kayak', label: 'Kayaks' },
  { value: 'equip', label: 'Equipment' },
  { value: 'boots', label: 'Footwear' },
];
