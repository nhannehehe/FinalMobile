import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const CustomTabBar = ({ state, descriptors, navigation }) => {
  return (
    <View style={styles.tabBar}>
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const label =
          options.tabBarLabel !== undefined
            ? options.tabBarLabel
            : route.name;

        const isFocused = state.index === index;

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: false,
          });

          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        let iconName;
        if (route.name === 'Tin nhắn') {
          iconName = isFocused ? 'chatbubble' : 'chatbubble-outline';
        } else if (route.name === 'Danh bạ') {
          iconName = isFocused ? 'people' : 'people-outline';
        } else if (route.name === 'Khám phá') {
          iconName = isFocused ? 'compass' : 'compass-outline';
        } else if (route.name === 'Nhật ký') {
          iconName = isFocused ? 'newspaper' : 'newspaper-outline';
        } else if (route.name === 'Cá nhân') {
          iconName = isFocused ? 'person' : 'person-outline';
        }

        return (
          <TouchableOpacity
            key={route.key}
            style={styles.tabItem}
            onPress={onPress}
          >
            <Ionicons
              name={iconName}
              size={24}
              color={isFocused ? '#0084ff' : 'gray'}
            />
            <Text
              style={[styles.tabLabel, { color: isFocused ? '#0084ff' : 'gray' }]}
            >
              {label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    height: 60,
    backgroundColor: '#f9f9f9',
    borderTopWidth: 1,
    borderTopColor: '#ccc',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    fontSize: 12,
    marginTop: 2,
  },
});

export default CustomTabBar;