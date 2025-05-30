import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { register } from '../api/authApi';

const CreateAccScreen = () => {
  const navigation = useNavigation();
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [birthday, setBirthday] = useState(new Date());
  const [gender, setGender] = useState(''); // Chỉ cho phép 1 lựa chọn
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [socialAccepted, setSocialAccepted] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const handleRegister = async () => {
    if (!email || !username || !password || !phone || !firstName || !lastName || !gender) {
      return Alert.alert('Lỗi', 'Vui lòng điền đầy đủ thông tin');
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return Alert.alert('Lỗi', 'Email không hợp lệ');
    }

    const phoneRegex = /^\d{10}$/;
    if (!phoneRegex.test(phone)) {
      return Alert.alert('Lỗi', 'Số điện thoại phải là 10 chữ số');
    }

    if (!termsAccepted || !socialAccepted) {
      return Alert.alert('Lỗi', 'Vui lòng đồng ý với các điều khoản');
    }

    try {
      const userData = {
        email,
        username,
        password,
        phone,
        firstName,
        lastName,
        birthday: birthday.getFullYear() + '-' + String(birthday.getMonth() + 1).padStart(2, '0') + '-' + String(birthday.getDate()).padStart(2, '0'),
        gender,
        status: 'ACTIVE',
      };
      console.log('Register request:', userData);
      await register(userData);
      Alert.alert('Thành công', 'Đăng ký thành công!', [
        { text: 'OK', onPress: () => navigation.navigate('Login') },
      ]);
    } catch (error) {
      const errorMessage = error.message || 'Đăng ký thất bại. Vui lòng kiểm tra lại.';
      if (error.message.includes('already exists')) {
        Alert.alert('Lỗi', error.message);
      } else {
        Alert.alert('Lỗi', errorMessage);
      }
    }
  };

  const onDateChange = (event, selectedDate) => {
    if (selectedDate) {
      setBirthday(selectedDate);
    }
    setShowDatePicker(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="black" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Tạo tài khoản mới</Text>
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollViewContent}
        >
          <View style={styles.content}>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder="Email"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                underlineColorAndroid="transparent"
              />
            </View>

            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder="Tên người dùng"
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                underlineColorAndroid="transparent"
              />
            </View>

            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder="Mật khẩu"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                underlineColorAndroid="transparent"
              />
            </View>

            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder="Số điện thoại"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                underlineColorAndroid="transparent"
              />
            </View>

            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder="Tên"
                value={firstName}
                onChangeText={setFirstName}
                autoCapitalize="words"
                underlineColorAndroid="transparent"
              />
            </View>

            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder="Họ"
                value={lastName}
                onChangeText={setLastName}
                autoCapitalize="words"
                underlineColorAndroid="transparent"
              />
            </View>

            <View style={[styles.inputContainer, styles.dateContainer]}>
              <TouchableOpacity onPress={() => setShowDatePicker(true)}>
                <Text style={styles.centeredDateText}>
                  {birthday.getFullYear() + '-' + String(birthday.getMonth() + 1).padStart(2, '0') + '-' + String(birthday.getDate()).padStart(2, '0')}
                </Text>
              </TouchableOpacity>
              {showDatePicker && (
                <DateTimePicker
                  value={birthday}
                  mode="date"
                  display="default"
                  onChange={onDateChange}
                  maximumDate={new Date()}
                />
              )}
            </View>

            <View style={[styles.inputContainer, styles.genderContainer]}>
              <View style={styles.checkboxGroup}>
                <TouchableOpacity
                  style={[styles.checkbox, gender === 'MALE' && styles.checkboxChecked]}
                  onPress={() => setGender('MALE')}
                >
                  {gender === 'MALE' && <Ionicons name="checkmark" size={16} color="white" />}
                </TouchableOpacity>
                <Text style={styles.checkboxLabel}>Nam (Male)</Text>
              </View>
              <View style={styles.checkboxGroup}>
                <TouchableOpacity
                  style={[styles.checkbox, gender === 'FEMALE' && styles.checkboxChecked]}
                  onPress={() => setGender('FEMALE')}
                >
                  {gender === 'FEMALE' && <Ionicons name="checkmark" size={16} color="white" />}
                </TouchableOpacity>
                <Text style={styles.checkboxLabel}>Nữ (Female)</Text>
              </View>
              <View style={styles.checkboxGroup}>
                <TouchableOpacity
                  style={[styles.checkbox, gender === 'OTHER' && styles.checkboxChecked]}
                  onPress={() => setGender('OTHER')}
                >
                  {gender === 'OTHER' && <Ionicons name="checkmark" size={16} color="white" />}
                </TouchableOpacity>
                <Text style={styles.checkboxLabel}>Khác (Other)</Text>
              </View>
            </View>

            <View style={[styles.inputContainer, styles.statusContainer]}>
              <Text style={styles.fadedStatusText}>STATUS:ACTIVE</Text>
            </View>

            <View style={styles.checkboxContainer}>
              <TouchableOpacity
                style={[styles.checkbox, termsAccepted && styles.checkboxChecked]}
                onPress={() => setTermsAccepted(!termsAccepted)}
              >
                {termsAccepted && <Ionicons name="checkmark" size={16} color="white" />}
              </TouchableOpacity>
              <Text style={styles.checkboxText}>
                Tôi đồng ý với các{' '}
                <Text style={styles.linkText}>điều khoản sử dụng Zalo</Text>
              </Text>
            </View>

            <View style={styles.checkboxContainer}>
              <TouchableOpacity
                style={[styles.checkbox, socialAccepted && styles.checkboxChecked]}
                onPress={() => setSocialAccepted(!socialAccepted)}
              >
                {socialAccepted && <Ionicons name="checkmark" size={16} color="white" />}
              </TouchableOpacity>
              <Text style={styles.checkboxText}>
                Tôi đồng ý với điều khoản{' '}
                <Text style={styles.linkText}>Mạng xã hội của Zalo</Text>
              </Text>
            </View>

            <TouchableOpacity style={styles.continueButton} onPress={handleRegister}>
              <Text style={styles.continueButtonText}>Đăng ký</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.loginLink}
              onPress={() => navigation.navigate('Login')}
            >
              <Text style={styles.loginLinkText}>
                Bạn đã có tài khoản?{' '}
                <Text style={styles.linkText}>Đăng nhập ngay</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
    color: 'black',
    marginLeft: 10,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    flexGrow: 1,
    paddingBottom: 40,
  },
  content: {
    paddingHorizontal: 15,
    paddingTop: 50,
  },
  inputContainer: {
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
    paddingHorizontal: 10,
    justifyContent: 'center',
  },
  dateContainer: {
    height: 50,
  },
  genderContainer: {
    height: 50,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  checkboxGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  input: {
    height: 40,
    outlineStyle: 'none',
  },
  centeredDateText: {
    height: 50,
    textAlign: 'center',
    lineHeight: 50,
    outlineStyle: 'none',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#ccc',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 5,
  },
  checkboxChecked: {
    backgroundColor: '#0084ff',
    borderColor: '#0084ff',
  },
  checkboxLabel: {
    fontSize: 14,
    color: '#333',
  },
  fadedStatusText: {
    color: '#ccc',
    opacity: 0.5,
    fontSize: 14,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  checkboxText: {
    fontSize: 14,
    color: '#333',
  },
  linkText: {
    color: '#0084ff',
    fontWeight: 'bold',
  },
  continueButton: {
    backgroundColor: '#0084ff',
    paddingVertical: 12,
    borderRadius: 25,
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 20,
  },
  continueButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  loginLink: {
    alignItems: 'center',
    marginBottom: 20,
  },
  loginLinkText: {
    fontSize: 14,
    color: '#333',
  },
});

export default CreateAccScreen;