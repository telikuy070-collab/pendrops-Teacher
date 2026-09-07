/**
 * Authentication module for PenDrops Мугалим.
 *
 * Wraps Supabase Auth with a type-safe interface and state management.
 * Provides reactive auth state via an event emitter pattern, so components
 * can subscribe to login/logout events without tight coupling.
 */
import { supabase } from '../lib/supabaseClient.ts';
import { authRepository } from '../models/index.ts';
import { TeacherSchema } from '../types/schemas.ts';
import type { Teacher } from '../types/schemas.ts';

// ---------------------------------------------------------------------------
// Auth State Management
// ---------------------------------------------------------------------------

type AuthState = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthEventMap {
  state: AuthState;
  user: Teacher | null;
  session: any;
}

type AuthListener = (state: AuthEventMap) => void;

class AuthManager {
  private listeners: Set<AuthListener> = new Set();
  private _state: AuthState = 'loading';
  private _user: Teacher | null = null;

  get state() {
    return this._state;
  }

  get user() {
    return this._user;
  }

  subscribe(listener: AuthListener) {
    this.listeners.add(listener);
    // Immediately emit current state
    listener({
      state: this._state,
      user: this._user,
      session: null,
    });
    return () => this.listeners.delete(listener);
  }

  private emit(state: AuthState, user: Teacher | null = null, session: any = null) {
    this._state = state;
    this._user = user;
    const event: AuthEventMap = { state, user, session };
    this.listeners.forEach((l) => l(event));
  }

  // -----------------------------------------------------------------------
  // Initialization
  // -----------------------------------------------------------------------

  async init(): Promise<AuthState> {
    try {
      const user = await authRepository.getCurrentUser();
      if (user) {
        // Fetch teacher profile from DB
        const { data: teacherData, error } = await supabase
          .from('teacher_teachers')
          .select('*')
          .eq('id', user.id)
          .single();

        if (teacherData && !error) {
          const teacher = TeacherSchema.parse(teacherData);
          this.emit('authenticated', teacher);
        } else {
          this.emit('authenticated', null);
        }
      } else {
        this.emit('unauthenticated');
      }
    } catch (error) {
      console.error('[Auth] Failed to initialize:', error);
      this.emit('unauthenticated');
    }
    return this._state;
  }

  // -----------------------------------------------------------------------
  // Actions
  // -----------------------------------------------------------------------

  async signIn(email: string, password: string): Promise<Teacher> {
    try {
      const session = await authRepository.signIn(email, password);

      // Fetch the teacher profile
      const { data: teacherData, error } = await supabase
        .from('teacher_teachers')
        .select('*')
        .eq('id', session.user?.id)
        .single();

      if (error || !teacherData) {
        throw new Error('Teacher profile not found');
      }

      const teacher = TeacherSchema.parse(teacherData);
      this.emit('authenticated', teacher, session);
      return teacher;
    } catch (error: any) {
      console.error('[Auth] Sign in failed:', error);

      // Normalize error message for UI
      if (
        error?.message?.includes('Invalid login credentials') ||
        error?.code === 'invalid_credentials'
      ) {
        throw new Error('Неверный email или пароль');
      }

      throw error;
    }
  }

  async signOut(): Promise<void> {
    await authRepository.signOut();
    this.emit('unauthenticated');
  }

  // -----------------------------------------------------------------------
  // Auth state listener (for token refresh etc.)
  // -----------------------------------------------------------------------

  startListening() {
    authRepository.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        this.emit('unauthenticated');
        return;
      }

      if (event === 'SIGNED_IN' && session?.user) {
        this.init();
      }
    });
  }
}

export const auth = new AuthManager();

// ---------------------------------------------------------------------------
// React hook-style subscriptions
// ---------------------------------------------------------------------------

export function useAuth() {
  let current: AuthEventMap = {
    state: auth.state,
    user: auth.user,
    session: null,
  };

  const subscribe = (callback: (state: AuthEventMap) => void) => {
    const unsubscribe = auth.subscribe((event) => {
      current = event;
      callback(event);
    });
    return unsubscribe;
  };

  const getSnapshot = () => current;

  return { subscribe, getSnapshot };
}
