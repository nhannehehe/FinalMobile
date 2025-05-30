import React, { useState, useEffect, useRef, useCallback, InteractionManager } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  SafeAreaView,
  Modal,
  Pressable,
  FlatList,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { getChatHistory, getPinnedMessages,connectWebSocket, sendMessage, uploadFile, recallMessage, deleteMessage, forwardMessage,} from '../api/messageApi';
import * as MediaLibrary from 'expo-media-library';
import * as DocumentPicker from 'expo-document-picker';
import * as Linking from 'expo-linking';
import EmojiSelector, { Categories } from 'react-native-emoji-selector';
import { API_BASE_URL } from '../config';
import * as FileSystem from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { createGroup } from '../api/groupApi';
import { getAccessToken } from '../api/authApi';
import { removeGroupMember } from '../api/groupApi';
import { addGroupMembers, assignGroupRole } from '../api/groupApi';
import { fetchGroupMembers, dissolveGroup } from '../api/groupApi';
import { manipulateAsync } from 'expo-image-manipulator';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const MAX_IMAGE_SIZE = 1024; // Maximum dimension for image compression
const MAX_IMAGE_QUALITY = 0.7; // Image quality after compression

const ChatRoomScreen = ({ route, navigation }) => {
  const { friendInfo, groupInfo } = route.params || {};
  const [token, setToken] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [webSocketUserId, setWebSocketUserId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [pinnedMessages, setPinnedMessages] = useState([]);
  const [messageInput, setMessageInput] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState(null);
  //model
  const [modalVisible, setModalVisible] = useState(false);
  const [uploadModalVisible, setUploadModalVisible] = useState(false);
  const [pinnedModalVisible, setPinnedModalVisible] = useState(false);
  const [searchModalVisible, setSearchModalVisible] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [friendListModalVisible, setFriendListModalVisible] = useState(false);
  //
  const [friends, setFriends] = useState([]);
  const [members, setMembers] = useState([]);
  const [deletedIds, setDeletedIds] = useState([]);
  const [isLoadingFriends, setIsLoadingFriends] = useState(false);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [userNames, setUserNames] = useState({});
  const [isLoadingChat, setIsLoadingChat] = useState(false);
  const [highlightedMessageId, setHighlightedMessageId] = useState(null);
  const scrollViewRef = useRef();
  const webSocketClientRef = useRef(null);
  const isMounted = useRef(true);
  const [selectedImages, setSelectedImages] = useState([]);
  const [imagePickerModalVisible, setImagePickerModalVisible] = useState(false);
  const [availableImages, setAvailableImages] = useState([]);
  const [selectedImageIds, setSelectedImageIds] = useState(new Set());
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [selectedGroupMembers, setSelectedGroupMembers] = useState([]);
  const [showGroupSettingsModal, setShowGroupSettingsModal] = useState(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [showRemoveMemberModal, setShowRemoveMemberModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);
  const flatListRef = useRef(null);
  const [isGroupOwner, setIsGroupOwner] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [groupRoles, setGroupRoles] = useState({});
  const [searchResults, setSearchResults] = useState([]);
  // Hàm xử lý chọn tài liệu
  const [isPickingDocument, setIsPickingDocument] = useState(false);

  const isGroupChat = !!groupInfo;
  const chatPartner = isGroupChat ? groupInfo : friendInfo;
  const otherUserId = isGroupChat ? null : friendInfo?.id;
  const groupId = isGroupChat ? groupInfo?.id : null;

  const deduplicateMessages = (msgs) => {
    const seenKeys = new Map();
    return msgs.filter((msg) => {
      const uniqueKey = msg.id || `${msg.senderId}-${msg.receiverId || msg.groupId}-${msg.content}-${msg.createAt}-${msg.type}`;
      if (seenKeys.has(uniqueKey)) return false;
      seenKeys.set(uniqueKey, true);
      return true;
    });
  };

  const sortMessagesByTime = (msgs) => {
    return [...msgs].sort((a, b) => new Date(a.createAt) - new Date(b.createAt));
  };

  useEffect(() => {
    isMounted.current = true;
    const loadAuthData = async () => {
      try {
        const storedToken = await getAccessToken();
        const storedUserId = await AsyncStorage.getItem('userId') || await AsyncStorage.getItem('username');
        if (storedToken && storedUserId) {
          setToken(storedToken);
          setCurrentUserId(storedUserId);
          try {
            const tokenPayload = JSON.parse(atob(storedToken.split('.')[1]));
            setWebSocketUserId(tokenPayload.userId || storedUserId);
          } catch (error) {
            console.error('Lỗi giải mã token:', error);
            setWebSocketUserId(storedUserId);
          }
        } else {
          Alert.alert('Lỗi', 'Không tìm thấy thông tin đăng nhập. Vui lòng đăng nhập lại.');
          navigation.navigate('Login');
        }
      } catch (error) {
        console.error('Lỗi tải dữ liệu xác thực:', error);
        Alert.alert('Lỗi', 'Không thể tải thông tin đăng nhập');
      }
    };
    loadAuthData();

    return () => {
      isMounted.current = false;
    };
  }, [navigation]);

  useFocusEffect(
    useCallback(() => {
      if (!token || !webSocketUserId) return;

      const setupWebSocketAndLoadHistory = async () => {
        try {
          // Disconnect existing WebSocket if any
          if (webSocketClientRef.current) {
            console.log('WebSocket client already exists, disconnecting...');
            webSocketClientRef.current.deactivate();
            webSocketClientRef.current = null;
          }

          // Clear messages first
          setMessages([]);
          
          // Load chat history first
          await loadChatHistory();
          await loadPinnedMessages();

          // Then setup WebSocket after history is loaded
          const client = await connectWebSocket(
            token,
            webSocketUserId,
            handleWebSocketMessage,
            handleWebSocketDelete,
            handleWebSocketRecall,
            handleWebSocketPin,
            handleWebSocketUnpin,
            groupId ? [groupId] : [],
            handleFriendRequest
          );

          webSocketClientRef.current = client;
          console.log('WebSocket setup completed');
        } catch (error) {
          console.error('Error in setupWebSocketAndLoadHistory:', error);
          showNotification('Lỗi kết nối WebSocket: ' + error.message, 'error');
        }
      };

      setupWebSocketAndLoadHistory();

      return () => {
        if (webSocketClientRef.current) {
          console.log('Disconnecting WebSocket...');
          webSocketClientRef.current.deactivate();
          webSocketClientRef.current = null;
        }
      };
    }, [token, webSocketUserId, groupId])
  );

  const handleWebSocketMessage = useCallback((message) => {
    if (!isMounted.current) return;
    
    console.log('WebSocket message received:', message);
    
    // Kiểm tra xem tin nhắn có thuộc về cuộc trò chuyện hiện tại không
    const isCurrentChat = (message.groupId && message.groupId === groupId) ||
      (!message.groupId && ((message.senderId === otherUserId && message.receiverId === webSocketUserId) ||
        (message.senderId === webSocketUserId && message.receiverId === otherUserId)));

    if (isCurrentChat) {
      setMessages(prevMessages => {
        // Kiểm tra tin nhắn trùng lặp
        const isDuplicate = prevMessages.some(msg => 
          msg.id === message.id || 
          (msg.content === message.content && 
           msg.senderId === message.senderId && 
           Math.abs(new Date(msg.createAt) - new Date(message.createAt)) < 1000)
        );

        if (isDuplicate) {
          console.log('Duplicate message detected, skipping...');
          return prevMessages;
        }

        // Chuẩn hóa tin nhắn mới
        const normalizedMessage = {
          ...message,
          id: message.id || message._id || `${Date.now()}-${message.senderId}`,
          createAt: new Date(message.createAt || message.createdAt || Date.now()).toISOString(),
          type: message.type || 'TEXT',
          recalled: message.recalled || false,
          read: message.read || false,
          deletedByUsers: message.deletedByUsers || [],
          isPinned: message.isPinned || false
        };

        // Thêm tin nhắn mới và sắp xếp
        const newMessages = [...prevMessages, normalizedMessage].sort((a, b) => 
          new Date(a.createAt).getTime() - new Date(b.createAt).getTime()
        );

        // Tự động scroll xuống nếu tin nhắn mới là của người dùng hiện tại
        if (normalizedMessage.senderId === webSocketUserId && flatListRef.current) {
          setTimeout(() => {
            flatListRef.current.scrollToEnd({ animated: true });
          }, 100);
        }

        return newMessages;
      });

      // Đánh dấu đã đọc nếu tin nhắn từ người khác
      if (message.senderId !== webSocketUserId && !message.read) {
        handleReadMessage(message.id);
      }
    }
  }, [groupId, otherUserId, webSocketUserId, handleReadMessage]);

  const handleWebSocketDelete = useCallback((event) => {
    if (!isMounted.current) return;
    
    console.log('Delete event received:', event);
    
    setMessages(prevMessages => 
      prevMessages.map(msg => 
        msg.id === event.messageId 
          ? { ...msg, isDeleted: true, deletedByUsers: [...(msg.deletedByUsers || []), event.userId] }
          : msg
      )
    );
  }, []);

  const handleWebSocketRecall = useCallback((event) => {
    if (!isMounted.current) return;
    
    console.log('Recall event received:', event);
    
    setMessages(prevMessages => 
      prevMessages.map(msg => 
        msg.id === event.messageId 
          ? { ...msg, recalled: true }
          : msg
      )
    );
  }, []);

  const handleWebSocketPin = useCallback((event) => {
    if (!isMounted.current) return;
    
    console.log('Pin event received:', event);
    
    setMessages(prevMessages => 
      prevMessages.map(msg => 
        msg.id === event.messageId 
          ? { ...msg, isPinned: true }
          : msg
      )
    );
    
    // Refresh pinned messages
    loadPinnedMessages();
  }, [loadPinnedMessages]);

  const handleWebSocketUnpin = useCallback((event) => {
    if (!isMounted.current) return;
    
    console.log('Unpin event received:', event);
    
    setMessages(prevMessages => 
      prevMessages.map(msg => 
        msg.id === event.messageId 
          ? { ...msg, isPinned: false }
          : msg
      )
    );
    
    // Refresh pinned messages
    loadPinnedMessages();
  }, [loadPinnedMessages]);

  const handleFriendRequest = useCallback((notification) => {
    if (!isMounted.current) return;
    
    console.log('Friend request received:', notification);
    // Handle friend request notification
    showNotification('Bạn có lời mời kết bạn mới', 'info');
  }, []);

  const fetchFriends = async () => {
    setIsLoadingFriends(true);
    try {
      const response = await axios.get(`${API_BASE_URL}/friend`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const friendList = response.data.map((friend) => ({
        id: friend.id || friend.userId,
        name: friend.name || friend.fullName || friend.username || 'Người dùng không tên',
        avatar: friend.avatar || friend.profilePicture || 'https://randomuser.me/api/portraits/lego/1.jpg',
      }));
      setFriends(friendList);
      const updatedUserNames = {};
      friendList.forEach((friend) => {
        updatedUserNames[friend.id] = friend.name;
      });
      setUserNames((prev) => ({ ...prev, ...updatedUserNames }));
    } catch (error) {
      console.error('Lỗi lấy danh sách bạn bè:', error.response?.data || error.message);
      setFriends([]);
      Alert.alert('Lỗi', 'Không thể tải danh sách bạn bè. Vui lòng thử lại sau.');
    } finally {
      setIsLoadingFriends(false);
    }
  };

  const fetchMembers = async () => {
    if (!isGroupChat) return;
    setIsLoadingMembers(true);
    try {
      const response = await axios.get(`${API_BASE_URL}/group/${groupInfo.id}/members`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const memberList = response.data.map((member) => ({
        id: member.id || member.userId,
        name: member.name || member.fullName || member.username || 'Người dùng không tên',
        avatar: member.avatar || member.profilePicture || 'https://randomuser.me/api/portraits/lego/1.jpg',
      }));
      setMembers(memberList);
      const updatedUserNames = {};
      memberList.forEach((member) => {
        updatedUserNames[member.id] = member.name;
      });
      setUserNames((prev) => ({ ...prev, ...updatedUserNames }));
    } catch (error) {
      console.error('Lỗi lấy danh sách thành viên:', error.response?.data || error.message);
      if (error.response?.status === 404 || error.response?.status === 403) {
        Alert.alert('Thông báo', 'Nhóm chat không tồn tại hoặc bạn không có quyền truy cập');
        navigation.goBack();
        return;
      }
      setMembers([]);
      Alert.alert('Lỗi', 'Không thể tải danh sách thành viên. Vui lòng thử lại sau.');
    } finally {
      setIsLoadingMembers(false);
    }
  };

  const getUserNameById = async (userId) => {
    if (!userId || userNames[userId]) return userNames[userId] || 'Người dùng không tên';
    try {
      const response = await axios.get(`${API_BASE_URL}/friend/${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const userName = response.data.name || response.data.fullName || response.data.username || 'Người dùng không tên';
      setUserNames((prev) => ({ ...prev, [userId]: userName }));
      return userName;
    } catch (error) {
      console.error(`Lỗi lấy tên người dùng cho userId ${userId}:`, error.response?.data || error.message);
      setUserNames((prev) => ({ ...prev, [userId]: 'Người dùng không tên' }));
      return 'Người dùng không tên';
    }
  };

  useEffect(() => {
    if (token) {
      fetchFriends();
      if (isGroupChat) fetchMembers();
    }
  }, [token, isGroupChat]);

  useEffect(() => {
    const fetchSenderNames = async () => {
      const senderIds = [...new Set(messages.map((msg) => msg.originalSenderId || msg.senderId).filter((id) => id && !userNames[id]))];
      for (const senderId of senderIds) {
        await getUserNameById(senderId);
      }
    };
    if (messages.length > 0) fetchSenderNames();
  }, [messages]);

  const localKey = `localMessages-${isGroupChat ? groupId : otherUserId}`;
  const saveLocalMessage = async (msg) => {
    const old = JSON.parse(await AsyncStorage.getItem(localKey) || '[]');
    await AsyncStorage.setItem(localKey, JSON.stringify([...old, msg]));
  };

  const loadChatHistory = async (retryCount = 0) => {
    if (!token || !isMounted.current) return;
    setIsLoadingChat(true);
    try {
      const deletedMessageIds = JSON.parse(await AsyncStorage.getItem('deletedMessageIds') || '[]');
      const chatHistory = await getChatHistory(otherUserId, groupId, token);
      
      if (!isMounted.current) return;

      if (!chatHistory) {
        Alert.alert('Thông báo', 'Không thể truy cập vào cuộc trò chuyện này');
        navigation.goBack();
        return;
      }

      const updatedChatHistory = chatHistory.map((msg) => {
        const msgId = msg._id || msg.id || `${msg.senderId}-${msg.receiverId || msg.groupId}-${msg.content}-${msg.createdAt}`;
        const isDeleted = deletedMessageIds.includes(msgId) || deletedIds.includes(msgId);
        return {
          ...msg,
          id: msgId,
          createAt: msg.createdAt || msg.createAt || new Date().toISOString(),
          recalled: msg.recalled || false,
          read: msg.read || (msg.senderId !== webSocketUserId && !msg.recalled),
          type: msg.type || 'TEXT',
          content: isDeleted ? 'Tin nhắn đã bị xóa' : msg.content,
          ...(msg.forwardedFrom && {
            type: 'FORWARD',
            originalSenderId: msg.forwardedFrom.originalSenderId || msg.senderId
          })
        };
      });

      // Merge local messages
      const localMessages = JSON.parse(await AsyncStorage.getItem(localKey) || '[]');
      const merged = deduplicateMessages([...updatedChatHistory, ...localMessages]);
      setMessages(sortMessagesByTime(merged));

      // Xóa local nếu đã có trên server
      const serverIds = new Set(updatedChatHistory.map(msg => msg.id));
      const filteredLocal = localMessages.filter(msg => !serverIds.has(msg.id) && !updatedChatHistory.some(smsg =>
        smsg.content === msg.content &&
        smsg.senderId === msg.senderId &&
        Math.abs(new Date(smsg.createAt) - new Date(msg.createAt)) < 60000
      ));
      await AsyncStorage.setItem(localKey, JSON.stringify(filteredLocal));
    } catch (error) {
      console.error('Lỗi tải lịch sử chat:', error.response?.data || error.message);
      if (retryCount < 5) {
        setTimeout(() => loadChatHistory(retryCount + 1), 1000);
      } else {
        Alert.alert('Lỗi', 'Không thể tải lịch sử chat');
        navigation.goBack();
      }
    } finally {
      if (isMounted.current) setIsLoadingChat(false);
    }
  };

  const localPinnedKey = `localPinnedMessages-${isGroupChat ? groupId : otherUserId}`;
  const saveLocalPinned = async (msg) => {
    const old = JSON.parse(await AsyncStorage.getItem(localPinnedKey) || '[]');
    if (!old.some(m => m.id === msg.id)) {
      await AsyncStorage.setItem(localPinnedKey, JSON.stringify([...old, msg]));
    }
  };
  const removeLocalPinned = async (msgId) => {
    const old = JSON.parse(await AsyncStorage.getItem(localPinnedKey) || '[]');
    const filtered = old.filter(m => m.id !== msgId);
    await AsyncStorage.setItem(localPinnedKey, JSON.stringify(filtered));
  };

  const loadPinnedMessages = async (retryCount = 0) => {
    if (!token || (!otherUserId && !groupId) || !isMounted.current) return;
    try {
      const params = {
        otherUserId: otherUserId || webSocketUserId,
        groupId: groupId || null,
      };
      const pinned = await getPinnedMessages(otherUserId || webSocketUserId, groupId, token);
      // Merge local pinned
      const localPinned = JSON.parse(await AsyncStorage.getItem(localPinnedKey) || '[]');
      const mergedPinned = deduplicateMessages([...pinned, ...localPinned]);
      setPinnedMessages(mergedPinned);
      // Xóa local nếu đã có trên server
      const serverIds = new Set(pinned.map(msg => msg.id));
      const filteredLocal = localPinned.filter(msg => !serverIds.has(msg.id));
      await AsyncStorage.setItem(localPinnedKey, JSON.stringify(filteredLocal));
    } catch (error) {
      console.error('Lỗi tải tin nhắn ghim:', error.response?.data || error.message);
      if (retryCount < 5) {
        setTimeout(() => loadPinnedMessages(retryCount + 1), 1000);
      } else {
        setPinnedMessages([]);
      }
    }
  };

  const handleSearchMessages = async () => {
    if (!searchInput.trim() || !token || (!otherUserId && !groupId)) return;
    try {
      const keyword = searchInput.trim().toLowerCase();
      // Tìm tất cả tin nhắn chứa từ khóa
      const foundMessages = messages.filter(msg =>
        typeof msg.content === 'string' && msg.content.toLowerCase().includes(keyword)
      );
      if (foundMessages.length > 0) {
        // Tạo danh sách kết quả với toàn bộ nội dung tin nhắn
        const results = foundMessages.map(msg => ({
          id: msg.id,
          content: msg.content,
          msgIndex: messages.findIndex((m) => m.id === msg.id),
          senderName: userNames[msg.originalSenderId || msg.senderId] || 'Người dùng không tên',
          createAt: msg.createAt
        }));
        setSearchResults(results);
        setSearchModalVisible(true);
      } else {
        Alert.alert('Thông báo', 'Không tìm thấy tin nhắn nào khớp với từ khóa.');
      }
    } catch (error) {
      console.error('Lỗi tìm kiếm tin nhắn:', error);
      Alert.alert('Lỗi', 'Không thể tìm kiếm tin nhắn');
    }
  };

  const handlePinnedMessagePress = (pinnedMsg) => {
    const msgIndex = messages.findIndex((msg) => msg.id === pinnedMsg.id);
    if (msgIndex !== -1) {
      setPinnedModalVisible(false);
      setHighlightedMessageId(pinnedMsg.id);
      // Tự động scroll đến tin nhắn
      setTimeout(() => {
        if (flatListRef.current) {
          flatListRef.current.scrollToIndex({
            index: msgIndex,
            animated: true,
            viewPosition: 0.5
          });
        }
      }, 100);
      if (!pinnedMsg.read && pinnedMsg.senderId !== webSocketUserId) {
        handleReadMessage(pinnedMsg.id);
      }
    }
  };

  const handleSendMessage = async () => {
    if (!messageInput.trim() || !token || !webSocketUserId) return;

    setIsSending(true);
    const newMessage = {
      id: `${Date.now()}-${webSocketUserId}-${otherUserId || groupId}-${messageInput}`,
      senderId: webSocketUserId,
      receiverId: otherUserId,
      groupId: groupId,
      content: messageInput,
      type: 'TEXT',
      createAt: new Date().toISOString(),
      read: false
    };

    try {
      // Gửi tin nhắn qua WebSocket
      const result = await sendMessage('/app/chat.send', newMessage, token);
      if (!result) {
        throw new Error('Không thể gửi tin nhắn: WebSocket không hoạt động');
      }
      
      // Không cần thêm tin nhắn vào state messages ở đây vì WebSocket sẽ nhận và thêm tin nhắn
      setMessageInput('');
    } catch (error) {
      Alert.alert('Lỗi', 'Không thể gửi tin nhắn: ' + error.message);
      navigation.goBack();
    } finally {
      setIsSending(false);
    }
  };

  const handleRecallMessage = async () => {
    if (!token || !webSocketUserId || !selectedMessage?.id) {
      Alert.alert('Lỗi', 'Không thể thu hồi tin nhắn');
      setModalVisible(false);
      return;
    }
    setIsSending(true);
    try {
      const success = await recallMessage(selectedMessage.id, webSocketUserId, token);
      if (success) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === selectedMessage.id
              ? { ...msg, recalled: true, content: 'Tin nhắn đã được thu hồi' }
              : msg
          )
        );
        setModalVisible(false);
        Alert.alert('Thành công', 'Tin nhắn đã được thu hồi!');
      } else {
        Alert.alert('Lỗi', 'Không thể thu hồi tin nhắn: WebSocket không hoạt động');
      }
    } catch (error) {
      console.error('Lỗi thu hồi tin nhắn:', error);
      Alert.alert('Lỗi', `Không thể thu hồi tin nhắn: ${error.message}`);
    } finally {
      setIsSending(false);
    }
  };

  const handleDeleteMessage = async () => {
    if (!token || !webSocketUserId || !selectedMessage?.id) {
      Alert.alert('Lỗi', 'Không thể xóa tin nhắn');
      setModalVisible(false);
      return;
    }
    setIsSending(true);
    try {
      const success = await deleteMessage(selectedMessage.id, webSocketUserId, token);
      if (success) {
        const deletedMessageIds = JSON.parse(await AsyncStorage.getItem('deletedMessageIds') || '[]');
        if (!deletedMessageIds.includes(selectedMessage.id)) {
          const updatedDeletedIds = [...deletedMessageIds, selectedMessage.id];
          await AsyncStorage.setItem('deletedMessageIds', JSON.stringify(updatedDeletedIds));
          setDeletedIds(updatedDeletedIds);
        }

        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === selectedMessage.id
              ? { ...msg, content: 'Tin nhắn đã bị xóa' }
              : msg
          )
        );
        setModalVisible(false);
        Alert.alert('Thành công', 'Tin nhắn đã được xóa!');
      } else {
        Alert.alert('Lỗi', 'Không thể xóa tin nhắn: WebSocket không hoạt động');
      }

    } catch (error) {
      console.error('Lỗi xóa tin nhắn:', error);
      Alert.alert('Lỗi', `Không thể xóa tin nhắn: ${error.message}`);
    } finally {
      setIsSending(false);
    }
  };

  const handleForwardMessage = async () => {
    if (!token || !webSocketUserId || !selectedMessage) {
      Alert.alert('Lỗi', 'Không thể chuyển tiếp tin nhắn');
      setModalVisible(false);
      return;
    }
    setModalVisible(false);
    setFriends([]);
    await fetchFriends();
    if (isGroupChat) {
      setMembers([]);
      await fetchMembers();
    }
    setFriendListModalVisible(true);
  };

  const handleSelectFriend = async (friend) => {
    if (!friend.id) {
      Alert.alert('Lỗi', 'Không thể chuyển tiếp: ID bạn bè không hợp lệ');
      return;
    }
    setIsSending(true);
    try {
      const success = await forwardMessage(
        selectedMessage.id,
        webSocketUserId,
        friend.id,
        null,
        selectedMessage.content,
        token
      );
      if (success) {
        setFriendListModalVisible(false);
        Alert.alert('Thành công', `Tin nhắn đã được chuyển tiếp đến ${friend.name}!`);
      } else {
        Alert.alert('Lỗi', 'Không thể chuyển tiếp tin nhắn: WebSocket không hoạt động');
      }
    } catch (error) {
      console.error('Lỗi chuyển tiếp tin nhắn:', error);
      Alert.alert('Lỗi', `Không thể chuyển tiếp tin nhắn: ${error.message}`);
    } finally {
      setIsSending(false);
    }
  };

  const handlePinMessage = async () => {
    if (!token || !webSocketUserId || !selectedMessage?.id) {
      Alert.alert('Lỗi', 'Không thể ghim tin nhắn');
      setModalVisible(false);
      return;
    }
    setIsSending(true);
    try {
      const request = {
        id: selectedMessage.id,
        senderId: webSocketUserId,
        otherUserId: otherUserId || null,
        groupId: groupId || null,
      };
      const destination = isGroupChat ? '/app/chat.pin.group' : '/app/chat.pin';
      const success = await sendMessage(destination, request, token);
      if (success) {
        setPinnedMessages((prev) => {
          if (!prev.some((msg) => msg.id === selectedMessage.id)) {
            saveLocalPinned({ ...selectedMessage, pinned: true });
            return [...prev, { ...selectedMessage, pinned: true }];
          }
          return prev;
        });
        setModalVisible(false);
        Alert.alert('Thành công', 'Tin nhắn đã được ghim!');
      } else {
        Alert.alert('Lỗi', 'Không thể ghim tin nhắn: WebSocket không hoạt động');
      }
    } catch (error) {
      console.error('Lỗi ghim tin nhắn:', error.response?.data || error.message);
      Alert.alert('Lỗi', `Không thể ghim tin nhắn: ${error.message}`);
    } finally {
      setIsSending(false);
    }
  };

  const handleUnpinMessage = async () => {
    if (!token || !webSocketUserId || !selectedMessage?.id) {
      Alert.alert('Lỗi', 'Không thể bỏ ghim tin nhắn');
      setModalVisible(false);
      return;
    }
    setIsSending(true);
    try {
      const request = {
        id: selectedMessage.id,
        senderId: webSocketUserId,
        otherUserId: otherUserId || null,
        groupId: groupId || null,
      };
      const destination = isGroupChat ? '/app/chat.unpin.group' : '/app/chat.unpin';
      const success = await sendMessage(destination, request, token);
      if (success) {
        setPinnedMessages((prev) => prev.filter((msg) => msg.id !== selectedMessage.id));
        removeLocalPinned(selectedMessage.id);
        setModalVisible(false);
        Alert.alert('Thành công', 'Tin nhắn đã được bỏ ghim!');
      } else {
        Alert.alert('Lỗi', 'Không thể bỏ ghim tin nhắn: WebSocket không hoạt động');
      }
    } catch (error) {
      console.error('Lỗi bỏ ghim tin nhắn:', error.response?.data || error.message);
      Alert.alert('Lỗi', `Không thể bỏ ghim tin nhắn: ${error.message}`);
    } finally {
      setIsSending(false);
    }
  };

  const handleReadMessage = async (messageId) => {
    if (!token || !webSocketUserId || !messageId) return;
    try {
      const request = {
        id: messageId,
        senderId: otherUserId || webSocketUserId,
        receiverId: webSocketUserId,
      };
      const destination = '/app/chat.read';
      const success = await sendMessage(destination, request, token);
      if (success) {
        setMessages((prev) =>
          prev.map((msg) => (msg.id === messageId ? { ...msg, read: true } : msg))
        );
      }
    } catch (error) {
      console.error('Lỗi đánh dấu tin nhắn đã đọc:', error);
    }
  };

  // Hàm xử lý chọn và gửi file tài liệu
  const handlePickDocument = async () => {
    if (!token) {
      Alert.alert('Lỗi', 'Vui lòng đăng nhập để gửi file');
      return;
    }
    if (!(otherUserId || groupId)) {
      Alert.alert('Lỗi', 'Không tìm thấy ID liên hệ hoặc nhóm');
      return;
    }
    if (isPickingDocument) return;
    setIsPickingDocument(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
        multiple: true,
      });
      if (result.canceled || !result.assets?.length) return;
      await handleFileUpload(result.assets);
    } catch (error) {
      Alert.alert('Lỗi', 'Không thể chọn file. Vui lòng thử lại.');
    } finally {
      setIsPickingDocument(false);
    }
  };

  // Hàm upload và gửi message sau khi upload file thành công
  const handleFileUpload = async (files) => {
    if (!files.length) return;
    setIsSending(true);
    try {
      const fileUrls = await uploadFile(
        files,
        otherUserId,
        token,
        groupId
      );
      fileUrls.forEach((url, idx) => {
        const file = files[idx];
        const contentType = file.type || '';
        let type = 'FILE';
        
        // Cải thiện việc phát hiện loại file
        if (contentType.startsWith('image/') || file.name?.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
          type = 'IMAGE';
        } else if (contentType.startsWith('video/') || file.name?.match(/\.(mp4|mov|avi|mkv)$/i)) {
          type = 'VIDEO';
        } else if (contentType.startsWith('audio/') || file.name?.match(/\.(mp3|wav|ogg)$/i)) {
          type = 'AUDIO';
        }

        const message = {
          id: `${Date.now()}-${webSocketUserId}-${otherUserId || groupId}-${url}`,
          senderId: webSocketUserId,
          ...(groupId ? { groupId } : { receiverId: otherUserId }),
          content: url,
          type,
          createAt: new Date().toISOString(),
          recalled: false,
          deletedByUsers: [],
          isRead: false,
          isPinned: false,
        };

        // Gửi message qua websocket
        sendMessage('/app/chat.send', message, token);
        
        // Thêm ngay vào UI với đúng type
        setMessages(prev => {
          if (prev.some(msg => msg.content === url)) return prev;
          return sortMessagesByTime([...prev, message]);
        });
      });
      Alert.alert('Thành công', 'File đã được gửi!');
    } catch (error) {
      console.error('Error uploading file:', error);
      Alert.alert('Lỗi gửi file', error.response?.data?.message || error.message);
    } finally {
      setIsSending(false);
    }
  };

  const handlePickImageOrVideo = async () => {
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Quyền truy cập bị từ chối',
          'Cần quyền truy cập thư viện ảnh để tiếp tục.',
          [
            { text: 'Hủy', style: 'cancel' },
            { text: 'Cài đặt', onPress: () => Linking.openSettings() },
          ]
        );
        return;
      }
      const { assets } = await MediaLibrary.getAssetsAsync({
        mediaType: ['photo'],
        first: 100,
        sortBy: ['creationTime'],
      });
      if (!assets || assets.length === 0) {
        Alert.alert('Thông báo', 'Không tìm thấy ảnh nào trong thư viện.');
        return;
      }
      // Copy tất cả ảnh về cache và chỉ giữ uri file://
      const processedAssets = await Promise.all(
        assets.map(async (asset) => {
          const assetInfo = await MediaLibrary.getAssetInfoAsync(asset.id);
          let localUri = assetInfo.localUri || assetInfo.uri;
          if (localUri && (localUri.startsWith('ph://') || localUri.startsWith('content://'))) {
            const fileName = assetInfo.filename || `image-${Date.now()}.jpg`;
            const destPath = FileSystem.cacheDirectory + fileName;
            await FileSystem.copyAsync({ from: localUri, to: destPath });
            localUri = destPath;
          }
          return {
            ...asset,
            uri: localUri, // Đảm bảo là file://
          };
        })
      );
      setAvailableImages(processedAssets);
      setImagePickerModalVisible(true);
    } catch (error) {
      console.error('Lỗi chi tiết khi chọn ảnh:', error);
      Alert.alert(
        'Lỗi',
        error.message || 'Đã xảy ra lỗi khi chọn ảnh. Vui lòng thử lại.',
        [
          { text: 'Thử lại', onPress: handlePickImageOrVideo },
          { text: 'Hủy', style: 'cancel' },
        ]
      );
    }
  };

  const handleImageSelect = (imageId) => {
    setSelectedImageIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(imageId)) {
        newSet.delete(imageId);
      } else {
        newSet.add(imageId);
      }
      return newSet;
    });
  };

  const handleSendSelectedImages = async () => {
    try {
      const selectedAssets = availableImages.filter(img => selectedImageIds.has(img.id));
      const processedImages = await Promise.all(
        selectedAssets.map(async (asset) => {
          try {
            const assetInfo = await MediaLibrary.getAssetInfoAsync(asset.id);
            let localUri = assetInfo.localUri || assetInfo.uri;
            if (localUri && (localUri.startsWith('ph://') || localUri.startsWith('content://'))) {
              const fileName = assetInfo.filename || `image-${Date.now()}.jpg`;
              const destPath = FileSystem.cacheDirectory + fileName;
              await FileSystem.copyAsync({ from: localUri, to: destPath });
              localUri = destPath;
            }
            return {
              uri: localUri,
              name: assetInfo.filename || `image-${Date.now()}.jpg`,
              type: 'image/jpeg',
            };
          } catch (error) {
            console.error('Lỗi khi xử lý ảnh:', error);
            return null;
          }
        })
      );
      const validImages = processedImages.filter(img => img !== null);
      if (validImages.length === 0) {
        throw new Error('Không thể xử lý ảnh đã chọn');
      }
      setImagePickerModalVisible(false);
      setSelectedImageIds(new Set());
      // Gửi luôn ảnh sau khi chọn
      await sendFiles(validImages);
    } catch (error) {
      console.error('Lỗi khi xử lý ảnh:', error);
      Alert.alert('Lỗi', 'Đã xảy ra lỗi khi xử lý ảnh.');
    }
  };

  const renderImageItem = ({ item }) => (
    <TouchableOpacity
      style={[
        styles.imageGridItem,
        selectedImageIds.has(item.id) && styles.selectedImageGridItem
      ]}
      onPress={() => handleImageSelect(item.id)}
    >
      {item.uri && item.uri.startsWith('file://') ? (
        <Image
          source={{ uri: item.uri }}
          style={styles.imageGridItemImage}
        />
      ) : (
        <View style={[styles.imageGridItemImage, { backgroundColor: '#eee', justifyContent: 'center', alignItems: 'center' }]}>
          <Text>Không xem được</Text>
        </View>
      )}
      {selectedImageIds.has(item.id) && (
        <View style={styles.imageCheckmark}>
          <Ionicons name="checkmark-circle" size={24} color="#0084ff" />
        </View>
      )}
    </TouchableOpacity>
  );

  const sendFiles = async (files) => {
    const latestToken = await getAccessToken();
    if (!latestToken) {
      Alert.alert('Lỗi', 'Vui lòng đăng nhập để gửi file.');
      return;
    }
    // Kiểm tra token có hợp lệ không
    try {
      const tokenPayload = JSON.parse(atob(latestToken.split('.')[1]));
      const expirationTime = tokenPayload.exp * 1000; // Convert to milliseconds
      if (Date.now() >= expirationTime) {
        Alert.alert('Phiên đăng nhập hết hạn', 'Vui lòng đăng nhập lại để tiếp tục.', [
          {
            text: 'Đăng nhập lại',
            onPress: () => navigation.navigate('Login'),
          },
        ]);
        return;
      }
    } catch (error) {
      console.error('Lỗi kiểm tra token:', error);
      Alert.alert('Lỗi xác thực', 'Vui lòng đăng nhập lại để tiếp tục.', [
        {
          text: 'Đăng nhập lại',
          onPress: () => navigation.navigate('Login'),
        },
      ]);
      return;
    }
    setIsSending(true);
    try {
      // Nếu là ảnh, nén lại trước khi upload và đổi tên file về .jpg.jpg.jpg
      const filesToUpload = await Promise.all(files.map(async (file) => {
        if (file.type && file.type.startsWith('image/')) {
          let format = 'jpeg';
          let name = file.name;

          name = name.replace(/\.(heic|HEIC|jpeg|JPEG|png|PNG|jpg|JPG)+$/gi, '') + '.jpg.jpg';
          const manipResult = await manipulateAsync(
            file.uri,
            [{ resize: { width: MAX_IMAGE_SIZE, height: MAX_IMAGE_SIZE } }],
            { compress: MAX_IMAGE_QUALITY, format }
          );
          return {
            uri: manipResult.uri,
            name,
            type: 'image/jpeg',
          };
        }
        return file;
      }));
      const totalFiles = filesToUpload.length;
      let completedFiles = 0;
      console.log('Token upload:', latestToken);
      const fileUrls = await uploadFile(filesToUpload, otherUserId, latestToken, groupId, (progress) => {
        // Nếu muốn progress thì xử lý ở đây
      });
      if (!Array.isArray(fileUrls)) {
        throw new Error('uploadFile không trả về mảng URL hợp lệ.');
      }

      // Thêm tin nhắn vào state messages ngay sau khi gửi thành công
      fileUrls.forEach((url, idx) => {
        const file = filesToUpload[idx];
        const contentType = file.type || '';
        let type = 'FILE';
        if (contentType.startsWith('image/')) type = 'IMAGE';
        else if (contentType.startsWith('video/')) type = 'VIDEO';
        else if (contentType.startsWith('audio/')) type = 'AUDIO';
        
        const message = {
          senderId: webSocketUserId,
          ...(groupId ? { groupId } : { receiverId: otherUserId }),
          content: url,
          type,
          createAt: new Date().toISOString(),
          recalled: false,
          deletedByUsers: [],
          isRead: false,
          isPinned: false,
        };
        
        // Thêm vào state messages
        setMessages(prev => {
          if (prev.some(msg => msg.content === url)) return prev;
          return [...prev, message];
        });
      });

      setImagePickerModalVisible(false);
      setSelectedImageIds(new Set());
      Alert.alert('Thành công', 'File đã được gửi thành công!');
    } catch (error) {
      console.error('Lỗi gửi file:', error);
      let errorMessage = 'Không thể gửi file. ';
      if (error.response) {
        switch (error.response.status) {
          case 401:
          case 403:
            errorMessage += 'Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.';
            break;
          case 413:
            errorMessage += 'File quá lớn. Vui lòng chọn file nhỏ hơn.';
            break;
          default:
            errorMessage += error.response.data?.message || 'Vui lòng thử lại sau.';
        }
      } else if (error.request) {
        errorMessage += 'Không thể kết nối đến server. Vui lòng kiểm tra kết nối mạng.';
      } else {
        errorMessage += error.message || 'Vui lòng thử lại sau.';
      }
      Alert.alert(
        'Lỗi',
        errorMessage,
        [
          {
            text: 'Thử lại',
            onPress: () => sendFiles(files),
          },
          {
            text: 'Hủy',
            style: 'cancel',
            onPress: () => {
              setImagePickerModalVisible(false);
              setSelectedImageIds(new Set());
            },
          },
        ]
      );
    } finally {
      setIsSending(false);
    }
  };

  useEffect(() => {
    if (scrollViewRef.current) {
      scrollViewRef.current.scrollToEnd({ animated: true });
    }
  }, [messages]);

  const formatTime = (timestamp) => {
    if (!timestamp) return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const date = new Date(timestamp);
    return isNaN(date.getTime()) ? new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const renderFriendItem = ({ item }) => (
    <TouchableOpacity
      style={styles.friendItem}
      onPress={() => handleSelectFriend(item)}
      disabled={isSending}
    >
      <Image
        source={{ uri: item.avatar }}
        style={styles.friendAvatar}
        defaultSource={{ uri: 'https://randomuser.me/api/portraits/lego/1.jpg' }}
      />
      <Text style={styles.friendName}>{item.name}</Text>
    </TouchableOpacity>
  );

  const renderMessageItem = (message, index) => {
    const isSender = message.senderId === webSocketUserId;
    const senderName = userNames[message.originalSenderId || message.senderId] || 'Người dùng không tên';
    const isHighlighted = message.id === highlightedMessageId;
    const isPinned = pinnedMessages.some((pinnedMsg) => pinnedMsg.id === message.id);

    return (
      <TouchableOpacity
        key={message.id || `${message.createAt}-${index}`}
        style={[
          styles.messageContainer,
          isSender ? styles.messageContainerSender : styles.messageContainerReceiver,
        ]}
        onLongPress={() => {
          if (isSender && !message.recalled && message.content !== 'Tin nhắn đã bị xóa') {
            setSelectedMessage(message);
            setModalVisible(true);
          } else if (isPinned) {
            setSelectedMessage(message);
            setModalVisible(true);
          } else {
            Alert.alert('Lỗi', 'Bạn chỉ có thể thu hồi/xóa tin nhắn của mình và chưa bị thu hồi/xóa, hoặc bỏ ghim tin nhắn được ghim.');
          }
        }}
      >
        <View style={[styles.messageBubble, isSender ? styles.senderBubble : styles.receiverBubble]}>
          {message.recalled ? (
            <Text style={styles.italicText}>Tin nhắn đã được thu hồi</Text>
          ) : message.content === 'Tin nhắn đã bị xóa' ? (
            <Text style={styles.italicText}>Tin nhắn đã bị xóa</Text>
          ) : (
            <>
              {/* Hiển thị tên người gửi nếu là nhóm và không phải người gửi */}
              {isGroupChat && !isSender && (
                <Text style={styles.senderName}>{senderName}</Text>
              )}

              {/* Hiển thị nội dung theo loại */}
              {message.type === 'TEXT' && (
                <Text style={[isSender ? styles.senderText : styles.receiverText, isHighlighted && styles.highlightedText]}>
                  {message.content}
                </Text>
              )}

              {message.type === 'IMAGE' && message.content && (
                (() => {
                  console.log('message.content:', message.content);
                  console.log('API_BASE_URL:', API_BASE_URL);
                  return (
                    <Image
                      source={{
                        uri:
                          (typeof message.content === 'string' && message.content.startsWith('http'))
                            ? message.content
                            : `${API_BASE_URL.replace('/message', '')}${message.content || ''}`
                      }}
                      style={{ width: 200, height: 200, borderRadius: 8 }}
                    />
                  );
                })()
              )}

              {message.type === 'VIDEO' && (
                <Text style={styles.italicText}>Phát video không được hỗ trợ trong bản demo này</Text>
              )}

              {message.type === 'FORWARD' && (
                <View>
                  <Text style={styles.italicText}>Chuyển tiếp từ {senderName}</Text>
                  <Text style={[isSender ? styles.senderText : styles.receiverText, isHighlighted && styles.highlightedText]}>
                    {message.content}
                  </Text>
                </View>
              )}

              {message.type === 'FILE' && message.content && (
                <Text
                  style={[styles.fileLink, isHighlighted && styles.highlightedText]}
                  onPress={() => {
                    const fileUrl = (typeof message.content === 'string' && message.content.startsWith('http'))
                      ? message.content
                      : `${API_BASE_URL.replace('/message', '')}${message.content}`;
                    
                    console.log('Opening file URL:', fileUrl);
                    Linking.openURL(fileUrl).catch((error) => {
                      console.error('Error opening file:', error);
                      Alert.alert('Lỗi', 'Không thể mở file. Vui lòng thử lại sau.');
                    });
                  }}
                >
                  {(typeof message.content === 'string')
                    ? message.content.split('/').pop()
                    : 'File đính kèm'}
                </Text>
              )}

              {/* Fallback nếu không có loại nào khớp */}
              {!['TEXT', 'IMAGE', 'VIDEO', 'FORWARD', 'FILE'].includes(message.type) && (
                <Text style={[styles.receiverText, isHighlighted && styles.highlightedText]}>
                  {message.content}
                </Text>
              )}

              {/* Dấu chấm chưa đọc */}
              {!message.read && !isSender && (
                <Text style={styles.unreadDot}>•</Text>
              )}
            </>
          )}

          {/* Thời gian tin nhắn */}
          <Text style={styles.messageTime}>{formatTime(message.createAt)}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderPinnedMessageItem = ({ item }) => (
    <TouchableOpacity
      style={styles.pinnedItem}
      onPress={() => handlePinnedMessagePress(item)}
    >
      <View style={{ flex: 1 }}>
        <Text style={styles.pinnedText}>{item.content}</Text>
        <Text style={styles.pinnedTime}>{formatTime(item.createAt)}</Text>
      </View>
    </TouchableOpacity>
  );

  const handleCreateGroup = async () => {
    try {
      setIsLoading(true);
      if (!groupName.trim()) {
        showNotification('Vui lòng nhập tên nhóm', 'error');
        return;
      }
      if (selectedGroupMembers.length < 2) {
        showNotification('Vui lòng chọn ít nhất 2 thành viên', 'error');
        return;
      }

      const token = await getAccessToken();
      if (!token) {
        showNotification('Không tìm thấy thông tin đăng nhập. Vui lòng đăng nhập lại.', 'error');
        navigation.navigate('Login');
        return;
      }

      let memberIds = selectedGroupMembers.map(member => member.id).filter(Boolean);
      if (webSocketUserId && !memberIds.includes(webSocketUserId)) {
        memberIds.push(webSocketUserId);
      }

      if (memberIds.length < 2) {
        showNotification('Danh sách thành viên không hợp lệ!', 'error');
        return;
      }

      if (memberIds.some(id => !id)) {
        showNotification('Có thành viên không hợp lệ!', 'error');
        return;
      }

      const groupRequest = {
        name: groupName,
        memberIds,
      };

      const response = await createGroup(groupRequest);
      if (response) {
        showNotification('Tạo nhóm thành công');
        setShowGroupModal(false);
        setGroupName('');
        setSelectedGroupMembers([]);
      }
    } catch (error) {
      console.error('Error creating group:', error);
      showNotification(error.message || 'Không thể tạo nhóm. Vui lòng thử lại sau.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectGroupMember = (member) => {
    setSelectedGroupMembers(prev => {
      const isSelected = prev.some(m => m.id === member.id);
      if (isSelected) {
        return prev.filter(m => m.id !== member.id);
      } else {
        return [...prev, member];
      }
    });
  };

  const handleAddMember = async (userId) => {
    if (!userId) return;
    try {
      await addGroupMembers(groupId, [userId], token);
      await assignGroupRole(groupId, userId, 'MEMBER', token); // gán role MEMBER
      // Cập nhật lại danh sách thành viên
      await loadMembers();
      showNotification('Thêm thành viên và gán quyền thành công!', 'success');
      // Đóng modal thêm thành viên
      setShowAddMemberModal(false);
    } catch (error) {
      console.error('Failed to add or assign role:', error);
      showNotification('Không thể thêm thành viên hoặc gán quyền.', 'error');
    }
  };

  const handleRemoveMember = async (userId) => {
    try {
      await removeGroupMember(groupId, userId, token);
      // Cập nhật lại danh sách thành viên
      await loadMembers();
      showNotification('Đã xóa thành viên khỏi nhóm', 'success');
      // Đóng modal xóa thành viên
      setShowRemoveMemberModal(false);
    } catch (error) {
      console.error('Failed to remove member:', error);
      showNotification('Không thể xóa thành viên.', 'error');
    }
  };

  const handleChangeMemberRole = async (userId, newRole) => {
    try {
      await assignGroupRole(groupId, userId, newRole, token);
      loadMembers();
      showNotification('Đã đổi quyền thành viên', 'success');
    } catch (error) {
      console.error('Failed to change member role:', error);
      showNotification('Không thể đổi quyền.', 'error');
    }
  };

  const handleLeaveGroup = async () => {
    try {
      setIsLoading(true);
      const token = await getAccessToken();
      if (!token) {
        showNotification('Không tìm thấy thông tin đăng nhập. Vui lòng đăng nhập lại.', 'error');
        navigation.navigate('Login');
        return;
      }

      // Kiểm tra xem người dùng có phải là thành viên của nhóm không
      const isMember = members.some(member => member.id === webSocketUserId);
      if (!isMember) {
        showNotification('Bạn không phải là thành viên của nhóm này.', 'error');
        return;
      }

      // Kiểm tra xem người dùng có phải là người tạo nhóm không
      const isCreator = groupInfo.createId === webSocketUserId;
      if (isCreator) {
        showNotification('Bạn là người tạo nhóm. Vui lòng giải tán nhóm thay vì rời nhóm.', 'error');
        return;
      }

      Alert.alert(
        'Xác nhận',
        'Bạn có chắc chắn muốn rời khỏi nhóm này?',
        [
          {
            text: 'Hủy',
            style: 'cancel'
          },
          {
            text: 'Rời nhóm',
            style: 'destructive',
            onPress: async () => {
              try {
                // Sử dụng hàm removeGroupMember từ groupApi
                await removeGroupMember(groupInfo.id, webSocketUserId, token);

                showNotification('Bạn đã rời khỏi nhóm');
                setShowGroupSettingsModal(false);
                navigation.goBack();
              } catch (error) {
                console.error('Error leaving group:', error);
                if (error.response?.status === 401) {
                  showNotification('Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.', 'error');
                  navigation.navigate('Login');
                } else if (error.response?.status === 403) {
                  showNotification('Bạn không có quyền rời khỏi nhóm này.', 'error');
                } else {
                  showNotification('Không thể rời khỏi nhóm. Vui lòng thử lại sau.', 'error');
                }
              }
            }
          }
        ]
      );
    } catch (error) {
      console.error('Error in handleLeaveGroup:', error);
      showNotification('Đã xảy ra lỗi. Vui lòng thử lại sau.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Add this function to scroll to bottom
  const scrollToBottom = () => {
    if (flatListRef.current && messages.length > 0) {
      flatListRef.current.scrollToEnd({ animated: true });
    }
  };

  // Add useEffect to scroll when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Utility functions
  const showNotification = (message, type = 'success') => {
    Alert.alert(
      type === 'success' ? 'Thành công' : 'Lỗi',
      message
    );
  };

  const checkAdminRole = useCallback(() => {
    if (isGroupChat && groupInfo?.roles) {
      const isUserAdmin = groupInfo.roles[webSocketUserId] === 'ADMIN';
      setIsAdmin(isUserAdmin);
      setGroupRoles(groupInfo.roles);
    }
  }, [isGroupChat, groupInfo, webSocketUserId]);

  useEffect(() => {
    checkAdminRole();
  }, [checkAdminRole]);

  const loadMembers = async () => {
    try {
      const fetchedMembers = await fetchGroupMembers(groupId, token);
      setMembers(fetchedMembers);
    } catch (error) {
      console.error('Failed to load members:', error);
      // Có thể showNotification hoặc Alert ở đây nếu muốn
    }
  };

  if (!chatPartner || !chatPartner.id || !chatPartner.name || !chatPartner.avatar) {
    return (
      <View style={styles.noContactContainer}>
        <Text style={styles.noContactText}>Thông tin liên hệ không hợp lệ</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoidingContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={90}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="black" />
          </TouchableOpacity>
          <Image source={{ uri: chatPartner.avatar }} style={styles.avatar} />
          <View style={styles.contactInfo}>
            <Text style={styles.contactName}>{chatPartner.name}</Text>
            <Text style={styles.contactStatus}>
              {isGroupChat ? `${members.length} thành viên` : (friendInfo.status === 'online' ? 'Online' : 'Offline')}
            </Text>
          </View>
          <TouchableOpacity style={styles.iconButton} onPress={() => setSearchModalVisible(true)}>
            <Ionicons name="search" size={24} color="black" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconButton} onPress={() => setPinnedModalVisible(true)}>
            <Ionicons name="pin" size={24} color="black" />
          </TouchableOpacity>
          {/* Chỉ hiển thị các nút này nếu KHÔNG phải group chat */}
          {!isGroupChat && (
            <>
              <TouchableOpacity style={styles.iconButton}>
                <Ionicons name="call" size={24} color="black" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.iconButton}>
                <Ionicons name="videocam" size={24} color="black" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.iconButton}
                onPress={() => {
                  Alert.alert(
                    'Tùy chọn',
                    'Chọn hành động',
                    [
                      {
                        text: 'Tạo nhóm chat',
                        onPress: () => {
                          setFriends([]);
                          fetchFriends();
                          setShowGroupModal(true);
                        }
                      },
                      {
                        text: 'Hủy',
                        style: 'cancel'
                      }
                    ]
                  );
                }}
              >
                <MaterialCommunityIcons name="dots-vertical" size={24} color="black" />
              </TouchableOpacity>
            </>
          )}
          {isGroupChat && (
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => setShowGroupSettingsModal(true)}
            >
              <Ionicons name="settings-outline" size={24} color="black" />
            </TouchableOpacity>
          )}
        </View>

        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={({ item, index }) => renderMessageItem(item, index)}
          keyExtractor={(item, index) => item.id || `${item.createAt}-${index}`}
          style={styles.messageList}
          onContentSizeChange={scrollToBottom}
          onLayout={scrollToBottom}
          ListEmptyComponent={
            isLoadingChat ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#0084ff" />
                <Text style={styles.loadingText}>Đang tải tin nhắn...</Text>
              </View>
            ) : (
              <Text style={styles.noMessagesText}>Chưa có tin nhắn nào</Text>
            )
          }
          ListFooterComponent={
            <View style={{ height: 20 }} /> // Add some padding at bottom
          }
        />

        {pinnedModalVisible && pinnedMessages.length > 0 && (
          <Modal
            transparent={true}
            visible={pinnedModalVisible}
            onRequestClose={() => setPinnedModalVisible(false)}
          >
            <Pressable style={styles.pinnedModalOverlay} onPress={() => setPinnedModalVisible(false)}>
              <View style={styles.pinnedModalContent}>
                <FlatList
                  data={pinnedMessages}
                  renderItem={renderPinnedMessageItem}
                  keyExtractor={(item) => item.id.toString()}
                  style={styles.pinnedList}
                />
              </View>
            </Pressable>
          </Modal>
        )}

        <View style={styles.inputContainer}>
          <TouchableOpacity style={styles.iconButton} onPress={() => setShowEmojiPicker(prev => !prev)}>
            <Ionicons name={showEmojiPicker ? 'close' : 'happy-outline'} size={24} color="gray" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.iconButton} onPress={() => setUploadModalVisible(true)}>
            <Ionicons name="attach" size={24} color="gray" />
          </TouchableOpacity>

          <TextInput
            style={styles.input}
            placeholder="Nhập tin nhắn"
            value={messageInput}
            onChangeText={setMessageInput}
            onSubmitEditing={handleSendMessage}
            returnKeyType="send"
            editable={!isSending}
          />
          <TouchableOpacity onPress={handleSendMessage} style={styles.iconButton} disabled={isSending}>
            <Ionicons name="send" size={24} color={messageInput.trim() && !isSending ? 'blue' : 'gray'} />
          </TouchableOpacity>
        </View>{showEmojiPicker && (
          <EmojiSelector
            onEmojiSelected={(emoji) => setMessageInput(prev => prev + emoji)}
            showSearchBar={false}
            showTabs={true}
            showSectionTitles={false}
            category={Categories.all}
            columns={8}
            style={{ height: 250 }}
          />
        )}


        <Modal
          animationType="fade"
          transparent={true}
          visible={modalVisible}
          onRequestClose={() => setModalVisible(false)}
        >
          <Pressable style={styles.modalOverlay} onPress={() => setModalVisible(false)}>
            <View style={styles.modalContent}>
              {pinnedMessages.some((msg) => msg.id === selectedMessage?.id) ? (
                <TouchableOpacity style={styles.modalOption} onPress={handleUnpinMessage} disabled={isSending}>
                  <Ionicons name="pin-outline" size={20} color="#000" />
                  <Text style={styles.modalText}>Bỏ ghim tin nhắn</Text>
                </TouchableOpacity>
              ) : (
                <>
                  <TouchableOpacity style={styles.modalOption} onPress={handleRecallMessage} disabled={isSending}>
                    <Ionicons name="refresh" size={20} color="#000" />
                    <Text style={styles.modalText}>Thu hồi tin nhắn</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.modalOption} onPress={handleDeleteMessage} disabled={isSending}>
                    <Ionicons name="trash" size={20} color="#000" />
                    <Text style={styles.modalText}>Xóa tin nhắn</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.modalOption} onPress={handleForwardMessage} disabled={isSending}>
                    <Ionicons name="share" size={20} color="#000" />
                    <Text style={styles.modalText}>Chuyển tiếp tin nhắn</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.modalOption} onPress={handlePinMessage} disabled={isSending}>
                    <Ionicons name="pin" size={20} color="#000" />
                    <Text style={styles.modalText}>Ghim tin nhắn</Text>
                  </TouchableOpacity>
                </>
              )}
              <TouchableOpacity style={[styles.modalOption, styles.cancelOption]} onPress={() => setModalVisible(false)}>
                <Text style={styles.modalText}>Hủy</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Modal>

        <Modal
          animationType="slide"
          transparent={true}
          visible={friendListModalVisible}
          onRequestClose={() => setFriendListModalVisible(false)}
        >
          <View style={styles.friendListModalContainer}>
            <View style={styles.friendListModalContent}>
              <View style={styles.friendListHeader}>
                <Text style={styles.friendListTitle}>Chọn bạn bè để chuyển tiếp</Text>
                <TouchableOpacity onPress={() => setFriendListModalVisible(false)}>
                  <Ionicons name="close" size={24} color="black" />
                </TouchableOpacity>
              </View>
              {isLoadingFriends || (isGroupChat && isLoadingMembers) ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="#0084ff" />
                  <Text style={styles.loadingText}>Đang tải danh sách...</Text>
                </View>
              ) : friends.length === 0 && (!isGroupChat || members.length === 0) ? (
                <Text style={styles.noFriendsText}>Không có bạn bè hoặc thành viên nào để hiển thị</Text>
              ) : (
                <FlatList
                  data={[...friends, ...(isGroupChat ? members.filter((member, idx, arr) => idx === arr.findIndex(m => m.id === member.id)) : [])]}
                  renderItem={renderFriendItem}
                  keyExtractor={(item, index) => `friendlist-${item.id}-${index}`}
                  style={styles.friendList}
                  showsVerticalScrollIndicator={true}
                />
              )}
            </View>
          </View>
        </Modal>

        <Modal
          animationType="slide"
          transparent={true}
          visible={searchModalVisible}
          onRequestClose={() => setSearchModalVisible(false)}
        >
          <View style={styles.friendListModalContainer}>
            <View style={styles.friendListModalContent}>
              <View style={styles.friendListHeader}>
                <Text style={styles.friendListTitle}>Tìm kiếm tin nhắn</Text>
                <TouchableOpacity onPress={() => setSearchModalVisible(false)}>
                  <Ionicons name="close" size={24} color="black" />
                </TouchableOpacity>
              </View>
              <View style={styles.searchContainer}>
                <TextInput
                  style={styles.searchInput}
                  placeholder="Nhập từ khóa tìm kiếm"
                  value={searchInput}
                  onChangeText={setSearchInput}
                  onSubmitEditing={handleSearchMessages}
                  returnKeyType="search"
                />
                <TouchableOpacity onPress={handleSearchMessages} style={styles.iconButton}>
                  <Ionicons name="search" size={24} color="black" />
                </TouchableOpacity>
              </View>
              {/* Hiển thị kết quả tìm kiếm */}
              {searchResults.length > 0 && (
                <ScrollView style={{ maxHeight: 300, marginTop: 10 }}>
                  {searchResults.map((result) => (
                    <TouchableOpacity
                      key={result.id}
                      style={{ paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#eee' }}
                      onPress={() => {
                        setSearchModalVisible(false);
                        setHighlightedMessageId(result.id);
                        // Tự động scroll đến tin nhắn
                        setTimeout(() => {
                          if (flatListRef.current) {
                            flatListRef.current.scrollToIndex({
                              index: result.msgIndex,
                              animated: true,
                              viewPosition: 0.5
                            });
                          }
                        }, 100);
                      }}
                    >
                      <Text style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>
                        {result.senderName} • {formatTime(result.createAt)}
                      </Text>
                      <Text style={{ fontSize: 14, backgroundColor: '#ffff99' }}>
                        {result.content}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
            </View>
          </View>
        </Modal>

        <Modal
          transparent={true}
          visible={uploadModalVisible}
          animationType="fade"
          onRequestClose={() => setUploadModalVisible(false)}
        >
          <Pressable style={styles.modalOverlay} onPress={() => setUploadModalVisible(false)}>
            <View style={styles.modalContent}>
              <TouchableOpacity
                style={styles.modalOption}
                onPress={() => {
                  setUploadModalVisible(false);
                  handlePickImageOrVideo();
                }}
              >
                <Ionicons name="image-outline" size={20} color="#000" />
                <Text style={styles.modalText}>Gửi ảnh / video</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalOption}
                onPress={handlePickDocument}
                disabled={isPickingDocument}
              >
                <Ionicons name="document-outline" size={20} color="#000" />
                <Text style={styles.modalText}>Gửi file tài liệu</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Modal>

        <Modal
          visible={imagePickerModalVisible}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setImagePickerModalVisible(false)}
        >
          <View style={styles.imagePickerModalContainer}>
            <View style={styles.imagePickerModalContent}>
              <View style={styles.imagePickerHeader}>
                <Text style={styles.imagePickerTitle}>Chọn ảnh</Text>
                <TouchableOpacity
                  onPress={() => {
                    setImagePickerModalVisible(false);
                    setSelectedImageIds(new Set());
                  }}
                >
                  <Ionicons name="close" size={24} color="black" />
                </TouchableOpacity>
              </View>

              <FlatList
                data={availableImages}
                renderItem={renderImageItem}
                keyExtractor={item => item.id}
                numColumns={3}
                style={styles.imageGrid}
              />

              <View style={styles.imagePickerFooter}>
                <Text style={styles.selectedCount}>
                  Đã chọn: {selectedImageIds.size} ảnh
                </Text>
                <TouchableOpacity
                  style={[
                    styles.sendButton,
                    selectedImageIds.size === 0 && styles.sendButtonDisabled
                  ]}
                  onPress={handleSendSelectedImages}
                  disabled={selectedImageIds.size === 0}
                >
                  <Text style={styles.sendButtonText}>Gửi</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        <Modal
          visible={showGroupModal}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowGroupModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.groupModalContent}>
              <View style={styles.groupModalHeader}>
                <Text style={styles.groupModalTitle}>Tạo nhóm chat mới</Text>
                <TouchableOpacity onPress={() => setShowGroupModal(false)}>
                  <Ionicons name="close" size={24} color="black" />
                </TouchableOpacity>
              </View>

              <TextInput
                style={styles.groupNameInput}
                placeholder="Nhập tên nhóm"
                value={groupName}
                onChangeText={setGroupName}
              />

              <Text style={styles.memberSelectionTitle}>Chọn thành viên</Text>
              <Text style={styles.memberCount}>
                Đã chọn: {selectedGroupMembers.length} thành viên
              </Text>

              {isLoadingFriends ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="#0084ff" />
                  <Text style={styles.loadingText}>Đang tải danh sách bạn bè...</Text>
                </View>
              ) : (
                <FlatList
                  data={friends.filter((friend, idx, arr) => idx === arr.findIndex(f => f.id === friend.id))}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={[
                        styles.memberItem,
                        selectedGroupMembers.some(m => m.id === item.id) && styles.selectedMemberItem
                      ]}
                      onPress={() => handleSelectGroupMember(item)}
                    >
                      <Image
                        source={{ uri: item.avatar }}
                        style={styles.memberAvatar}
                        defaultSource={{ uri: 'https://randomuser.me/api/portraits/lego/1.jpg' }}
                      />
                      <Text style={styles.memberName}>{item.name}</Text>
                      {selectedGroupMembers.some(m => m.id === item.id) && (
                        <Ionicons name="checkmark-circle" size={24} color="#0084ff" />
                      )}
                    </TouchableOpacity>
                  )}
                  keyExtractor={(item, index) => `creategroup-${item.id}-${index}`}
                  style={styles.memberList}
                />
              )}

              <TouchableOpacity
                style={[
                  styles.createGroupButton,
                  (!groupName.trim() || selectedGroupMembers.length < 2) && styles.createGroupButtonDisabled
                ]}
                onPress={handleCreateGroup}
                disabled={!groupName.trim() || selectedGroupMembers.length < 2 || isSending}
              >
                <Text style={styles.createGroupButtonText}>
                  {isSending ? 'Đang tạo...' : 'Tạo nhóm'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Group Settings Modal */}
        <Modal
          visible={showGroupSettingsModal}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowGroupSettingsModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.groupModalContent}>
              <View style={styles.groupModalHeader}>
                <Text style={styles.groupModalTitle}>Cài đặt nhóm</Text>
                <TouchableOpacity onPress={() => setShowGroupSettingsModal(false)}>
                  <Ionicons name="close" size={24} color="black" />
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.groupSettingOption}
                onPress={() => {
                  setShowGroupSettingsModal(false);
                  setShowAddMemberModal(true);
                }}
                disabled={isLoading}
              >
                <Ionicons name="person-add" size={24} color="black" />
                <Text style={styles.groupSettingText}>Thêm thành viên</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.groupSettingOption}
                onPress={() => {
                  setShowGroupSettingsModal(false);
                  setShowRemoveMemberModal(true);
                }}
                disabled={isLoading}
              >
                <Ionicons name="person-remove" size={24} color="black" />
                <Text style={styles.groupSettingText}>Xóa thành viên</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.groupSettingOption, styles.leaveGroupOption]}
                onPress={() => {
                  Alert.alert(
                    'Xác nhận',
                    'Bạn có chắc chắn muốn giải tán nhóm này? Tất cả thành viên sẽ bị xóa khỏi nhóm.',
                    [
                      { text: 'Hủy', style: 'cancel' },
                      {
                        text: 'Giải tán',
                        style: 'destructive',
                        onPress: async () => {
                          try {
                            setIsLoading(true);
                            const token = await getAccessToken();
                            await dissolveGroup(groupId, token);
                            showNotification('Nhóm đã được giải tán.');
                            setShowGroupSettingsModal(false);
                            navigation.goBack();
                          } catch (error) {
                            showNotification(error.message || 'Không thể giải tán nhóm.', 'error');
                          } finally {
                            setIsLoading(false);
                          }
                        }
                      }
                    ]
                  );
                }}
                disabled={isLoading}
              >
                <Ionicons name="trash" size={24} color="red" />
                <Text style={[styles.groupSettingText, styles.leaveGroupText]}>Giải tán nhóm</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.groupSettingOption, styles.leaveGroupOption]}
                onPress={handleLeaveGroup}
                disabled={isLoading}
              >
                <Ionicons name="exit-outline" size={24} color="red" />
                <Text style={[styles.groupSettingText, styles.leaveGroupText]}>Rời nhóm</Text>
              </TouchableOpacity>

              {isLoading && (
                <View style={styles.loadingOverlay}>
                  <ActivityIndicator size="large" color="#0084ff" />
                  <Text style={styles.loadingText}>Đang xử lý...</Text>
                </View>
              )}
            </View>
          </View>
        </Modal>

        {/* Add Member Modal */}
        <Modal
          visible={showAddMemberModal}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowAddMemberModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.groupModalContent}>
              <View style={styles.groupModalHeader}>
                <Text style={styles.groupModalTitle}>Thêm thành viên</Text>
                <TouchableOpacity onPress={() => setShowAddMemberModal(false)}>
                  <Ionicons name="close" size={24} color="black" />
                </TouchableOpacity>
              </View>

              <FlatList
                data={friends.filter(friend => !members.some(member => member.id === friend.id)).filter((friend, idx, arr) => idx === arr.findIndex(f => f.id === friend.id))}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.memberItem}
                    onPress={() => handleAddMember(item.id)}
                  >
                    <Image
                      source={{ uri: item.avatar }}
                      style={styles.memberAvatar}
                      defaultSource={{ uri: 'https://randomuser.me/api/portraits/lego/1.jpg' }}
                    />
                    <Text style={styles.memberName}>{item.name}</Text>
                  </TouchableOpacity>
                )}
                keyExtractor={(item, index) => `addmember-${item.id}-${index}`}
                style={styles.memberList}
              />
            </View>
          </View>
        </Modal>

        {/* Remove Member Modal */}
        <Modal
          visible={showRemoveMemberModal}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowRemoveMemberModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.groupModalContent}>
              <View style={styles.groupModalHeader}>
                <Text style={styles.groupModalTitle}>Xóa thành viên</Text>
                <TouchableOpacity onPress={() => setShowRemoveMemberModal(false)}>
                  <Ionicons name="close" size={24} color="black" />
                </TouchableOpacity>
              </View>

              <FlatList
                data={members.filter(member => member.id !== webSocketUserId).filter((member, idx, arr) => idx === arr.findIndex(m => m.id === member.id))}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.memberItem}
                    onPress={() => {
                      Alert.alert(
                        'Xác nhận',
                        `Bạn có chắc chắn muốn xóa ${item.name} khỏi nhóm?`,
                        [
                          { text: 'Hủy', style: 'cancel' },
                          { text: 'Xóa', style: 'destructive', onPress: () => handleRemoveMember(item.id) }
                        ]
                      );
                    }}
                  >
                    <Image
                      source={{ uri: item.avatar }}
                      style={styles.memberAvatar}
                      defaultSource={{ uri: 'https://randomuser.me/api/portraits/lego/1.jpg' }}
                    />
                    <Text style={styles.memberName}>{item.name}</Text>
                  </TouchableOpacity>
                )}
                keyExtractor={(item, index) => `removemember-${item.id}-${index}`}
                style={styles.memberList}
              />
            </View>
          </View>
        </Modal>

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  keyboardAvoidingContainer: { flex: 1 },
  noContactContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  noContactText: { fontSize: 16, color: 'gray' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    paddingTop: 10,
    borderBottomWidth: 1,
    borderColor: '#ccc',
    backgroundColor: 'white',
  },
  avatar: { width: 40, height: 40, borderRadius: 20, marginLeft: 10 },
  contactInfo: { marginLeft: 10, flex: 1 },
  contactName: { fontSize: 16, fontWeight: 'bold' },
  contactStatus: { fontSize: 12, color: 'gray' },
  iconButton: { marginHorizontal: 5 },
  messageList: {
    flex: 1,
    padding: 10,
    paddingTop: 20,
  },
  messageContainer: { marginVertical: 5, flexDirection: 'row' },
  messageContainerSender: { justifyContent: 'flex-end' },
  messageContainerReceiver: { justifyContent: 'flex-start' },
  messageBubble: { maxWidth: '80%', padding: 10, borderRadius: 15, position: 'relative' },
  senderBubble: { backgroundColor: '#0084ff', alignSelf: 'flex-end' },
  receiverBubble: { backgroundColor: '#e5e5ea', alignSelf: 'flex-start' },
  senderText: { color: '#fff' },
  receiverText: { color: '#000' },
  highlightedText: { backgroundColor: '#ffff99', color: '#000' },
  senderName: { fontSize: 12, color: '#666', fontWeight: 'bold' },
  italicText: { fontStyle: 'italic', color: '#666' },
  messageTime: { fontSize: 10, color: '#ccc', textAlign: 'right', marginTop: 5 },
  media: { width: 200, height: 200, borderRadius: 8 },
  fileLink: { color: 'blue', textDecorationLine: 'underline' },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderColor: '#ccc',
  },
  input: {
    flex: 1,
    paddingHorizontal: 10,
    height: 40,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 20,
    backgroundColor: '#fff',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderColor: '#ccc',
  },
  searchInput: {
    flex: 1,
    paddingHorizontal: 10,
    height: 40,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 20,
    backgroundColor: '#fff',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: { backgroundColor: 'white', borderRadius: 10, padding: 10, width: '80%' },
  modalOption: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  cancelOption: { borderTopWidth: 1, borderColor: '#ccc', marginTop: 10, paddingTop: 10 },
  modalText: { marginLeft: 10, fontSize: 16 },
  friendListModalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  friendListModalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  friendListHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  friendListTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  friendList: {
    flexGrow: 0,
  },
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  friendAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 15,
  },
  friendName: {
    fontSize: 16,
    color: '#333',
  },
  noMessagesText: { fontSize: 16, color: 'gray', textAlign: 'center', marginTop: 20 },
  noFriendsText: { fontSize: 16, color: 'gray', textAlign: 'center', marginTop: 20 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 20 },
  loadingText: { marginTop: 10, fontSize: 16, color: 'gray' },
  unreadDot: {
    color: 'red',
    fontSize: 12,
    position: 'absolute',
    top: 5,
    left: 5,
  },
  pinnedModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 50,
  },
  pinnedModalContent: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 10,
    width: '80%',
    maxHeight: '40%',
  },
  pinnedList: { flexGrow: 0 },
  pinnedItem: {
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  pinnedText: { fontSize: 16, color: '#000' },
  pinnedTime: { fontSize: 12, color: '#666' },
  imagePickerModalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  imagePickerModalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: '80%',
    padding: 20,
  },
  imagePickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  imagePickerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  imageGrid: {
    flex: 1,
  },
  imageGridItem: {
    flex: 1,
    aspectRatio: 1,
    margin: 2,
    borderRadius: 8,
    overflow: 'hidden',
  },
  selectedImageGridItem: {
    borderWidth: 2,
    borderColor: '#0084ff',
  },
  imageGridItemImage: {
    width: '100%',
    height: '100%',
  },
  imageCheckmark: {
    position: 'absolute',
    top: 5,
    right: 5,
    backgroundColor: 'white',
    borderRadius: 12,
  },
  imagePickerFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  selectedCount: {
    fontSize: 16,
    color: '#666',
  },
  groupModalContent: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 20,
    width: '90%',
    maxHeight: '80%',
  },
  groupModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  groupModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  groupNameInput: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 10,
    marginBottom: 20,
    fontSize: 16,
  },
  memberSelectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  memberCount: {
    fontSize: 14,
    color: '#666',
    marginBottom: 10,
  },
  memberList: {
    maxHeight: 300,
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  selectedMemberItem: {
    backgroundColor: '#f0f8ff',
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
  },
  memberName: {
    flex: 1,
    fontSize: 16,
  },
  createGroupButton: {
    backgroundColor: '#0084ff',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  createGroupButtonDisabled: {
    backgroundColor: '#ccc',
  },
  createGroupButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  groupSettingOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  groupSettingText: {
    fontSize: 16,
    marginLeft: 10,
  },
  leaveGroupOption: {
    marginTop: 20,
    borderBottomWidth: 0,
  },
  leaveGroupText: {
    color: 'red',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
});

export default ChatRoomScreen;