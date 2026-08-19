import type {
  AxiosInstance,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from "axios";
import axios from "axios";
import { authService } from "./auth.service";

const API_BASE_URL =
  import.meta.env.VITE_API_URL || "https://api.capucho.inv/api";

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: 30000,
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    this.client.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        const accessToken = localStorage.getItem("access_token");

        if (accessToken) {
          config.headers.Authorization = `Bearer ${accessToken}`;
        }

        if (!(config.data instanceof FormData)) {
          config.headers["Content-Type"] = "application/json";
        }

        return config;
      },
      (error) => Promise.reject(error),
    );

    this.client.interceptors.response.use(
      (response: AxiosResponse) => response,
      (error) => {
        if (error.response?.status === 401) {
          // Logout logic
          authService.logout().catch(console.error);
          localStorage.removeItem("access_token");
          // Clear auth store if needed (handled by localStorage removal usually if persisted)
          localStorage.removeItem("auth"); // Pinia store persistence key

          // Redirect to login if possible. In F7 we might need f7.views.main.router
          window.location.href = "/auth/login";
        }
        return Promise.reject(error);
      },
    );
  }

  get axios() {
    return this.client;
  }
}

export const apiClient = new ApiClient().axios;
