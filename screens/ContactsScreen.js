import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  TouchableOpacity,
  TextInput,
  FlatList,
  Image,
  Alert,
  Keyboard,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { API_BASE_URL } from '../config';

// --- Placeholders ---
const getAuthToken = async () => {
  try {
    const token = await AsyncStorage.getItem('accessToken');
    return token;
  } catch (e) {
    console.error('Lỗi khi lấy token từ AsyncStorage:', e);
    return null;
  }
};
// --- End Placeholders ---

// *** HÀM RENDER ITEM CHO DANH SÁCH BẠN BÈ ***
const renderFriendItem = ({ item, navigation, onDeleteFriend, onBlockFriend }) => {
  const friendId = item.id || item.userId || item._id;
  const friendName = item.name || item.fullName || item.username || 'Người dùng không tên';
  const avatar = item.avatar || item.profilePicture || 'https://via.placeholder.com/45';

  if (!friendId || !friendName) {
    console.warn('renderFriendItem: Bỏ qua item bạn bè thiếu id hoặc name:', JSON.stringify(item));
    return null;
  }

  const handlePressFriend = () => {
    navigation.navigate('ChatRoomScreen', { friendInfo: item });
  };

  const handleLongPress = () => {
    Alert.alert(
      `Tùy chọn cho ${friendName}`,
      'Chọn hành động:',
      [
        {
          text: 'Xóa bạn',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Xác nhận xóa bạn',
              `Bạn có chắc chắn muốn xóa ${friendName} khỏi danh sách bạn bè?`,
              [
                { text: 'Hủy', style: 'cancel' },
                {
                  text: 'Xóa',
                  style: 'destructive',
                  onPress: () => onDeleteFriend(friendId, friendName),
                },
              ]
            );
          },
        },
        {
          text: 'Chặn',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Xác nhận chặn',
              `Bạn có chắc chắn muốn chặn ${friendName}?`,
              [
                { text: 'Hủy', style: 'cancel' },
                {
                  text: 'Chặn',
                  style: 'destructive',
                  onPress: () => onBlockFriend(friendId, friendName),
                },
              ]
            );
          },
        },
        { text: 'Hủy', style: 'cancel' },
      ],
      { cancelable: true }
    );
  };

  return (
    <TouchableOpacity
      style={styles.contactItem}
      onPress={handlePressFriend}
      onLongPress={handleLongPress}
      delayLongPress={300}
    >
      <Image source={{ uri: avatar }} style={styles.avatar} />
      <Text style={styles.contactName}>{friendName}</Text>
      <Ionicons name="chevron-forward-outline" size={20} color="#ccc" />
    </TouchableOpacity>
  );
};

const ContactsScreen = ({ navigation }) => {
  // --- States ---
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [receiverIdInput, setReceiverIdInput] = useState('');
  const [isLoadingSendRequest, setIsLoadingSendRequest] = useState(false);
  const [pendingRequestCount, setPendingRequestCount] = useState(0);
  const [friends, setFriends] = useState([]);
  const [isLoadingFriends, setIsLoadingFriends] = useState(false);
  // --- End States ---

  // --- Logic Fetch Lời Mời ---
  const fetchPendingCount = useCallback(async () => {
    try {
      const netInfo = await NetInfo.fetch();
      if (!netInfo.isConnected) {
        setPendingRequestCount(0);
        return;
      }

      const token = await getAuthToken();
      if (!token) return;
      const url = `${API_BASE_URL}/friend/requests/pending`;
      const response = await axios.get(url, { headers: { Authorization: `Bearer ${token}` } });
      const count = (response.data && Array.isArray(response.data)) ? response.data.length : 0;
      setPendingRequestCount(count);
    } catch (error) {
      console.error('fetchPendingCount Error:', error);
      setPendingRequestCount(0);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', fetchPendingCount);
    return unsubscribe;
  }, [navigation, fetchPendingCount]);
  // --- Kết thúc Logic Fetch Lời Mời ---

  // --- Logic Fetch Bạn Bè ---
  const fetchFriends = useCallback(async () => {
    setIsLoadingFriends(true);
    try {
      const netInfo = await NetInfo.fetch();
      if (!netInfo.isConnected) {
        Alert.alert('Lỗi', 'Không có kết nối mạng. Vui lòng kiểm tra lại.');
        setFriends([]);
        return;
      }

      const token = await getAuthToken();
      if (!token) {
        Alert.alert('Lỗi', 'Không tìm thấy token. Vui lòng đăng nhập lại.');
        throw new Error('Token not found');
      }

      const url = `${API_BASE_URL}/friend`;
      console.log('Gọi API lấy danh sách bạn bè:', url);
      const response = await axios.get(url, { headers: { Authorization: `Bearer ${token}` } });

      console.log('Phản hồi API friends:', JSON.stringify(response.data));

      if (Array.isArray(response.data)) {
        const normalizedFriends = response.data
          .filter((friend) => friend && (friend.id || friend.userId || friend._id))
          .map((friend) => ({
            id: friend.id || friend.userId || friend._id,
            name: friend.name || friend.fullName || friend.username || 'Người dùng không tên',
            avatar: friend.avatar || friend.profilePicture || 'https://via.placeholder.com/45',
            originalData: friend,
          }));

        console.log('Danh sách bạn bè đã chuẩn hóa:', normalizedFriends);
        setFriends(normalizedFriends);
      } else {
        console.warn('API /friend không trả về mảng:', response.data);
        setFriends([]);
      }
    } catch (error) {
      console.error('Lỗi khi lấy danh sách bạn bè:', error);
      let errorMessage = 'Lỗi khi tải danh sách bạn bè.';
      if (error.response?.status === 401) errorMessage = 'Lỗi xác thực. Vui lòng đăng nhập lại.';
      else if (!error.response) errorMessage = 'Không thể kết nối đến máy chủ.';
      Alert.alert('Lỗi', errorMessage);
      setFriends([]);
    } finally {
      setIsLoadingFriends(false);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', fetchFriends);
    return unsubscribe;
  }, [navigation, fetchFriends]);
  // --- Kết thúc Logic Fetch Bạn Bè ---

  // --- Hàm Xóa Bạn Bè ---
  const handleDeleteFriend = async (friendId, friendName) => {
    try {
      const netInfo = await NetInfo.fetch();
      if (!netInfo.isConnected) {
        Alert.alert('Lỗi', 'Không có kết nối mạng. Vui lòng kiểm tra lại.');
        return;
      }

      if (!friendId || typeof friendId !== 'string') {
        console.error('handleDeleteFriend: friendId không hợp lệ!', friendId);
        Alert.alert('Lỗi', 'ID bạn bè không hợp lệ.');
        return;
      }

      // Kiểm tra xem friendId có trong danh sách bạn bè
      const friendExists = friends.some((friend) => friend.id === friendId);
      if (!friendExists) {
        console.warn('handleDeleteFriend: friendId không tồn tại trong danh sách bạn bè:', friendId);
        Alert.alert('Lỗi', 'Người dùng không có trong danh sách bạn bè.');
        return;
      }

      console.log('Đang xóa bạn bè với ID:', friendId, 'Tên:', friendName);

      const token = await getAuthToken();
      if (!token) {
        Alert.alert('Lỗi', 'Không tìm thấy token. Vui lòng đăng nhập lại.');
        return;
      }

      const url = `${API_BASE_URL}/friend/${friendId}`;
      console.log('Gọi API xóa bạn bè:', url);

      await axios.delete(url, { headers: { Authorization: `Bearer ${token}` } });
      Alert.alert('Thành công', `Đã xóa ${friendName} khỏi danh sách bạn bè.`);
      await fetchFriends();
    } catch (error) {
      console.error('handleDeleteFriend Error:', error);
      let errorMessage = 'Lỗi khi xóa bạn bè.';
      if (error.response?.status === 404) {
        errorMessage = 'Không tìm thấy người dùng hoặc quan hệ bạn bè.';
      } else if (error.response?.status === 403) {
        errorMessage = 'Bạn không có quyền xóa mối quan hệ này. Hãy thử làm mới danh sách bạn bè.';
      } else if (error.response?.status === 401) {
        errorMessage = 'Lỗi xác thực. Vui lòng đăng nhập lại.';
      } else if (error.response?.status === 400) {
        errorMessage = `Yêu cầu không hợp lệ: ${error.response?.data?.message || ''}`;
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (!error.response) {
        errorMessage = 'Không thể kết nối đến máy chủ.';
      }
      Alert.alert('Lỗi', errorMessage);
      // Làm mới danh sách bạn bè để đồng bộ
      await fetchFriends();
    }
  };

  // --- Hàm Chặn Bạn Bè ---
  const handleBlockFriend = async (friendId, friendName) => {
    try {
      const netInfo = await NetInfo.fetch();
      if (!netInfo.isConnected) {
        Alert.alert('Lỗi', 'Không có kết nối mạng. Vui lòng kiểm tra lại.');
        return;
      }

      if (!friendId || typeof friendId !== 'string') {
        console.error('handleBlockFriend: friendId không hợp lệ!', friendId);
        Alert.alert('Lỗi', 'ID bạn bè không hợp lệ.');
        return;
      }

      const token = await getAuthToken();
      if (!token) {
        Alert.alert('Lỗi', 'Không tìm thấy token. Vui lòng đăng nhập lại.');
        return;
      }

      const url = `${API_BASE_URL}/friend/block/${friendId}`;
      console.log('Gọi API chặn bạn bè:', url);

      await axios.post(url, null, { headers: { Authorization: `Bearer ${token}` } });
      Alert.alert('Thành công', `Đã chặn ${friendName}.`);
      await fetchFriends();
    } catch (error) {
      console.error('handleBlockFriend Error:', error.response?.data || error.message);
      let errorMessage = 'Lỗi khi chặn người dùng.';
      if (error.response?.status === 404) errorMessage = 'Không tìm thấy người dùng.';
      else if (error.response?.status === 401) errorMessage = 'Lỗi xác thực. Vui lòng đăng nhập lại.';
      else if (error.response?.status === 403) errorMessage = 'Bạn không có quyền thực hiện hành động này.';
      else if (error.response?.data?.message) errorMessage = error.response.data.message;
      else if (!error.response) errorMessage = 'Không thể kết nối đến máy chủ.';
      Alert.alert('Lỗi', errorMessage);
    }
  };

  // --- Hàm Gửi Lời Mời ---
  const handleSendFriendRequest = async () => {
    if (!receiverIdInput.trim()) {
      Alert.alert('Lỗi', 'Vui lòng nhập ID người dùng.');
      return;
    }
    Keyboard.dismiss();
    setIsLoadingSendRequest(true);
    try {
      const netInfo = await NetInfo.fetch();
      if (!netInfo.isConnected) {
        Alert.alert('Lỗi', 'Không có kết nối mạng. Vui lòng kiểm tra lại.');
        throw new Error('No network connection');
      }

      const token = await getAuthToken();
      if (!token) {
        Alert.alert('Lỗi', 'Không tìm thấy token. Vui lòng đăng nhập lại.');
        throw new Error('Token not found');
      }

      const url = `${API_BASE_URL}/friend/send-request/${receiverIdInput.trim()}`;
      await axios.post(url, null, { headers: { Authorization: `Bearer ${token}` } });
      Alert.alert('Thành công', 'Đã gửi lời mời kết bạn!');
      setReceiverIdInput('');
      setIsSearchActive(false);
    } catch (error) {
      console.error('handleSendFriendRequest Error:', error.response?.data || error.message);
      let errorMessage = 'Lỗi khi gửi lời mời.';
      if (error.response?.status === 404) errorMessage = 'Không tìm thấy người dùng.';
      else if (error.response?.status === 401 || error.response?.status === 403) errorMessage = 'Lỗi xác thực.';
      else if (error.response?.data?.message) errorMessage = error.response.data.message;
      else if (!error.response) errorMessage = 'Không thể kết nối máy chủ.';
      Alert.alert('Lỗi', errorMessage);
    } finally {
      setIsLoadingSendRequest(false);
    }
  };
  // --- Kết thúc hàm gửi lời mời ---

  // --- Render Header Động ---
  const renderHeader = () => {
    if (isSearchActive) {
      return (
        <View style={[styles.header, styles.searchHeader]}>
          <TouchableOpacity onPress={() => { setIsSearchActive(false); setReceiverIdInput(''); }}>
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <TextInput
            style={styles.searchInput}
            placeholder="Nhập ID người dùng..."
            placeholderTextColor="#ccc"
            value={receiverIdInput}
            onChangeText={setReceiverIdInput}
            autoFocus={true}
            onSubmitEditing={handleSendFriendRequest}
            selectionColor={'white'}
            autoCapitalize="none"
          />
          {isLoadingSendRequest ? (
            <ActivityIndicator color="white" style={styles.sendButton} />
          ) : (
            <TouchableOpacity
              style={styles.sendButton}
              onPress={handleSendFriendRequest}
              disabled={!receiverIdInput.trim()}
            >
              <Ionicons name="send" size={24} color={!receiverIdInput.trim() ? "#aaa" : "white"} />
            </TouchableOpacity>
          )}
        </View>
      );
    } else {
      return (
        <View style={styles.header}>
          <TouchableOpacity style={styles.searchButton} onPress={() => setIsSearchActive(true)}>
            <Ionicons name="search" size={20} color="white" style={styles.searchIcon} />
            <Text style={styles.searchText}>Gửi lời mời kết bạn đến số điện thoại</Text>
          </TouchableOpacity>
        </View>
      );
    }
  };
  // --- Kết thúc Render Header ---

  // Fetch dữ liệu lần đầu khi component được mount
  useEffect(() => {
    fetchPendingCount();
    fetchFriends();
  }, [fetchPendingCount, fetchFriends]);

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.headerContainer}>
        {renderHeader()}
      </SafeAreaView>

      {/* Tab điều hướng nhỏ */}
      <View style={styles.subTabs}>
        <TouchableOpacity style={styles.subTabItem}>
          <Text style={[styles.subTabText, styles.subTabActiveText]}>Bạn bè</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.subTabItem}>
          <Text style={styles.subTabText}>Nhóm</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.subTabItem}>
          <Text style={styles.subTabText}>OA</Text>
        </TouchableOpacity>
      </View>

      {/* Mục Lời mời kết bạn */}
      <TouchableOpacity
        style={styles.friendRequestButton}
        onPress={() => navigation.navigate('FriendRequestsScreen')}
      >
        <View style={styles.friendRequestIconContainer}>
          <Ionicons name="people-outline" size={22} color="white" />
        </View>
        <Text style={styles.friendRequestText}>
          Lời mời kết bạn {pendingRequestCount > 0 ? `(${pendingRequestCount})` : ''}
        </Text>
      </TouchableOpacity>

      {/* --- DANH SÁCH BẠN BÈ --- */}
      {isLoadingFriends ? (
        <ActivityIndicator size="large" color="#0084ff" style={styles.listLoader} />
      ) : (
        <FlatList
          style={styles.friendList}
          data={friends}
          renderItem={({ item }) => renderFriendItem({ item, navigation, onDeleteFriend: handleDeleteFriend, onBlockFriend: handleBlockFriend })}
          keyExtractor={(item, index) => {
            const id = item?.id || item?.userId || item?._id;
            return id ? id.toString() : `friend-${index}`;
          }}
          ListEmptyComponent={<Text style={styles.emptyListText}>Chưa có bạn bè nào.</Text>}
        />
      )}
      {/* --- Kết thúc Danh sách bạn bè --- */}
    </View>
  );
};

// --- Styles ---
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  headerContainer: { backgroundColor: '#0084ff' },
  header: { backgroundColor: '#0084ff', height: 55, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center' },
  searchHeader: { justifyContent: 'space-between' },
  searchButton: { flex: 1, height: 36, backgroundColor: 'rgba(255, 255, 255, 0.3)', borderRadius: 5, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center' },
  searchIcon: { marginRight: 8 },
  searchText: { color: '#f0f0f0', fontSize: 15 },
  searchInput: { flex: 1, height: '100%', color: 'white', fontSize: 16, marginLeft: 10, marginRight: 5 },
  sendButton: { padding: 5, justifyContent: 'center', alignItems: 'center' },
  subTabs: { flexDirection: 'row', backgroundColor: '#fff', paddingHorizontal: 15, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#eee' },
  subTabItem: { marginRight: 25 },
  subTabText: { color: '#666', fontSize: 16 },
  subTabActiveText: { fontWeight: 'bold', color: '#000' },
  friendRequestButton: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 15, backgroundColor: '#fff', borderBottomWidth: 1, borderColor: '#eee' },
  friendRequestIconContainer: { width: 40, height: 40, borderRadius: 8, backgroundColor: '#0084ff', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  friendRequestText: { flex: 1, fontSize: 17, color: '#111' },
  listLoader: { marginTop: 30, flex: 1 },
  friendList: { flex: 1 },
  contactItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 15, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  avatar: { width: 45, height: 45, borderRadius: 22.5, marginRight: 15, backgroundColor: '#eee' },
  contactName: { flex: 1, fontSize: 17, color: '#111' },
  emptyListText: { textAlign: 'center', marginTop: 50, fontSize: 16, color: '#888' },
});

export default ContactsScreen;