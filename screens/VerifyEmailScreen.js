import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import axios from 'axios';

const VerifyEmailScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { email } = route.params; // Lấy email từ CreateAccScreen
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleVerifyEmailCode = async () => {
    if (!code) {
      Alert.alert('Thông báo', 'Vui lòng nhập mã xác thực.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await axios.post('https://chat-zalo-base.loca.lt/auth/verify-email-code', { // Thay đổi URL nếu cần
        email: email,
        code: code,
      });

      const data = response.data;

      if (response.status === 200) {
        // Xác thực email thành công
        setLoading(false);
        Alert.alert('Thành công', data.message || 'Email đã được xác thực thành công!');
        navigation.navigate('MainTabs'); // Chuyển đến màn hình chính sau khi xác thực
      } else {
        // Xác thực email thất bại
        setLoading(false);
        setError(data.message || 'Mã xác thực không đúng. Vui lòng thử lại.');
        Alert.alert('Lỗi', data.message || 'Mã xác thực không đúng. Vui lòng thử lại.');
      }
    } catch (error) {
      // Xử lý lỗi kết nối hoặc lỗi khác
      setLoading(false);
      setError('Có lỗi xảy ra. Vui lòng thử lại.');
      Alert.alert('Lỗi', 'Có lỗi xảy ra. Vui lòng thử lại.');
      console.error('Lỗi xác thực mã email:', error);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#0084ff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Xác thực Email</Text>
      </View>

      {/* Content */}
      <ScrollView style={styles.content}>
        <Text style={styles.description}>
          Vui lòng nhập mã xác thực được gửi đến email: {email}
        </Text>
        <TextInput
          style={styles.input}
          placeholder="Nhập mã xác thực"
          value={code}
          onChangeText={setCode}
          keyboardType="default"
        />
        <TouchableOpacity style={styles.button} onPress={handleVerifyEmailCode} disabled={loading}>
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Xác nhận</Text>
          )}
        </TouchableOpacity>
        {error && <Text style={styles.errorText}>{error}</Text>}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { /* ... */ },
  header: { /* ... */ },
  headerTitle: { /* ... */ },
  content: { /* ... */ },
  description: { /* ... */ },
  input: { /* ... */ },
  button: { /* ... */ },
  buttonText: { /* ... */ },
  errorText: { /* ... */ },
});

export default VerifyEmailScreen;