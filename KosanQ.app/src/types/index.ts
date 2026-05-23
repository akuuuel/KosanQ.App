export type UserRole = 'user' | 'owner' | 'admin';

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: UserRole;
  isVerified?: boolean;
  bio?: string;
  photoURL?: string;
  whatsapp?: string;
  ktpURL?: string;
  points?: number;
  vouchers?: number;
  memberStatus?: 'Bronze' | 'Silver' | 'Gold' | 'Platinum';
}

export type KostStatus = 'pending' | 'approved' | 'rejected';

export interface Kost {
  id: string;
  name: string;
  price: number;
  location: string;
  description: string;
  images: string[];
  ownerId: string;
  status: KostStatus;
  type: 'putra' | 'putri' | 'campur';
  facilities?: string[];
  latitude?: number;
  longitude?: number;
  averageRating?: number;
  totalReviews?: number;
  rejectionReason?: string;
  createdAt: number;
}

export interface Booking {
  id: string;
  kostId: string;
  userId: string;
  userName: string;
  userEmail: string;
  userWhatsapp?: string;
  userBio?: string;
  userPhoto?: string;
  userKtp?: string;
  ownerId: string;
  kostName: string;
  kostImage: string;
  price: number;
  status: 'pending' | 'approved' | 'rejected' | 'completed';
  rejectionReason?: string;
  createdAt: number;
}

export interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  text: string;
  status: 'sent' | 'delivered' | 'read';
  createdAt: number;
}

export interface Conversation {
  id: string;
  participants: string[];
  lastMessage: string;
  lastMessageAt: number;
  otherUserName: string;
  otherUserPhoto?: string;
  otherUserId: string;
  otherUserRole: UserRole;
  unreadCount: number;
  typing?: { [uid: string]: boolean };
  deletedAt?: Record<string, number>;
}

export interface Room {
  id: string;
  kostId: string;
  roomNumber: string;
  price: number;
  status: 'available' | 'occupied';
  description?: string;
  images?: string[];
  facilities?: string[];
}

export interface Tenant {
  id: string;
  userId: string;
  userName: string;
  userPhoto?: string;
  userEmail?: string;
  userWhatsapp?: string;
  userKtpURL?: string;
  roomId: string;
  roomNumber: string;
  roomDescription?: string;
  kostId: string;
  kostName: string;
  startDate: string;
  status: 'active' | 'inactive';
  isActive: boolean;
}

export interface MonthlyStatus {
  jan: boolean;
  feb: boolean;
  mar: boolean;
  apr: boolean;
  may: boolean;
  jun: boolean;
  jul: boolean;
  aug: boolean;
  sep: boolean;
  oct: boolean;
  nov: boolean;
  dec: boolean;
}

export interface PaymentHistory {
  id: string;
  month: string;
  amount: number;
  method: string;
  proofImage: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: number;
}

export interface Payment {
  id: string;
  tenantId: string;
  userId: string;
  kostId: string;
  year: number;
  monthlyStatus: MonthlyStatus;
  proofImages: string[]; // Deprecated but keep for compatibility
  history?: PaymentHistory[];
  updatedAt: string;
}

export interface Broadcast {
  id: string;
  kostId: string;
  title: string;
  message: string;
  createdAt: number;
  expiresAt: number; // For 24h logic
  author: string;
}

export interface Report {
  id: string;
  userId: string;
  userName: string;
  ownerId: string;
  kostId: string;
  roomId: string;
  roomNumber: string;
  message: string;
  status: 'pending' | 'done';
  response?: string;
  responseAt?: number;
  createdAt: number;
}
export interface Review {
  id: string;
  kostId: string;
  userId: string;
  userName: string;
  userPhoto?: string;
  rating: number; // 1-5
  comment: string;
  createdAt: number;
}
