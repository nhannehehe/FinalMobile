import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  ActivityIndicator,
  Image,
  ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../config';
import { fetchUserProfile } from '../api/userApi';

const InfoRow = ({ label, value }) => (
  <View style={styles.infoRow}>
    <Text style={styles.infoLabel}>{label}</Text>
    <Text style={styles.infoValue}>{value}</Text>
  </View>
);

const UserProfileScreen = () => {
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState(null);

  useEffect(() => {
    const getUser = async () => {
      setLoading(true);
      const data = await fetchUserProfile();
      if (data) {
        setUserData({
          ...data,
          firstName: data.firstName || '',
          lastName: data.lastName || '',
          username: data.username || '',
          email: data.email || '',
          phone: data.phone || '',
          gender: data.gender || '',
          status: data.status || '',
          birthday: data.birthday || null,
          createdAt: data.createdAt || null,
          updateAt: data.updateAt || null,
          avatar: data.avatar || 'https://randomuser.me/api/portraits/lego/1.jpg'
        });
        setErrorMessage(null);
      } else {
        setErrorMessage('Không lấy được thông tin user');
      }
      setLoading(false);
    };
    getUser();
  }, []);

  const formatDate = (dateStr) => {
    if (!dateStr) return 'Không có';
    const date = new Date(dateStr);
    return date.toLocaleDateString('vi-VN');
  };

  return (
    <SafeAreaView style={styles.container}>
      {loading ? (
        <ActivityIndicator size="large" color="#0084ff" />
      ) : errorMessage ? (
        <Text style={styles.error}>{errorMessage}</Text>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <Image
            source={{ uri: userData?.avatar }}
            style={styles.avatar}
            resizeMode="cover"
          />
          <Text style={styles.sectionTitle}>Thông tin cá nhân</Text>

          <InfoRow label="Họ tên" value={`${userData?.firstName || ''} ${userData?.lastName || ''}`} />
          <InfoRow label="Tên đăng nhập" value={userData?.username || ''} />
          <InfoRow label="Email" value={userData?.email || ''} />
          <InfoRow label="Số điện thoại" value={userData?.phone || 'Không có'} />
          <InfoRow label="Giới tính" value={userData?.gender || 'Không có'} />
          <InfoRow label="Trạng thái" value={userData?.status || 'Không có'} />
          <InfoRow label="Ngày sinh" value={formatDate(userData?.birthday)} />
          <InfoRow label="Ngày tạo" value={formatDate(userData?.createdAt)} />
          <InfoRow label="Ngày cập nhật" value={formatDate(userData?.updateAt)} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    padding: 20,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignSelf: 'center',
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#0084ff',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    alignSelf: 'flex-start',
    color: '#111',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  infoLabel: {
    fontSize: 16,
    color: '#666',
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000',
  },
  error: {
    fontSize: 16,
    color: 'red',
    textAlign: 'center',
    padding: 20,
  },
});

export default UserProfileScreen;
