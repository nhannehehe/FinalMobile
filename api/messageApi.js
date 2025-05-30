import axios from 'axios';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = 'http://192.168.1.189:8080/message';
const SOCKJS_URL = 'http://192.168.1.189:8080/ws';

let stompClient = null;

// Hàm lấy lịch sử tin nhắn
export const getChatHistory = async (userId, groupId, token) => {
  try {
    const url = groupId ? `${API_BASE_URL}/chat-history/group/${groupId}` : `${API_BASE_URL}/chat-history/${userId}`;
    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    const deletedMessageIds = JSON.parse(await AsyncStorage.getItem('deletedMessageIds') || '[]');
    return response.data.map(msg => {
      const id = msg._id || msg.id;
      return {
        ...msg,
        id,
        _id: undefined,
        isDeleted: deletedMessageIds.includes(id),
      };
    });
  } catch (error) {
    console.error('Error fetching chat history:', error.response?.data || error.message);
    throw error;
  }
};

// Hàm lấy tin nhắn được ghim
export const getPinnedMessages = async (otherUserId, groupId, token) => {
  try {
    const params = new URLSearchParams({ otherUserId });
    if (groupId) params.append('groupId', groupId);

    const response = await axios.get(`${API_BASE_URL}/all-pinned-messages?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const pinnedOnly = response.data.filter(msg => msg.pinned === true);

    return pinnedOnly.map(msg => ({
      ...msg,
      id: msg._id || msg.id,
      _id: undefined,
    }));
  } catch (error) {
    console.error('Error fetching pinned messages:', error.response?.data || error.message);
    throw error;
  }
};


// Hàm tìm kiếm tin nhắn
export const searchMessages = async (otherUserId, groupId, keyword, token) => {
  try {
    const params = new URLSearchParams({ otherUserId, keyword });
    if (groupId) params.append('groupId', groupId);
    const response = await axios.get(`${API_BASE_URL}/search?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return response.data.map(msg => ({
      ...msg,
      id: msg._id || msg.id,
      _id: undefined,
    }));
  } catch (error) {
    console.error('Error searching messages:', error.response?.data || error.message);
    throw error;
  }
};

// Hàm upload file
export const uploadFile = async (files, receiverId, token, groupId = null, replyToMessageId = null) => {
  try {
    const formData = new FormData();
    files.forEach(file => {
      formData.append('file', file);
    });
    if (receiverId) formData.append('receiverId', receiverId);
    if (groupId) formData.append('groupId', groupId);
    if (replyToMessageId) formData.append('replyToMessageId', replyToMessageId);

    const response = await axios.post(`${API_BASE_URL}/upload-file`, formData, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  } catch (error) {
    console.error('Error uploading file:', error);
    throw error;
  }
};



// Hàm kết nối WebSocket với STOMP
export function connectWebSocket(token, userId, onMessageCallback, onDeleteCallback, onRecallCallback) {
  return new Promise((resolve, reject) => {
    if (!token) {
      reject(new Error('Token is missing'));
      return;
    }

    if (stompClient && stompClient.connected) {
      console.log('STOMP connection already in progress');
      resolve();
      return;
    }

    if (stompClient && stompClient.state !== 'CLOSED') {
      console.log('STOMP client state:', stompClient.state);
      resolve();
      return;
    }

    stompClient = new Client({
      webSocketFactory: () => {
        console.log('Connecting to SockJS:', SOCKJS_URL);
        return new SockJS(SOCKJS_URL);
      },
      connectHeaders: {
        Authorization: `Bearer ${token}`,
        userId: userId,
      },
      debug: (str) => {
        console.log('STOMP debug:', str);
      },
      reconnectDelay: 10000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,
    });

    stompClient.onConnect = (frame) => {
      console.log('STOMP connected:', frame);
      
      stompClient.subscribe(`/user/${userId}/queue/messages`, (message) => {
        try {
          const parsedMessage = JSON.parse(message.body);
          console.log('Raw WebSocket response:', parsedMessage);
          if (parsedMessage._id) {
            parsedMessage.id = parsedMessage._id;
            delete parsedMessage._id;
          }
          onMessageCallback(parsedMessage);
        } catch (error) {
          console.error('Error parsing message:', error);
        }
      }, { Authorization: `Bearer ${token}` });

      stompClient.subscribe(`/user/${userId}/queue/delete`, (message) => {
        try {
          const parsedMessage = JSON.parse(message.body);
          console.log('Delete notification:', parsedMessage);
          if (parsedMessage._id) {
            parsedMessage.id = parsedMessage._id;
            delete parsedMessage._id;
          }
          onDeleteCallback(parsedMessage);
        } catch (error) {
          console.error('Error parsing delete notification:', error);
        }
      }, { Authorization: `Bearer ${token}` });

      stompClient.subscribe(`/user/${userId}/queue/recall`, (message) => {
        try {
          const parsedMessage = JSON.parse(message.body);
          console.log('Recall notification:', parsedMessage);
          if (parsedMessage._id) {
            parsedMessage.id = parsedMessage._id;
            delete parsedMessage._id;
          }
          onRecallCallback(parsedMessage);
        } catch (error) {
          console.error('Error parsing recall notification:', error);
        }
      }, { Authorization: `Bearer ${token}` });

      resolve();
    };

    stompClient.onStompError = (frame) => {
      console.error('STOMP error:', frame);
      reject(new Error(`STOMP error: ${frame.body || frame.headers?.message || 'Unknown error'}`));
    };

    stompClient.onWebSocketClose = (event) => {
      console.log('SockJS disconnected:', event);
      stompClient = null;
    };

    stompClient.onWebSocketError = (error) => {
      console.error('SockJS error:', error);
      reject(new Error(`SockJS error: ${error.message || 'Connection failed'}`));
    };

    console.log('Connecting STOMP with token:', token.substring(0, 20) + '...');
    stompClient.activate();
  });
}

// Hàm gửi tin nhắn
export function sendMessage(destination, message, token) {
  return new Promise((resolve) => {
    if (!stompClient || !stompClient.connected) {
      console.error('Cannot send message: STOMP client is not connected');
      resolve(false);
      return;
    }

    try {
      stompClient.publish({
        destination,
        body: JSON.stringify(message),
        headers: { Authorization: `Bearer ${token}` },
      });
      console.log('Sent message to', destination, 'with body:', message);
      resolve(true);
    } catch (error) {
      console.error('Error sending message:', error);
      resolve(false);
    }
  });
}

// Hàm thu hồi tin nhắn
export function recallMessage(identifier, userId, token) {
  return new Promise((resolve) => {
    if (!stompClient || !stompClient.connected) {
      console.error('Cannot recall message: STOMP client is not connected');
      resolve(false);
      return;
    }

    try {
      const message = { id: identifier, senderId: userId };
      stompClient.publish({
        destination: '/app/chat.recall',
        body: JSON.stringify(message),
        headers: { Authorization: `Bearer ${token}` },
      });
      console.log('Recalled message:', identifier);
      resolve(true);
    } catch (error) {
      console.error('Error recalling message:', error);
      resolve(false);
    }
  });
}

// Hàm xóa tin nhắn
export function deleteMessage(identifier, userId, token) {
  return new Promise((resolve) => {
    if (!stompClient || !stompClient.connected) {
      console.error('Cannot delete message: STOMP client is not connected');
      resolve(false);
      return;
    }

    try {
      const message = { id: identifier, senderId: userId };
      stompClient.publish({
        destination: '/app/chat.delete',
        body: JSON.stringify(message),
        headers: { Authorization: `Bearer ${token}` },
      });
      console.log('Deleted message:', identifier);
      resolve(true);
    } catch (error) {
      console.error('Error deleting message:', error);
      resolve(false);
    }
  });
}

// Hàm chuyển tiếp tin nhắn
export function forwardMessage(identifier, userId, receiverId, groupId, content, token) {
  return new Promise((resolve) => {
    if (!stompClient || !stompClient.connected) {
      console.error('Cannot forward message: STOMP client is not connected');
      resolve(false);
      return;
    }

    try {
      const message = {
        id: identifier,
        senderId: userId,
        receiverId,
        groupId,
        content,
        type: 'FORWARD'
      };
      stompClient.publish({
        destination: '/app/chat.forward',
        body: JSON.stringify(message),
        headers: { Authorization: `Bearer ${token}` },
      });
      console.log('Forwarded message:', identifier, 'to', receiverId || groupId);
      resolve(true);
    } catch (error) {
      console.error('Error forwarding message:', error);
      resolve(false);
    }
  });
}

// Hàm ngắt kết nối
export function disconnectWebSocket() {
  if (stompClient && stompClient.connected) {
    console.log('Disconnecting STOMP');
    stompClient.deactivate();
  } else {
    console.log('No active STOMP connection to disconnect');
  }
  stompClient = null;
}