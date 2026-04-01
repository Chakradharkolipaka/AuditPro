import axios from "axios";

const API_BASE =
  process.env.REACT_APP_BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:5000";

export const apiClient = axios.create({
  baseURL: `${API_BASE}/api`,
  timeout: 30_000,
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const code = error?.response?.data?.code || "REQUEST_FAILED";
    const message = error?.response?.data?.message || error?.message || "Request failed";
    return Promise.reject({
      ...error,
      code,
      userMessage: message,
    });
  }
);
