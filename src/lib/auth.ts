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
  role: 'admin' | 'teacher';
  is_active: number;
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
export function createSession(userId: number): string {
  const sessionId = uuidv4();
  const expiresAt = new Date(Date.now() + SESSION_EXPIRY_HOURS * 60 * 60 * 1000);
  
  run(
    `INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)`,
    [sessionId, userId, expiresAt.toISOString()]
  );
  
  return sessionId;
}

// Get session
export function getSession(sessionId: string): Session | null {
  const session = get<Session>(
    `SELECT * FROM sessions WHERE id = ? AND expires_at > datetime('now')`,
    [sessionId]
  );
  
  return session || null;
}

// Delete session
export function deleteSession(sessionId: string): void {
  run(`DELETE FROM sessions WHERE id = ?`, [sessionId]);
}

// Clean expired sessions
export function cleanExpiredSessions(): void {
  run(`DELETE FROM sessions WHERE expires_at < datetime('now')`);
}

// Get user by email
export function getUserByEmail(email: string): User | null {
  const user = get<User>(
    `SELECT * FROM users WHERE email = ?`,
    [email]
  );
  
  return user || null;
}

// Get user by ID
export function getUserById(id: number): User | null {
  const user = get<User>(
    `SELECT * FROM users WHERE id = ?`,
    [id]
  );
  
  return user || null;
}

// Login
export async function login(email: string, password: string): Promise<{ user: User; sessionId: string } | null> {
  const user = getUserByEmail(email);
  
  if (!user || !user.is_active) {
    return null;
  }
  
  const userWithPassword = get<{ password_hash: string }>(
    `SELECT password_hash FROM users WHERE id = ?`,
    [user.id]
  );
  
  if (!userWithPassword) {
    return null;
  }
  
  const isValid = await verifyPassword(password, userWithPassword.password_hash);
  
  if (!isValid) {
    return null;
  }
  
  const sessionId = createSession(user.id);
  
  return { user, sessionId };
}

// Logout
export function logout(sessionId: string): void {
  deleteSession(sessionId);
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
export function userHasGroupAccess(userId: number, groupId: number, userRole: string): boolean {
  if (userRole === 'admin') {
    return true;
  }
  
  const group = get<{ teacher_id: number }>(
    `SELECT teacher_id FROM groups WHERE id = ?`,
    [groupId]
  );
  
  return group?.teacher_id === userId;
}

// Get groups accessible by user
export function getAccessibleGroups(userId: number, userRole: string): number[] {
  if (userRole === 'admin') {
    const groups = all<{ id: number }>(`SELECT id FROM groups WHERE is_active = 1`);
    return groups.map(g => g.id);
  }
  
  const groups = all<{ id: number }>(
    `SELECT id FROM groups WHERE teacher_id = ? AND is_active = 1`,
    [userId]
  );
  
  return groups.map(g => g.id);
}