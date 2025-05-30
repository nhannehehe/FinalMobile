import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { View, Text, StyleSheet } from 'react-native';

// Import các màn hình
import ChatListScreen from '../screens/ChatListScreen';
import ContactsScreen from '../screens/ContactsScreen';
import ProfileScreen from '../screens/ProfileScreen';
import UserProfileScreen from '../screens/UserProfileScreen';
import LoginScreen from '../screens/LoginScreen';
import LoginDetailScreen from '../screens/LoginDetailScreen';
import CreateAccScreen from '../screens/CreateAccScreen';
import RegistrationDetailScreen from '../screens/RegistrationDetailScreen';
import SettingsScreen from '../screens/SettingsScreen';
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen';
import ResetPasswordScreen from '../screens/ResetPasswordScreen';
import FriendRequestsScreen from '../screens/FriendRequestsScreen';
import ChatRoomScreen from '../screens/ChatRoomScreen';




const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

const AppNavigator = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false, // Ẩn header của Stack Navigator
      }}
    >
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="LoginDetail" component={LoginDetailScreen} />
      <Stack.Screen name="MainTabs" component={MainTabs} />
      <Stack.Screen name="UserProfile" component={UserProfileScreen} />
      <Stack.Screen name="CreateAcc" component={CreateAccScreen} />
      <Stack.Screen name="RegistrationDetail" component={RegistrationDetailScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} /> 
      <Stack.Screen name="ChatList" component={ChatListScreen} /> 
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
      <Stack.Screen name="Contacts" component={ContactsScreen} />
      <Stack.Screen name="FriendRequestsScreen" component={FriendRequestsScreen} />
      <Stack.Screen name="ChatRoomScreen" component={ChatRoomScreen} />





    </Stack.Navigator>
  );
};

const MainTabs = ({ route }) => {
  // Lấy username từ route.params (nếu có)
  const username = route.params?.username;
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;
          let label;

          if (route.name === 'Tin nhắn') {
            iconName = focused ? 'chatbubble' : 'chatbubble-outline';
            label = 'Tin nhắn';
          } else if (route.name === 'Danh bạ') {
            iconName = focused ? 'people' : 'people-outline';
            label = 'Danh bạ';

          } else if (route.name === 'Cá nhân') {
            iconName = focused ? 'person' : 'person-outline';
            label = 'Cá nhân';
          }

          return (
            <View style={styles.tabItemContainer}>
              <Ionicons name={iconName} size={size} color={color} />
              <Text style={styles.tabLabel}>{label}</Text>
            </View>
          );
        },
        tabBarLabel: () => null, // Ẩn label mặc định
        tabBarActiveTintColor: '#0084ff',
        tabBarInactiveTintColor: 'gray',
        tabBarStyle: {
          height: 60, // Chiều cao thanh tab bar
          paddingTop: 5,
          paddingBottom: 5,
        },
      })}
    >
      <Tab.Screen
        name="Tin nhắn"
        component={ChatListScreen}
        options={{
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons
              name={focused ? 'chatbubble' : 'chatbubble-outline'}
              size={size}
              color={color}
            />
          ),
          tabBarLabel: 'Tin nhắn',
        }}
      />
      <Tab.Screen
        name="Danh bạ"
        component={ContactsScreen}
        options={{
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons
              name={focused ? 'people' : 'people-outline'}
              size={size}
              color={color}
            />
          ),
          tabBarLabel: 'Danh bạ',
        }}
      />
      
      <Tab.Screen
        name="Cá nhân"
        component={ProfileScreen}
        options={{
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons
              name={focused ? 'person' : 'person-outline'}
              size={size}
              color={color}
            />
          ),
          tabBarLabel: 'Cá nhân',
        }}
      />
    </Tab.Navigator>
  );
};

const styles = StyleSheet.create({
  tabItemContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    fontSize: 12,
    color: 'gray',
    marginTop: 2,
  },
});

export default AppNavigator;