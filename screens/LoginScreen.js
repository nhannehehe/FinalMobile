import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  TouchableOpacity,
} from 'react-native';
import { useNavigation } from '@react-navigation/native'; // Import useNavigation

const LoginScreen = () => {
  const navigation = useNavigation(); // Lấy đối tượng navigation

  return (
    <SafeAreaView style={styles.container}>

      <Text style={styles.logo}>Zalo</Text>

      <TouchableOpacity
        style={styles.loginButton}
        onPress={() => navigation.navigate('LoginDetail')}
      >
        <Text style={styles.loginButtonText}>Đăng nhập</Text>
      </TouchableOpacity>

      {/* Create Account Button */}
      <TouchableOpacity
        style={styles.createAccountButton}
        onPress={() => navigation.navigate('CreateAcc')}
      >
        <Text style={styles.createAccountButtonText}>Tạo tài khoản mới</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
  },
  languageButton: {
    position: 'absolute',
    top: 20,
    right: 20,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ccc',
  },
  languageText: {
    color: '#333',
  },
  logo: {
    fontSize: 60,
    fontWeight: 'bold',
    color: '#0084ff',
    marginBottom: 50,
  },
  dotsContainer: {
    flexDirection: 'row',
    marginBottom: 50,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#ccc',
    marginHorizontal: 5,
  },
  dotActive: {
    backgroundColor: '#0084ff',
  },
  loginButton: {
    backgroundColor: '#0084ff',
    paddingVertical: 15,
    paddingHorizontal: 100,
    borderRadius: 30,
    marginBottom: 15,
  },
  loginButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  createAccountButton: {
    backgroundColor: '#f0f0f0',
    paddingVertical: 15,
    paddingHorizontal: 80,
    borderRadius: 30,
  },
  createAccountButtonText: {
    color: '#333',
    fontSize: 16,
  },
});

export default LoginScreen;