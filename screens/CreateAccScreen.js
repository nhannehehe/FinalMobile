import React, { 
  useState, 
  useEffect, 
  useRef, 
  useCallback, 
  useMemo 
} from 'react';
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
import { sendVerificationEmail, verifyEmailCode } from '../api/authApi';

const CreateAccScreen = () => {
  const navigation = useNavigation();
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [birthday, setBirthday] = useState(new Date());
  const [gender, setGender] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [socialAccepted, setSocialAccepted] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isCodeSent, setIsCodeSent] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');

  const handleSendVerificationCode = async () => {
    if (!email || !username || !password || !phone || !firstName || !lastName || !gender) {
      return Alert.alert('Lỗi', 'Vui lòng điền đủ thông tin');
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
      await sendVerificationEmail(email);
      Alert.alert('Thành công', 'Mã xác nhận đã được gửi về email.');
      setIsCodeSent(true);
    } catch (error) {
      Alert.alert('Lỗi', 'Không thể gửi mã xác nhận: ' + error.message);
    }
  };

  const handleVerifyCodeAndRegister = async () => {
    if (!verificationCode) {
      return Alert.alert('Lỗi', 'Vui lòng nhập mã xác nhận');
    }

    const userData = {
  email,
  username,
  password,
  phone,
  firstName,
  lastName,
  birthday: birthday.toISOString().split('T')[0],
  gender,
  status: 'ACTIVE',
  code: verificationCode,
};

    try {
      await verifyEmailCode(userData);
      Alert.alert('Thành công', 'Tài khoản đã được đăng ký!', [
        { text: 'OK', onPress: () => navigation.navigate('Login') },
      ]);
    } catch (error) {
      Alert.alert('Lỗi', error.message || 'Xác minh thất bại');
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

      <KeyboardAvoidingView style={styles.keyboardAvoidingView} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollViewContent}>
          <View style={styles.content}>
            {[email, username, password, phone, firstName, lastName].map((val, idx) => (
              <TextInput
                key={idx}
                style={styles.input}
                placeholder={['Email', 'Tên người dùng', 'Mật khẩu', 'Số điện thoại', 'Tên', 'Họ'][idx]}
                value={val}
                onChangeText={[setEmail, setUsername, setPassword, setPhone, setFirstName, setLastName][idx]}
                secureTextEntry={idx === 2}
                keyboardType={idx === 0 ? 'email-address' : idx === 3 ? 'phone-pad' : 'default'}
                autoCapitalize={idx === 4 || idx === 5 ? 'words' : 'none'}
              />
            ))}

            <TouchableOpacity onPress={() => setShowDatePicker(true)} style={styles.input}>
              <Text>{birthday.toISOString().split('T')[0]}</Text>
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

            <View style={styles.genderContainer}>
              {['MALE', 'FEMALE', 'OTHER'].map((g) => (
                <TouchableOpacity key={g} style={[styles.genderOption, gender === g && styles.genderSelected]} onPress={() => setGender(g)}>
                  <Text>{g}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.checkboxContainer}>
              <TouchableOpacity style={[styles.checkbox, termsAccepted && styles.checkboxChecked]} onPress={() => setTermsAccepted(!termsAccepted)}>
                {termsAccepted && <Ionicons name="checkmark" size={16} color="white" />}
              </TouchableOpacity>
              <Text>Tôi đồng ý với các điều khoản sử dụng</Text>
            </View>

            <View style={styles.checkboxContainer}>
              <TouchableOpacity style={[styles.checkbox, socialAccepted && styles.checkboxChecked]} onPress={() => setSocialAccepted(!socialAccepted)}>
                {socialAccepted && <Ionicons name="checkmark" size={16} color="white" />}
              </TouchableOpacity>
              <Text>Tôi đồng ý với Mạng xã hội Zalo</Text>
            </View>

            {isCodeSent && (
              <TextInput
                style={styles.input}
                placeholder="Nhập mã xác nhận"
                value={verificationCode}
                onChangeText={setVerificationCode}
              />
            )}

            <TouchableOpacity style={styles.button} onPress={isCodeSent ? handleVerifyCodeAndRegister : handleSendVerificationCode}>
              <Text style={styles.buttonText}>{isCodeSent ? 'Xác nhận & Đăng ký' : 'Gửi mã xác nhận'}</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => navigation.navigate('Login')}>
              <Text style={styles.link}>Bạn đã có tài khoản? Đăng nhập ngay</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 15, borderBottomWidth: 1, borderBottomColor: '#ccc' },
  headerTitle: { marginLeft: 10, fontSize: 18, fontWeight: 'bold' },
  keyboardAvoidingView: { flex: 1 },
  scrollView: { flex: 1 },
  scrollViewContent: { paddingBottom: 40 },
  content: { padding: 15 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 5, padding: 10, marginBottom: 15 },
  genderContainer: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 15 },
  genderOption: { padding: 10, borderWidth: 1, borderColor: '#ccc', borderRadius: 5 },
  genderSelected: { backgroundColor: '#0084ff', borderColor: '#0084ff', color: 'white' },
  checkboxContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  checkbox: { width: 20, height: 20, borderWidth: 1, borderColor: '#ccc', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  checkboxChecked: { backgroundColor: '#0084ff', borderColor: '#0084ff' },
  button: { backgroundColor: '#0084ff', padding: 15, borderRadius: 5, alignItems: 'center', marginBottom: 15 },
  buttonText: { color: '#fff', fontWeight: 'bold' },
  link: { color: '#0084ff', textAlign: 'center', marginTop: 10 },
});

export default CreateAccScreen;
