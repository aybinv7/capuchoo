import type { Session, User } from '@supabase/supabase-js'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { authService } from '../services/auth.service'

export const useAuthStore = defineStore(
  'auth',
  () => {
    const user = ref<User | null>(null)
    const session = ref<Session | null>()
    const accessToken = useStorage<string | null>('access_token', null)
    const loading = ref(false)
    const error = ref<string | null>(null)

    // OTP flow state
    const pendingVerificationEmail = ref<string | null>(null)

    const isAuthenticated = computed(() => {
      return !!accessToken.value
    })

    async function login(credentials: { email: string; password: string }) {
      loading.value = true
      error.value = null

      try {
        await authService.login(credentials)

        const { user: supabaseUser } = await authService.checkAuthState()
        user.value = supabaseUser
        const response = await authService.getSession()
        session.value = response.session
        accessToken.value = response.session?.access_token ?? ''
      } catch (err: any) {
        error.value = err.message || 'Login failed'
        throw err
      } finally {
        loading.value = false
      }
    }

    async function register(data: { email: string; password: string; businessName: string }) {
      loading.value = true
      error.value = null

      try {
        const response = await authService.register(data)
        user.value = response.user
        // Store email for OTP verification step
        pendingVerificationEmail.value = data.email
      } catch (err: any) {
        error.value = err.message || 'Registration failed'
        throw err
      } finally {
        loading.value = false
      }
    }

    async function verifyOtp(token: string) {
      if (!pendingVerificationEmail.value) {
        throw new Error('No pending verification email')
      }

      loading.value = true
      error.value = null

      try {
        const { user: verifiedUser, session: newSession } = await authService.verifyOtp(
          pendingVerificationEmail.value,
          token,
          'signup',
        )

        user.value = verifiedUser
        session.value = newSession
        accessToken.value = newSession?.access_token ?? ''
        pendingVerificationEmail.value = null

        return { user: verifiedUser, session: newSession }
      } catch (err: any) {
        error.value = err.message || 'Verification failed'
        throw err
      } finally {
        loading.value = false
      }
    }

    async function resendOtp() {
      if (!pendingVerificationEmail.value) {
        throw new Error('No pending verification email')
      }

      try {
        await authService.resendOtp(pendingVerificationEmail.value)
      } catch (err: any) {
        error.value = err.message || 'Failed to resend code'
        throw err
      }
    }

    async function logout() {
      try {
        await authService.logout()
        user.value = null
        session.value = null
        accessToken.value = null
        pendingVerificationEmail.value = null
      } catch (err: any) {
        error.value = err.message || 'Logout failed'
      }
    }

    async function fetchProfile() {
      try {
        const userProfile = await authService.getProfile()
        user.value = userProfile
      } catch (err: any) {
        error.value = err.message || 'Failed to fetch profile'
      }
    }

    async function init() {
      try {
        const { session: currentSession } = await authService.getSession()

        session.value = currentSession
        user.value = currentSession?.user ?? null

        if (currentSession?.access_token) {
          accessToken.value = currentSession.access_token
        }

        authService.onAuthStateChange((event, newSession) => {
          session.value = newSession
          user.value = newSession?.user ?? null
          accessToken.value = newSession?.access_token ?? null

          if (event === 'SIGNED_OUT') {
            user.value = null
            session.value = null
            accessToken.value = null
            pendingVerificationEmail.value = null
          }
        })
      } catch (err) {
        console.error('Error initializing auth state:', err)
      }
    }

    return {
      user,
      session,
      loading,
      error,
      isAuthenticated,
      pendingVerificationEmail,
      login,
      register,
      verifyOtp,
      resendOtp,
      logout,
      fetchProfile,
      init,
    }
  },
  {
    persist: {
      key: 'auth',
      storage: localStorage,
    },
  },
)
