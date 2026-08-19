import { createClient, type Session, type User } from '@supabase/supabase-js'

// Initialize Supabase client
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseAnonKey)

export interface LoginCredentials {
  email: string
  password: string
}

export interface RegisterData {
  email: string
  password: string
  businessName: string
}

export interface OtpVerifyData {
  email: string
  token: string
  type: 'signup' | 'email'
}

export const authService = {
  async login(credentials: LoginCredentials): Promise<{ user: User | null; session: Session }> {
    const { data, error } = await supabase.auth.signInWithPassword(credentials)

    if (error) {
      throw new Error(error.message)
    }

    return { user: data.user, session: data.session }
  },

  /**
   * Register a new user with email/password
   * Supabase will send an OTP code to the email for verification
   */
  async register(data: RegisterData): Promise<{ user: User | null }> {
    const { data: signUpData, error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: {
          full_name: data.businessName,
        },
        // Don't auto-confirm, require email verification
        emailRedirectTo: undefined,
      },
    })

    if (error) {
      throw new Error(error.message)
    }

    return { user: signUpData.user }
  },

  /**
   * Verify OTP code sent to email
   * Used for signup verification and email change verification
   */
  async verifyOtp(
    email: string,
    token: string,
    type: 'signup' | 'email' = 'signup',
  ): Promise<{ user: User | null; session: Session | null }> {
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token,
      type,
    })

    if (error) {
      throw new Error(error.message)
    }

    return { user: data.user, session: data.session }
  },

  /**
   * Resend OTP code to email
   */
  async resendOtp(email: string): Promise<void> {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
    })

    if (error) {
      throw new Error(error.message)
    }
  },

  async logout(): Promise<void> {
    const { error } = await supabase.auth.signOut()
    if (error) {
      throw new Error(error.message)
    }
  },

  async getProfile(): Promise<User | null> {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    return user
  },

  async checkAuthState(): Promise<{ user: User | null }> {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    return { user: user }
  },

  async getSession() {
    const { data, error } = await supabase.auth.getSession()

    if (error) {
      throw Error(error.message)
    }

    return data
  },

  onAuthStateChange(callback: (event: any, session: any) => void) {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(callback)
    return subscription
  },

  isAuthenticated(): boolean {
    return !!supabase.auth.getUser()
  },
}
