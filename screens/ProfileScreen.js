import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { API_BASE_URL } from '../config';
import { updateUserProfile, fetchUserProfile } from '../api/userApi';

const ProfileScreen = () => {
  const navigation = useNavigation();
  const [username, setUsername] = useState('');
  const [avatarUri, setAvatarUri] = useState('');

  useEffect(() => {
    loadUserProfile();
  }, []);

  const loadUserProfile = async () => {
    try {
      const profile = await fetchUserProfile();
      if (profile) {
        setUsername(profile.username || '');
        if (profile.avatar) {
          setAvatarUri(profile.avatar.startsWith('http') ? profile.avatar : `${API_BASE_URL}${profile.avatar}`);
        }
      }
    } catch (error) {
      console.error('Lỗi khi lấy thông tin profile:', error);
    }
  };

  const requestPermission = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Lỗi', 'Quyền truy cập vào thư viện ảnh bị từ chối!');
      return false;
    }
    return true;
  };

  const pickImage = async () => {
    const hasPermission = await requestPermission();
    if (!hasPermission) return;

    try {
      let result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 1,
      });

      if (!result.canceled) {
        const uri = result.assets[0].uri;
        if (uri) {
          // Hiển thị ảnh đã chọn ngay lập tức
          setAvatarUri(uri);
          
          // Upload avatar lên server
          const file = {
            uri: uri,
            type: 'image/jpeg',
            name: 'avatar.jpg',
          };
          
          try {
            const result = await updateUserProfile(null, file);
            if (result && result.avatar) {
              // Cập nhật avatarUri với URL từ server
              const newAvatarUrl = result.avatar.startsWith('http') 
                ? result.avatar 
                : `${API_BASE_URL}${result.avatar}`;
              setAvatarUri(newAvatarUrl);
              Alert.alert('Thành công', 'Avatar đã được cập nhật!');
            } else {
              throw new Error('Không nhận được URL avatar từ server');
            }
          } catch (uploadError) {
            console.error('Lỗi khi upload avatar:', uploadError);
            
            // Xử lý các trường hợp lỗi cụ thể
            let errorMessage = 'Không thể cập nhật avatar. Vui lòng thử lại sau.';
            
            if (uploadError.message.includes('Không có quyền') || uploadError.message.includes('Không tìm thấy token')) {
              errorMessage = 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
              Alert.alert('Lỗi', errorMessage);
              navigation.navigate('Login');
            } else {
              Alert.alert('Lỗi', errorMessage);
            }
            
            // Load lại profile để lấy avatar cũ
            loadUserProfile();
          }
        }
      }
    } catch (error) {
      console.error('Lỗi khi chọn ảnh:', error);
      Alert.alert('Lỗi', 'Không thể chọn ảnh. Vui lòng thử lại sau.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.searchButton}>
          <Ionicons name="search" size={24} color="white" />
          <Text style={styles.searchText}>Tìm kiếm</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.navigate('Settings')}>
          <Ionicons name="settings-outline" size={24} color="white" />
        </TouchableOpacity>
      </View>

      <ScrollView>
        {/* User Info */}
        <View style={styles.userInfo}>
          <TouchableOpacity onPress={pickImage}>
            <Image
              source={{ uri: avatarUri || 'https://via.placeholder.com/80/808080/FFFFFF?Text=User' }}
              style={styles.avatar}
            />
          </TouchableOpacity>
          <View style={styles.userInfoText}>
            <Text style={styles.name}>{username || 'Người dùng'}</Text>
            <TouchableOpacity onPress={() => navigation.navigate('UserProfile')}>
              <Text style={styles.viewProfile}>Xem trang cá nhân</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.addFriendButton}>
            <Ionicons name="person-add-outline" size={24} color="#0084ff" />
          </TouchableOpacity>
        </View>

        {/* Các mục khác giữ nguyên */}
        <TouchableOpacity style={styles.listItem}>
          <View style={styles.listItemLeft}>
            <Ionicons name="cloud-outline" size={24} color="#0084ff" style={styles.listItemIcon} />
            <View style={styles.listItemTextContainer}>
              <Text style={styles.listItemTitle}>zCloud</Text>
              <Text style={styles.listItemSubtitle}>Không gian lưu trữ dữ liệu trên đám mây</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward-outline" size={20} color="#ccc" />
        </TouchableOpacity>
        {/* ... các mục khác tương tự ... */}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9f9f9',
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
  userInfo: {
    flexDirection: 'row',
    padding: 15,
    backgroundColor: 'white',
    alignItems: 'center',
    marginBottom: 10,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 15,
  },
  userInfoText: {
    flex: 1,
  },
  name: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  viewProfile: {
    color: '#0084ff',
    fontSize: 14,
  },
  addFriendButton: {
    padding: 10,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 15,
    backgroundColor: 'white',
    marginBottom: 1,
    justifyContent: 'space-between',
  },
  listItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  listItemIcon: {
    marginRight: 15,
  },
  listItemTextContainer: {
    flexDirection: 'column',
  },
  listItemTitle: {
    fontSize: 16,
    color: '#333',
  },
  listItemSubtitle: {
    fontSize: 12,
    color: '#777',
    marginTop: 5,
  },
});

export default ProfileScreen;