import axios from 'axios';
import { API_BASE_URL } from '../config';
import { getAccessToken, refreshToken } from '../api/authApi';

// Tạo nhóm mới
export const createGroup = async (groupData) => {
  try {
    let token = await getAccessToken();
    if (!token) {
      throw new Error('Token is missing');
    }

    // Lấy userId từ token payload
    const tokenPayload = JSON.parse(atob(token.split('.')[1]));
    const userId = tokenPayload.userId;
    
    // Đảm bảo memberIds là array và loại bỏ trùng lặp
    const memberIds = Array.isArray(groupData.memberIds) ? groupData.memberIds : [groupData.memberIds];
    const finalMemberIds = [...new Set([...memberIds, userId])];

    // Validate dữ liệu
    if (!groupData.name || finalMemberIds.length < 2) {
      throw new Error('Invalid group data: name and at least 2 members are required');
    }

    console.log('Creating group with data:', {
      name: groupData.name,
      createId: userId,
      memberIds: finalMemberIds
    });

    const response = await axios.post(
      `${API_BASE_URL}/group`,
      {
        name: groupData.name,
        createId: userId,
        memberIds: finalMemberIds
      },
      { 
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('Create group response:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error creating group:', {
      status: error.response?.status,
      data: error.response?.data,
      message: error.message
    });
    
    if (error.response?.status === 403) {
      throw new Error('Không có quyền tạo nhóm. Vui lòng đăng nhập lại.');
    }
    throw error;
  }
};
export const dissolveGroup = async (groupId, token) => {
    if (!token) {
      throw new Error('Token is missing');
    }
    try {
      const response = await axios.delete(`${API_BASE_URL}/group/${groupId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      console.log('Dissolve group response:', response.data);
      return response.data;
    } catch (error) {
      console.error('Error dissolving group:', {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message
      });
      throw error;
    }
  };

export const addGroupMembers = async (groupId, userIds, token) => {
  if (!token) {
    throw new Error('Token is missing');
  }
  try {
    const response = await axios.post(`${API_BASE_URL}/group/${groupId}/members`, userIds, {
      headers: { 
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
    });
    console.log('Add group members response:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error adding group members:', {
      status: error.response?.status,
      data: error.response?.data,
      message: error.message
    });
    throw error;
  }
};

// Xóa thành viên khỏi nhóm
export const removeGroupMember = async (groupId, userId, token) => {
  if (!token) {
    token = await getAccessToken();
    if (!token) throw new Error('Token is missing');
  }
  try {
    const response = await axios.delete(
      `${API_BASE_URL}/group/${groupId}/members/${userId}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    console.log('Remove group member response:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error removing group member:', {
      status: error.response?.status,
      data: error.response?.data,
      message: error.message
    });
    throw error;
  }
};

// Gán vai trò cho thành viên
export const assignGroupRole = async (groupId, userId, role, token) => {
  if (!token) {
    token = await getAccessToken();
    if (!token) throw new Error('Token is missing');
  }
  try {
    const response = await axios.put(
      `${API_BASE_URL}/group/${groupId}/roles/${userId}`,
      {},
      {
        headers: { Authorization: `Bearer ${token}` },
        params: { role }
      }
    );
    console.log('Assign group role response:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error assigning group role:', {
      status: error.response?.status,
      data: error.response?.data,
      message: error.message
    });
    throw error;
  }
};

// Lấy danh sách nhóm của user
export const fetchUserGroups = async (userId, token) => {
  if (!token) {
    token = await getAccessToken();
    if (!token) throw new Error('Token is missing');
  }
  try {
    const response = await axios.get(`${API_BASE_URL}/group/user/${userId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    console.log('Fetch groups response:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error fetching groups:', {
      status: error.response?.status,
      data: error.response?.data,
      message: error.message
    });
    throw error;
  }
};

// Lấy danh sách thành viên trong nhóm
export const fetchGroupMembers = async (groupId, token) => {
  if (!token) {
    token = await getAccessToken();
    if (!token) throw new Error('Token is missing');
  }
  try {
    const response = await axios.get(`${API_BASE_URL}/group/${groupId}/members`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    console.log('Fetch group members response:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error fetching group members:', {
      status: error.response?.status,
      data: error.response?.data,
      message: error.message
    });
    throw error;
  }
}; 