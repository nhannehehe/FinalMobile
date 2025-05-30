import { API_BASE_URL } from "../config";
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';


export const login = async (email, password) => {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "Login failed");
  return data;
};

export const register = async (userData) => {
  const response = await fetch(`${API_BASE_URL}/auth/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(userData),
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "Register failed");
  return data;
};

export const forgotPassword = async (email) => {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Failed to send reset link");
    }

    return data; // { message: "..."} nếu thành công
  } catch (error) {
    console.error("Forgot password error:", error);
    throw error;
  }
};

export const resetPassword = async (code, password) => {
  try {
    const body = JSON.stringify({ code, password });
    console.log("Reset password request body:", body); // Log để kiểm tra body
    const response = await fetch(`${API_BASE_URL}/auth/reset-password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: body,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Invalid or expired reset code");
    }

    return data; // { message: "Password reset successfully" }
  } catch (error) {
    console.error("Reset password error:", error);
    throw error;
  }
};

export const requestPasswordReset = async (email) => {
  try {
    const body = JSON.stringify({ email });
    console.log("Request password reset body:", body); // Log để kiểm tra body
    const response = await axios.post(`${API_BASE_URL}/auth/forgot-password`, { email });
    return response.data;
  } catch (error) {
    console.log('Lỗi gửi yêu cầu reset:', error.response?.data || error.message);
    throw error.response?.data?.message || 'Gửi yêu cầu đặt mật khẩu thất bại';
  }
};

export const refreshToken = async () => {
  try {
    const refreshToken = await AsyncStorage.getItem('refreshToken');
    if (!refreshToken) {
      console.log('No refresh token available');
      return null;
    }

    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) {
      console.log('Failed to refresh token');
      return null;
    }

    const data = await response.json();
    if (data && data.accessToken) {
      // Lưu token mới
      await AsyncStorage.setItem('accessToken', data.accessToken);
      if (data.refreshToken) {
        await AsyncStorage.setItem('refreshToken', data.refreshToken);
      }
      return data.accessToken;
    }
    return null;
  } catch (error) {
    console.error('Error refreshing token:', error);
    return null;
  }
};

export const getAccessToken = async (forceRefresh = false) => {
  let accessToken = await AsyncStorage.getItem('accessToken');
  if (!accessToken || forceRefresh) {
    accessToken = await refreshToken();
  }
  return accessToken;
};
// authApi.js
// authApi.js
export const sendVerificationEmail = async (email) => {
  return fetch(`${API_BASE_URL}/auth/verify-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(email), // Chỉ gửi chuỗi email thay vì object
  }).then((res) => {
    if (!res.ok) throw new Error("Không thể gửi mã xác nhận");
    return res;
  });
};

// authApi.js
export const verifyEmailCode = async (data) => {
  const payload = {
    email: data.email,
    code: data.code,
    userRegisterRequest: {
      username: data.username,
      password: data.password,
      email: data.email,
      phone: data.phone,
      firstName: data.firstName,
      lastName: data.lastName,
      birthday: data.birthday,
      gender: data.gender,
      status: data.status,
    },
  };

  return fetch(`${API_BASE_URL}/auth/verify-email-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).then((res) => {
    if (!res.ok) throw new Error("Mã xác nhận không đúng hoặc đã hết hạn");
    return res.json();
  });
};