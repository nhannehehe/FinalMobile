import { API_BASE_URL } from "../config";
import { getAccessToken } from "../api/authApi";
import * as ImageManipulator from 'expo-image-manipulator';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';

export const fetchUserProfile = async () => {
  try {
    const token = await getAccessToken();
    if (!token) throw new Error('Không tìm thấy token');
    if (!API_BASE_URL) throw new Error('API_BASE_URL bị thiếu');
    console.log('API_BASE_URL:', API_BASE_URL);
    console.log('Token:', token);

    const response = await fetch(`${API_BASE_URL}/user/get-info-for-user`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      let error = {};
      try { error = await response.json(); } catch {}
      throw new Error(error.message || `Failed to fetch profile: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return null;
  }
};

export const updateUserProfile = async (profile, avatarFile) => {
  try {
    let profileData = profile;
    if (!profileData) {
      profileData = await fetchUserProfile();
      if (!profileData) throw new Error('Không lấy được thông tin user để update');
    }
    // Tạo file tạm chứa JSON profile
    const jsonString = JSON.stringify({
      email: profileData.email || '',
      firstName: profileData.firstName || '',
      lastName: profileData.lastName || '',
      phone: profileData.phone || '',
      gender: profileData.gender || '',
      birthday: profileData.birthday || '',
      // Thêm các trường khác nếu backend yêu cầu
    });
    const requestFileUri = FileSystem.cacheDirectory + 'request.json';
    await FileSystem.writeAsStringAsync(requestFileUri, jsonString, { encoding: FileSystem.EncodingType.UTF8 });

    const formData = new FormData();
    formData.append('request', {
      uri: requestFileUri,
      type: 'application/json',
      name: 'request.json',
    });
    // Resize/nén ảnh mạnh hơn trước khi upload
    let manipResult = null;
    if (avatarFile) {
      manipResult = await ImageManipulator.manipulateAsync(
        avatarFile.uri,
        [{ resize: { width: 320 } }], // width nhỏ hơn
        { compress: 0.5, format: ImageManipulator.SaveFormat.JPEG } // nén mạnh hơn
      );
    }
    if (avatarFile && manipResult) {
      formData.append('avatar', {
        uri: manipResult.uri,
        type: 'image/jpeg',
        name: avatarFile.name || 'avatar.jpg',
      });
    }
    const token = await AsyncStorage.getItem("accessToken");
    const response = await fetch(`${API_BASE_URL}/user/update`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });
    const responseText = await response.text();
    if (!response.ok) {
      console.error("Update profile failed:", response.status, responseText);
      throw new Error("Update profile failed");
    }
    return JSON.parse(responseText);
  } catch (error) {
    console.error("Update profile failed:", error);
    return null;
  }
};

export const updatePassword = async (oldPassword, newPassword) => {
  try {
    const token = await getAccessToken();
    const response = await fetch(`${API_BASE_URL}/user/change-password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ oldPassword, newPassword }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to update password");
    }

    return await response.json();
  } catch (error) {
    console.error("Error updating password:", error);
    return null;
  }
};

export const uploadAvatar = async (file) => {
  try {
    // Lấy thông tin user hiện tại để truyền vào request
    const profile = await fetchUserProfile();
    if (!profile) {
      throw new Error('Không lấy được thông tin user để update avatar');
    }

    // Chuẩn bị object cho UserUpdateRequest
    const userUpdateRequest = {
      email: profile.email || '',
      firstName: profile.firstName || '',
      lastName: profile.lastName || '',
      phone: profile.phone || '',
      gender: profile.gender || '',
      birthday: profile.birthday || '',
      // Thêm các trường khác nếu backend yêu cầu
    };

    // Resize/nén ảnh trước khi upload
    const manipResult = await ImageManipulator.manipulateAsync(
      file.uri,
      [{ resize: { width: 512 } }],
      { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
    );

    const formData = new FormData();
    formData.append("request", JSON.stringify(userUpdateRequest));
    formData.append("avatar", {
      uri: manipResult.uri,
      type: "image/jpeg",
      name: file.name || "avatar.jpg",
    });

    const token = await AsyncStorage.getItem("accessToken");

    const response = await fetch(`${API_BASE_URL}/user/update`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    const responseText = await response.text();
    if (!response.ok) {
      console.error("Upload failed:", response.status, responseText);
      throw new Error("Upload failed");
    }
    return JSON.parse(responseText);
  } catch (error) {
    console.error("Upload error:", error);
    return null;
  }
};

