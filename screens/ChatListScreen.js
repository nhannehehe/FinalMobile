import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  TouchableOpacity,
  Image,
  FlatList,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import { getUserGroups } from '../api/groupApi';
import { getAccessToken } from '../api/authApi';
import { getChatHistory } from '../api/messageApi';

const ChatListScreen = ({ navigation }) => {
  const [token, setToken] = useState(null);
  const [userId, setUserId] = useState(null);
  const [friends, setFriends] = useState([]);
  const [groups, setGroups] = useState([]);
  const [chatData, setChatData] = useState([]);
  const [activeTab, setActiveTab] = useState('chats'); // 'chats' or 'groups'

  const loadAuthData = async () => {
    try {
      const storedToken = await AsyncStorage.getItem('accessToken');
      const storedUserId = await AsyncStorage.getItem('userId');
      if (storedToken && storedUserId) {
        setToken(storedToken);
        setUserId(storedUserId);
      } else {
        Alert.alert('Lỗi', 'Vui lòng đăng nhập lại.');
        navigation.navigate('Login');
      }
    } catch (error) {
      console.error('Lỗi tải dữ liệu xác thực:', error);
      Alert.alert('Lỗi', 'Không thể tải thông tin đăng nhập');
    }
  };

  const fetchFriends = async () => {
    if (!token) return;
    try {
      const response = await axios.get(`${API_BASE_URL}/friend`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      console.log('Danh sách bạn bè từ API /friend:', response.data);
      let friendList = response.data.map((friend) => ({
        id: friend.id || friend.userId,
        name: friend.name || friend.fullName || friend.username || 'Người dùng không tên',
        avatar: friend.avatar || 'https://randomuser.me/api/portraits/lego/1.jpg',
      }));
      // Lọc trùng id
      friendList = friendList.filter(
        (friend, index, self) =>
          index === self.findIndex((f) => f.id === friend.id)
      );
      setFriends(friendList);
    } catch (error) {
      console.error('Lỗi lấy danh sách bạn bè:', error.response?.data || error.message);
      Alert.alert('Lỗi', 'Không thể tải danh sách bạn bè');
    }
  };

  const fetchGroups = async () => {
    console.log('=== Bắt đầu fetchGroups ===');
    console.log('Token:', token ? 'Có token' : 'Không có token');
    console.log('UserId:', userId);
    console.log('API URL:', `${API_BASE_URL}/group/user/${userId}`);
    
    if (!token || !userId) {
      console.log('Thiếu token hoặc userId, dừng fetchGroups');
      return;
    }

    try {
      console.log('Gọi API lấy danh sách nhóm...');
      console.log('Headers:', { Authorization: `Bearer ${token}` });
      
      const response = await axios.get(`${API_BASE_URL}/group/user/${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      console.log('Response từ API /group/user:', response.data);
      
      if (!response.data || !Array.isArray(response.data)) {
        console.log('Không có dữ liệu nhóm hoặc dữ liệu không đúng định dạng');
        setGroups([]);
        return;
      }

      console.log('Bắt đầu lấy thông tin thành viên cho từng nhóm...');
      const groupsWithMembers = await Promise.all(
        response.data.map(async (group) => {
          console.log(`Đang lấy thành viên cho nhóm ${group.id} - ${group.name}`);
          try {
            const membersResponse = await axios.get(`${API_BASE_URL}/group/${group.id}/members`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            console.log(`Thành viên của nhóm ${group.id}:`, membersResponse.data);
            
            // Kiểm tra xem người dùng hiện tại có phải là thành viên của nhóm không
            const isMember = membersResponse.data.some(member => member.id === userId || member.userId === userId);
            if (!isMember) {
              return null; // Trả về null nếu không phải thành viên
            }

            return {
              ...group,
              members: membersResponse.data,
              memberCount: membersResponse.data.length,
            };
          } catch (error) {
            console.error(`Lỗi khi lấy thành viên nhóm ${group.id}:`, error.response?.data || error.message);
            return null; // Trả về null nếu có lỗi
          }
        })
      );

      console.log('Đã lấy xong thông tin thành viên cho tất cả nhóm');
      // Lọc bỏ các nhóm null (không phải thành viên hoặc có lỗi)
      const validGroups = groupsWithMembers.filter(group => group !== null);
      
      const formattedGroups = validGroups.map((group) => ({
        id: group.id,
        name: group.name,
        avatar: group.avatar || 'https://randomuser.me/api/portraits/lego/1.jpg',
        memberCount: group.memberCount,
        members: group.members,
        lastMessage: group.lastMessage || null,
        createdAt: group.createdAt,
        updatedAt: group.updatedAt,
      }));

      console.log('Danh sách nhóm cuối cùng:', formattedGroups);
      setGroups([...formattedGroups]);
      console.log('Đã setGroups với dữ liệu:', formattedGroups);
      console.log('=== Kết thúc fetchGroups thành công ===');
    } catch (error) {
      console.error('=== Lỗi trong fetchGroups ===');
      console.error('Error response:', error.response?.data);
      console.error('Error status:', error.response?.status);
      console.error('Error headers:', error.response?.headers);
      
      if (error.response?.status === 401) {
        console.log('Token hết hạn, chuyển về màn hình đăng nhập');
        Alert.alert('Phiên đăng nhập hết hạn', 'Vui lòng đăng nhập lại để tiếp tục.', [
          {
            text: 'Đăng nhập lại',
            onPress: () => navigation.navigate('Login'),
          },
        ]);
      } else {
        console.log('Lỗi khác, hiển thị thông báo lỗi');
        Alert.alert('Lỗi', 'Không thể tải danh sách nhóm');
      }
    }
  };

  const fetchLastMessage = async (friendId) => {
    if (!token || !friendId) return null;
    try {
      const chatHistory = await getChatHistory(friendId, null, token);
      if (chatHistory && Array.isArray(chatHistory) && chatHistory.length > 0) {
        // Sắp xếp tin nhắn theo thời gian tạo giảm dần
        const sortedMessages = chatHistory.sort((a, b) => {
          const timeA = new Date(a.createdAt || a.createAt).getTime();
          const timeB = new Date(b.createdAt || b.createAt).getTime();
          return timeB - timeA;
        });

        const lastMessage = sortedMessages[0]; // Tin nhắn đầu tiên sau khi sắp xếp
        return {
          content: lastMessage.content || 'Không có nội dung',
          createAt: lastMessage.createdAt || lastMessage.createAt || new Date().toISOString(),
          recalled: lastMessage.recalled || false,
          type: lastMessage.type || 'TEXT',
        };
      }
      return null;
    } catch (error) {
      console.error(`Lỗi lấy tin nhắn cuối cùng với bạn ${friendId}:`, error.response?.data || error.message);
      
      if (error.response?.status === 401) {
        console.warn('Token hết hạn, cần đăng nhập lại');
        navigation.navigate('Login');
      } else if (error.response?.status === 403) {
        console.warn(`Không có quyền truy cập lịch sử chat với bạn ${friendId}`);
      }
      return null;
    }
  };

  const loadChatData = async () => {
    if (!friends.length) return;
    const chatList = [];
    for (const friend of friends) {
      const lastMessage = await fetchLastMessage(friend.id);
      const chatItem = {
        id: friend.id,
        avatar: friend.avatar,
        name: friend.name,
        message: lastMessage
          ? lastMessage.recalled
            ? 'Tin nhắn đã được thu hồi'
            : lastMessage.type === 'IMAGE'
            ? '[Hình ảnh]'
            : lastMessage.type === 'VIDEO'
            ? '[Video]'
            : lastMessage.type === 'FILE'
            ? '[Tệp]'
            : lastMessage.content
          : 'Chưa có tin nhắn',
        time: lastMessage ? formatTime(lastMessage.createAt) : '',
        unread: false,
      };
      chatList.push(chatItem);
    }
    // Lọc trùng id trong chatList
    const uniqueChatList = chatList.filter(
      (item, index, self) => index === self.findIndex((i) => i.id === item.id)
    );
    // Sắp xếp danh sách chat theo thời gian tin nhắn mới nhất
    uniqueChatList.sort((a, b) => {
      if (!a.time || !b.time) return 0;
      const timeA = new Date(a.time).getTime();
      const timeB = new Date(b.time).getTime();
      return timeB - timeA;
    });
    console.log('Danh sách chat cuối cùng:', uniqueChatList);
    setChatData(uniqueChatList);
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const diffInMinutes = Math.floor((now - date) / (1000 * 60));
    if (diffInMinutes < 60) {
      return `${diffInMinutes} phút`;
    } else if (diffInMinutes < 1440) {
      return `${Math.floor(diffInMinutes / 60)} giờ`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const loadData = async () => {
    if (!token || !userId) return;
    if (activeTab === 'chats') {
      await fetchFriends();
    } else {
      await fetchGroups();
    }
  };

  useEffect(() => {
    loadAuthData();
  }, []);

  useEffect(() => {
    if (token && userId) {
      loadData();
    }
  }, [token, userId, activeTab]);

  useEffect(() => {
    if (activeTab === 'chats' && friends.length > 0) {
      loadChatData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [friends, activeTab]);

  useEffect(() => {
    if (activeTab === 'chats') {
      const ids = chatData.map(item => item.id);
      const uniqueIds = new Set(ids);
      if (ids.length !== uniqueIds.size) {
        console.warn('Có phần tử trùng id trong chatData:', ids);
      }
    } else {
      const ids = groups.map(item => item.id);
      const uniqueIds = new Set(ids);
      if (ids.length !== uniqueIds.size) {
        console.warn('Có phần tử trùng id trong groups:', ids);
      }
    }
  }, [chatData, groups, activeTab]);

  const renderChatItem = ({ item }) => (
    <TouchableOpacity
      style={styles.listItem}
      onPress={() =>
        navigation.navigate('ChatRoomScreen', {
          friendInfo: { id: item.id, name: item.name, avatar: item.avatar },
        })
      }
    >
      <Image
        source={{ uri: item.avatar }}
        style={styles.avatar}
        defaultSource={{ uri: 'https://randomuser.me/api/portraits/lego/1.jpg' }}
      />
      <View style={styles.messageInfo}>
        <Text style={styles.name}>{item.name}</Text>
        <Text style={styles.message}>{item.message}</Text>
      </View>
      <View style={styles.timeAndUnread}>
        <Text style={styles.time}>{item.time}</Text>
        {item.unread && <View style={styles.unreadDot} />}
      </View>
    </TouchableOpacity>
  );

  const renderGroupItem = ({ item }) => (
    <TouchableOpacity
      style={styles.listItem}
      onPress={() =>
        navigation.navigate('ChatRoomScreen', {
          groupInfo: { 
            id: item.id, 
            name: item.name, 
            avatar: item.avatar,
            members: item.members,
            memberCount: item.memberCount
          },
        })
      }
    >
      <Image
        source={{ uri: item.avatar }}
        style={styles.avatar}
        defaultSource={{ uri: 'https://randomuser.me/api/portraits/lego/1.jpg' }}
      />
      <View style={styles.messageInfo}>
        <Text style={styles.name}>{item.name}</Text>
        <Text style={styles.message}>
          {item.lastMessage
            ? item.lastMessage.recalled
              ? 'Tin nhắn đã được thu hồi'
              : item.lastMessage.type === 'IMAGE'
              ? '[Hình ảnh]'
              : item.lastMessage.type === 'VIDEO'
              ? '[Video]'
              : item.lastMessage.type === 'FILE'
              ? '[Tệp]'
              : item.lastMessage.content
            : `${item.memberCount} thành viên`}
        </Text>
      </View>
      <View style={styles.timeAndUnread}>
        {item.lastMessage && (
          <Text style={styles.time}>{formatTime(item.lastMessage.createAt)}</Text>
        )}
        {item.unread && <View style={styles.unreadDot} />}
      </View>
    </TouchableOpacity>
  );

  const handleTabChange = (tab) => {
    setActiveTab(tab);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.searchButton}>
          <Ionicons name="search" size={24} color="white" />
          <Text style={styles.searchText}>Tìm kiếm</Text>
        </TouchableOpacity>
        <TouchableOpacity>
          <Ionicons name="qr-code-outline" size={24} color="white" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => {
            Alert.alert(
              'Tùy chọn',
              'Chọn hành động',
              [
                {
                  text: 'Tạo nhóm chat',
                  onPress: () => navigation.navigate('ChatRoomScreen', { showCreateGroup: true }),
                },
                {
                  text: 'Hủy',
                  style: 'cancel',
                },
              ]
            );
          }}
        >
          <Ionicons name="add" size={24} color="white" />
        </TouchableOpacity>
      </View>

      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'chats' && styles.activeTab]}
          onPress={() => handleTabChange('chats')}
        >
          <Text style={[styles.tabText, activeTab === 'chats' && styles.activeTabText]}>
            Tin nhắn
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'groups' && styles.activeTab]}
          onPress={() => handleTabChange('groups')}
        >
          <Text style={[styles.tabText, activeTab === 'groups' && styles.activeTabText]}>
            Nhóm
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={activeTab === 'chats' ? chatData : groups}
        renderItem={activeTab === 'chats' ? renderChatItem : renderGroupItem}
        keyExtractor={(item, index) =>
          activeTab === 'chats'
            ? `friend-${item.id}-${index}`
            : `group-${item.id}-${index}`
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    backgroundColor: '#0084ff',
    paddingVertical: 10,
    paddingHorizontal: 15,
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchButton: {
    flex: 1,
    height: 40,
    borderRadius: 5,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 10,
  },
  searchText: {
    color: 'white',
    marginLeft: 10,
    fontSize: 16,
  },
  addButton: {
    marginLeft: 10,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 15,
  },
  messageInfo: {
    flex: 1,
  },
  name: {
    fontWeight: 'bold',
    fontSize: 16,
  },
  message: {
    color: '#666',
    fontSize: 14,
  },
  timeAndUnread: {
    alignItems: 'flex-end',
  },
  time: {
    color: '#888',
    fontSize: 12,
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'red',
    marginTop: 5,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  tab: {
    flex: 1,
    paddingVertical: 15,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#0084ff',
  },
  tabText: {
    fontSize: 16,
    color: '#666',
  },
  activeTabText: {
    color: '#0084ff',
    fontWeight: 'bold',
  },
});

export default ChatListScreen;