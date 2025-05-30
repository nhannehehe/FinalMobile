import React, { useState } from 'react'; // Import useState
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert, // Import Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

const RegistrationDetailScreen = () => {
  const navigation = useNavigation();
  const [name, setName] = useState(''); // State cho Họ và tên
  const [password, setPassword] = useState(''); // State cho Mật khẩu
  const [confirmPassword, setConfirmPassword] = useState(''); // State cho Xác nhận mật khẩu
  const [verificationCode, setVerificationCode] = useState(''); // State cho Mã xác thực (tùy chọn)

  const handleRegister = () => {
    // Xử lý logic đăng ký
    if (password !== confirmPassword) {
      Alert.alert('Lỗi', 'Mật khẩu và xác nhận mật khẩu không khớp.');
      return;
    }

    // (Tùy chọn) Kiểm tra mã xác thực (nếu có)

    // Lưu thông tin người dùng vào cơ sở dữ liệu (hoặc phương tiện lưu trữ khác)

    // Điều hướng đến màn hình chính
    navigation.navigate('ChatList'); // Hoặc MainTabs
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#0084ff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Đăng ký</Text>
      </View>

      {/* Content */}
      <ScrollView style={styles.content}>
        <Text style={styles.description}>
          Nhập thông tin cá nhân để hoàn tất đăng ký
        </Text>

        {/* Name Input */}
        <TextInput
          style={styles.input}
          placeholder="Họ và tên"
          value={name}
          onChangeText={setName}
        />

        {/* Password Input */}
        <TextInput
          style={styles.input}
          placeholder="Mật khẩu"
          secureTextEntry={true}
          value={password}
          onChangeText={setPassword}
        />

        {/* Confirm Password Input */}
        <TextInput
          style={styles.input}
          placeholder="Xác nhận mật khẩu"
          secureTextEntry={true}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
        />

        {/* Verification Code Input (Tùy chọn) */}
        {/* <TextInput
          style={styles.input}
          placeholder="Mã xác thực (nếu có)"
          value={verificationCode}
          onChangeText={setVerificationCode}
        /> */}

        {/* Register Button */}
        <TouchableOpacity style={styles.registerButton} onPress={handleRegister}>
          <Text style={styles.registerButtonText}>Đăng ký</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  header: {
    backgroundColor: 'white',
    paddingVertical: 10,
    paddingHorizontal: 15,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
    marginLeft: 10,
  },
  content: {
    flex: 1,
    paddingHorizontal: 15,
    justifyContent: 'flex-start',
    paddingTop: 50,
  },
  description: {
    fontSize: 16,
    color: '#333',
    marginBottom: 20,
  },
  input: {
    height: 40,
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
    marginBottom: 15,
  },
  registerButton: {
    backgroundColor: '#0084ff',
    paddingVertical: 12,
    borderRadius: 25,
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 20,
  },
  registerButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default RegistrationDetailScreen;