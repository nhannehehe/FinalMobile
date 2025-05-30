import React, { useState } from 'react';
import { View, Text, TextInput, Button, Alert } from 'react-native';
import { requestPasswordReset } from '../api/authApi';

const ForgotPasswordScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');

  const handleSendCode = async () => {
    if (!email) return Alert.alert("Lỗi", "Vui lòng nhập email");

    // Kiểm tra định dạng email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return Alert.alert("Lỗi", "Email không hợp lệ");
    }

    try {
      await requestPasswordReset(email);
      Alert.alert("Thành công", "Mã xác nhận đã được gửi về email");
      navigation.navigate("ResetPassword", { email });
    } catch (error) {
      const errorMessage = error.message || "Không thể gửi mã xác nhận. Vui lòng thử lại.";
      Alert.alert("Thất bại", errorMessage);
    }
  };

  return (
    <View style={{ padding: 20 }}>
      <Text>Nhập Email của bạn:</Text>
      <TextInput
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        style={{ borderWidth: 1, borderColor: '#ccc', marginVertical: 10, padding: 10 }}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <Button title="Gửi mã xác nhận" onPress={handleSendCode} />
    </View>
  );
};

export default ForgotPasswordScreen;