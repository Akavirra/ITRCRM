import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { run, get, all } from '@/db';

const JWT_SECRET = process.env.JWT_SECRET || 'school-admin-secret-key-change-in-production';
const SESSION_EXPIRY_HOURS = 24;

export interface User {
  id: number;
  name: string;
  email: string;
  role: 'admin';
  phone?: string | null;
  telegram_id?: string | null;
  photo_url?: string | null;
  notes?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Session {
  id: string;
  user_id: number;
  expires_at: string;
  created_at: string;
}

// Hash password
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

// Verify password
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// Create session
export async function createSession(userId: number): Promise<string> {
  const sessionId = uuidv4();
  const expiresAt = new Date(Date.now() + SESSION_EXPIRY_HOURS * 60 * 60 * 1000);
  
  await run(
    `INSERT INTO sessions (id, user_id, expires_at) VALUES ($1, $2, $3)`,
    [sessionId, userId, expiresAt.toISOString()]
  );
  
  return sessionId;
}

// Get session
export async function getSession(sessionId: string): Promise<Session | null> {
  const session = await get<Session>(
    `SELECT * FROM sessions WHERE id = $1 AND expires_at > NOW()`,
    [sessionId]
  );
  
  return session || null;
}

// Delete session
export async function deleteSession(sessionId: string): Promise<void> {
  await run(`DELETE FROM sessions WHERE id = $1`, [sessionId]);
}

// Clean expired sessions
export async function cleanExpiredSessions(): Promise<void> {
  await run(`DELETE FROM sessions WHERE expires_at < NOW()`);
}

// Get user by email
export async function getUserByEmail(email: string): Promise<User | null> {
  const user = await get<User>(
    `SELECT * FROM users WHERE email = $1`,
    [email]
  );
  
  return user || null;
}

// Get user by ID
export async function getUserById(id: number): Promise<User | null> {
  const user = await get<User>(
    `SELECT * FROM users WHERE id = $1`,
    [id]
  );
  
  return user || null;
}

// Login - Only admin role is allowed to login
export async function login(email: string, password: string): Promise<{ user: User; sessionId: string } | null> {
  const user = await getUserByEmail(email);
  
  if (!user || !user.is_active) {
    return null;
  }
  
  // Only allow admin role to login
  if (user.role !== 'admin') {
    throw new Error('Доступ заборонено. Тільки адміністратори можуть увійти.');
  }
  
  const userWithPassword = await get<{ password_hash: string }>(
    `SELECT password_hash FROM users WHERE id = $1`,
    [user.id]
  );
  
  if (!userWithPassword) {
    return null;
  }
  
  const isValid = await verifyPassword(password, userWithPassword.password_hash);
  
  if (!isValid) {
    return null;
  }
  
  const sessionId = await createSession(user.id);
  
  return { user, sessionId };
}

// Logout
export async function logout(sessionId: string): Promise<void> {
  await deleteSession(sessionId);
}

// Create JWT token (alternative to session-based auth)
export function createToken(userId: number, role: string): string {
  return jwt.sign(
    { userId, role },
    JWT_SECRET,
    { expiresIn: `${SESSION_EXPIRY_HOURS}h` }
  );
}

// Verify JWT token
export function verifyToken(token: string): { userId: number; role: string } | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: number; role: string };
    return decoded;
  } catch {
    return null;
  }
}

// Check if user has access to group (for teachers)
export async function userHasGroupAccess(userId: number, groupId: number, userRole: string): Promise<boolean> {
  if (userRole === 'admin') {
    return true;
  }
  
  const group = await get<{ teacher_id: number }>(
    `SELECT teacher_id FROM groups WHERE id = $1`,
    [groupId]
  );
  
  return group?.teacher_id === userId;
}

// Get groups accessible by user
export async function getAccessibleGroups(userId: number, userRole: string): Promise<number[]> {
  if (userRole === 'admin') {
    const groups = await all<{ id: number }>(`SELECT id FROM groups WHERE is_active = TRUE`);
    return groups.map(g => g.id);
  }
  
  const groups = await all<{ id: number }>(
    `SELECT id FROM groups WHERE teacher_id = $1 AND is_active = TRUE`,
    [userId]
  );
  
  return groups.map(g => g.id);
}
