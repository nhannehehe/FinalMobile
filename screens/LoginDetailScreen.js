import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  TouchableOpacity,
  TextInput,
  Alert,  // Đảm bảo import Alert từ react-native
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from "../config";

const LoginDetailScreen = () => {
  const navigation = useNavigation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async () => {
    // Giả sử biến 'username' và 'password' đã có từ state của component
    // const [username, setUsername] = useState('');
    // const [password, setPassword] = useState('');
    // const navigation = useNavigation(); // Đảm bảo có navigation

    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: username, // State username
          password: password, // State password
        }),
      });
      const data = await response.json(); // Parse JSON response

      if (response.ok) { // Kiểm tra thành công (status 200-299)
        // Kiểm tra các dữ liệu cần thiết có trong response không
        if (!data.accessToken) {
          Alert.alert('Lỗi', 'Phản hồi đăng nhập không chứa accessToken!');
          console.error("Login response missing accessToken:", data);
          return;
        }

        // --- BỔ SUNG LOGIC LẤY VÀ KIỂM TRA USER ID ---
        // !!! KIỂM TRA TÊN TRƯỜNG ID TRONG PHẢN HỒI LOGIN (data) CỦA BẠN !!!
        // Giả sử tên trường là 'userId'. Nếu API trả về tên khác (ví dụ: 'id', '_id', 'user_id'), hãy thay đổi bên dưới.
        const userIdFromResponse = data.userId || data.id || data._id; // Thử các key phổ biến

        if (!userIdFromResponse) {
          // Nếu không có ID, báo lỗi hoặc cảnh báo vì ChatRoomScreen sẽ cần nó
          Alert.alert('Lỗi', 'Phản hồi đăng nhập không chứa ID người dùng!');
          console.error("Login response missing user ID (userId, id, or _id):", data);
          // Quyết định xem có nên dừng lại ở đây không. Nếu không có ID, chat sẽ lỗi.
          // return;
        }
        // --- KẾT THÚC BỔ SUNG ---

        // Lưu token (đã có)
        await AsyncStorage.setItem('accessToken', data.accessToken);
        console.log('Đã lưu accessToken.');

        // Lưu username nhập vào (đã có) - Lưu ý: username này có thể khác username trong data trả về
        await AsyncStorage.setItem('username', username);
        console.log('Đã lưu username (input):', username);

        // *** THÊM BƯỚC LƯU USER ID VÀO ASYNCSTORAGE ***
        if (userIdFromResponse) {
          // Lưu ID lấy được từ response với key là 'userId'
          // Đảm bảo ChatRoomScreen cũng dùng key 'userId' để lấy ra
          await AsyncStorage.setItem('userId', userIdFromResponse.toString()); // Chuyển sang string nếu cần
          console.log('Đã lưu userId:', userIdFromResponse);
        }
        // *** KẾT THÚC THÊM BƯỚC LƯU USER ID ***

        // Đăng nhập thành công
        console.log('Đăng nhập thành công, dữ liệu nhận được:', data);
        navigation.navigate('MainTabs'); // Điều hướng đến màn hình chính

      } else {
        // Xử lý lỗi từ server (ví dụ: sai mật khẩu, tài khoản không tồn tại)
        console.log('Đăng nhập thất bại - Status:', response.status, 'Data:', data);
        // Hiển thị lỗi cụ thể từ server nếu có (data.message), nếu không thì báo chung chung
        Alert.alert('Lỗi đăng nhập', data?.message || 'Tên người dùng hoặc mật khẩu không đúng.');
      }
    } catch (error) {
      console.error('Lỗi trong quá trình đăng nhập:', error);
      // Phân biệt lỗi mạng và lỗi parse JSON
      let errorMsg = 'Có lỗi xảy ra. Vui lòng thử lại.';
      if (error instanceof SyntaxError) {
           errorMsg = 'Lỗi xử lý dữ liệu từ máy chủ.';
      } else if (error.message.includes('Network request failed')) {
           errorMsg = 'Lỗi kết nối mạng. Vui lòng kiểm tra lại.';
      }
      Alert.alert('Lỗi', errorMsg);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Đăng nhập</Text>
      </View>

      {/* Content */}
      <View style={styles.content}>
        <Text style={styles.description}>
          Vui lòng nhập tên người dùng và mật khẩu để đăng nhập
        </Text>

        {/* Username Input */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Tên người dùng"
            value={username}
            onChangeText={setUsername}
          />
        </View>

        {/* Password Input */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Mật khẩu"
            secureTextEntry={true}
            value={password}
            onChangeText={setPassword}
          />
        </View>

        {/* Login Button */}
        <TouchableOpacity style={styles.loginButton} onPress={handleLogin}>
          <Text style={styles.loginButtonText}>Đăng nhập</Text>
        </TouchableOpacity>

        {/* Forgot Password */}
        <TouchableOpacity
          style={styles.forgotPasswordButton}
          onPress={() => navigation.navigate('ForgotPassword')}
        >
          <Text style={styles.forgotPasswordText}>Quên mật khẩu</Text>
        </TouchableOpacity>

        {/* Create Account Button */}
        <TouchableOpacity
          style={styles.createAccountButton}
          onPress={() => navigation.navigate('CreateAcc')}
        >
          <Text style={styles.createAccountButtonText}>Tạo tài khoản mới</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5', // Light gray background
  },
  header: {
    backgroundColor: '#0084ff', // Zalo blue
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 30,
    justifyContent: 'center',
  },
  description: {
    fontSize: 16,
    color: '#333',
    marginBottom: 20,
    textAlign: 'center',
  },
  inputContainer: {
    backgroundColor: 'white',
    borderRadius: 8,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  input: {
    height: 45,
    paddingHorizontal: 15,
  },
  loginButton: {
    backgroundColor: '#0084ff',
    paddingVertical: 12,
    borderRadius: 25,
    alignItems: 'center',
    marginBottom: 20,
  },
  loginButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  forgotPasswordButton: {
    alignItems: 'center',
    marginBottom: 10,
  },
  forgotPasswordText: {
    color: '#0084ff',
    fontSize: 14,
  },
  createAccountButton: {
    backgroundColor: '#e0f7fa',
    paddingVertical: 12,
    borderRadius: 25,
    alignItems: 'center',
    marginBottom: 20,
  },
  createAccountButtonText: {
    color: '#0084ff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  errorText: {
    color: 'red',
    fontSize: 14,
    marginBottom: 10,
    textAlign: 'center',
  },
  faqButton: {
    alignItems: 'center',
    marginTop: 20,
  },
  faqText: {
    color: '#777',
    fontSize: 14,
  },
});

export default LoginDetailScreen;
