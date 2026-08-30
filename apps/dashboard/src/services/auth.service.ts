import { createClient, type Session, type User } from "@supabase/supabase-js";

// Initialize Supabase client.
//
// The publishable key (sb_publishable_...) replaces the anon JWT, which Supabase
// documents as deprecated with removal announced for the end of 2026. Both are
// low-privilege and subject to row level security, so this is a rename rather
// than a change in what the browser is trusted with.
//
// No VITE_SUPABASE_ANON_KEY fallback: this app is deployed from this workspace
// only, and its environment sets the publishable key. A fallback would just let
// a half-configured environment build quietly against the deprecated key.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "";
const supabase = createClient(supabaseUrl, supabasePublishableKey);

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  fullName: string;
}

export interface OtpVerifyData {
  email: string;
  token: string;
  type: "signup" | "email";
}

export const authService = {
  async login(credentials: LoginCredentials): Promise<{ user: User | null; session: Session }> {
    const { data, error } = await supabase.auth.signInWithPassword(credentials);

    if (error) {
      throw new Error(error.message);
    }

    return { user: data.user, session: data.session };
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
          full_name: data.fullName,
        },
        // Don't auto-confirm, require email verification
        emailRedirectTo: undefined,
      },
    });

    if (error) {
      throw new Error(error.message);
    }

    return { user: signUpData.user };
  },

  /**
   * Verify OTP code sent to email
   * Used for signup verification and email change verification
   */
  async verifyOtp(
    email: string,
    token: string,
    type: "signup" | "email" = "signup",
  ): Promise<{ user: User | null; session: Session | null }> {
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token,
      type,
    });

    if (error) {
      throw new Error(error.message);
    }

    return { user: data.user, session: data.session };
  },

  /**
   * Resend OTP code to email
   */
  async resendOtp(email: string): Promise<void> {
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
    });

    if (error) {
      throw new Error(error.message);
    }
  },

  async logout(): Promise<void> {
    const { error } = await supabase.auth.signOut();
    if (error) {
      throw new Error(error.message);
    }
  },

  async getProfile(): Promise<User | null> {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user;
  },

  async checkAuthState(): Promise<{ user: User | null }> {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    return { user: user };
  },

  async getSession() {
    const { data, error } = await supabase.auth.getSession();

    if (error) {
      throw Error(error.message);
    }

    return data;
  },

  /**
   * Changes the signed-in user's password.
   *
   * Added because the settings panel claimed to do this and did not: it
   * compared the two fields, cleared the form and showed "Password updated"
   * while calling nothing. Someone rotating a password they believed was
   * exposed would have kept using the old one, told it had been replaced.
   *
   * Supabase re-checks the session server-side, so an expired session fails
   * here rather than appearing to succeed.
   */
  async updatePassword(newPassword: string): Promise<void> {
    const { error } = await supabase.auth.updateUser({ password: newPassword });

    if (error) {
      throw new Error(error.message);
    }
  },

  /** Updates the display name held in the user's metadata. */
  async updateProfile(fullName: string): Promise<User | null> {
    const { data, error } = await supabase.auth.updateUser({
      data: { full_name: fullName },
    });

    if (error) {
      throw new Error(error.message);
    }

    return data.user;
  },

  onAuthStateChange(callback: (event: any, session: any) => void) {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(callback);
    return subscription;
  },

  isAuthenticated(): boolean {
    return !!supabase.auth.getUser();
  },
};
