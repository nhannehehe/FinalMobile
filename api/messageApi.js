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
export function connectWebSocket(token, userId, onMessageCallback, onDeleteCallback, onRecallCallback, onPinCallback, onUnpinCallback, groupIds = [], onFriendRequestCallback) {
  return new Promise((resolve, reject) => {
    if (!token) {
      reject(new Error('Token is required'));
      return;
    }

    // Cleanup existing connection
    if (stompClient) {
      try {
        stompClient.deactivate();
      } catch (error) {
        console.warn('Error cleaning up existing connection:', error);
      }
      stompClient = null;
    }

    const socket = new SockJS(SOCKJS_URL);
    stompClient = new Client({
      webSocketFactory: () => socket,
      connectHeaders: {
        Authorization: `Bearer ${token}`,
      },
      debug: function (str) {
        console.log('STOMP Debug:', str);
      },
      reconnectDelay: 5000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,
    });

    let subscriptions = [];

    stompClient.onConnect = (frame) => {
      console.log('STOMP connected:', frame);

      try {
        // Subscribe to personal messages
        subscriptions.push(
          stompClient.subscribe(`/user/${userId}/queue/messages`, (message) => {
            try {
              const parsedMessage = JSON.parse(message.body);
              console.log('Personal message received:', parsedMessage);
              if (parsedMessage._id) {
                parsedMessage.id = parsedMessage._id;
                delete parsedMessage._id;
              }
              onMessageCallback(parsedMessage);
            } catch (error) {
              console.error('Error parsing personal message:', error);
            }
          }, { Authorization: `Bearer ${token}` })
        );

        // Subscribe to group messages
        if (Array.isArray(groupIds)) {
          groupIds.forEach(groupId => {
            if (groupId) {
              console.log(`Subscribing to group ${groupId}`);
              
              // Main group messages
              subscriptions.push(
                stompClient.subscribe(`/topic/group/${groupId}`, (message) => {
                  try {
                    const parsedMessage = JSON.parse(message.body);
                    console.log(`Group ${groupId} message received:`, parsedMessage);
                    onMessageCallback({
                      ...parsedMessage,
                      id: parsedMessage._id || parsedMessage.id,
                      _id: undefined,
                      groupId: groupId // Ensure groupId is set
                    });
                  } catch (error) {
                    console.error(`Error parsing group ${groupId} message:`, error);
                  }
                }, { Authorization: `Bearer ${token}` })
              );

              // Group events
              subscriptions.push(
                stompClient.subscribe(`/topic/group/${groupId}/events`, (event) => {
                  try {
                    const parsedEvent = JSON.parse(event.body);
                    console.log(`Group ${groupId} event received:`, parsedEvent);
                    
                    switch(parsedEvent.type) {
                      case 'DELETE':
                        onDeleteCallback && onDeleteCallback(parsedEvent);
                        break;
                      case 'RECALL':
                        onRecallCallback && onRecallCallback(parsedEvent);
                        break;
                      case 'PIN':
                        onPinCallback && onPinCallback(parsedEvent);
                        break;
                      case 'UNPIN':
                        onUnpinCallback && onUnpinCallback(parsedEvent);
                        break;
                      default:
                        console.log('Unknown group event type:', parsedEvent.type);
                    }
                  } catch (error) {
                    console.error(`Error parsing group ${groupId} event:`, error);
                  }
                }, { Authorization: `Bearer ${token}` })
              );
            }
          });
        }

        // Other subscriptions (delete, recall, etc.)
        subscriptions.push(
          stompClient.subscribe(`/user/${userId}/queue/delete`, (message) => {
            try {
              const parsedMessage = JSON.parse(message.body);
              console.log('Delete notification:', parsedMessage);
              onDeleteCallback(parsedMessage);
            } catch (error) {
              console.error('Error parsing delete notification:', error);
            }
          }, { Authorization: `Bearer ${token}` })
        );

        subscriptions.push(
          stompClient.subscribe(`/user/${userId}/queue/recall`, (message) => {
            try {
              const parsedMessage = JSON.parse(message.body);
              console.log('Recall notification:', parsedMessage);
              onRecallCallback(parsedMessage);
            } catch (error) {
              console.error('Error parsing recall notification:', error);
            }
          }, { Authorization: `Bearer ${token}` })
        );

        resolve(stompClient);
      } catch (error) {
        console.error('Error setting up subscriptions:', error);
        reject(error);
      }
    };

    stompClient.onStompError = (frame) => {
      console.error('STOMP error:', frame);
      reject(new Error(`STOMP error: ${frame.body || frame.headers?.message || 'Unknown error'}`));
    };

    stompClient.onWebSocketClose = (event) => {
      console.log('WebSocket closed:', event);
      // Cleanup subscriptions
      subscriptions.forEach(sub => {
        try {
          sub.unsubscribe();
        } catch (error) {
          console.warn('Error unsubscribing:', error);
        }
      });
      subscriptions = [];
      stompClient = null;
    };

    stompClient.onWebSocketError = (error) => {
      console.error('WebSocket error:', error);
      reject(new Error(`WebSocket error: ${error.message || 'Connection failed'}`));
    };

    console.log('Connecting STOMP...');
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