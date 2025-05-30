import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, View, Text, FlatList, TouchableOpacity, Image, Alert, ActivityIndicator, SafeAreaView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../config';

// --- Placeholders ---
const getAuthToken = async () => { /* ... implementation như cũ ... */
    try { const token = await AsyncStorage.getItem('accessToken'); return token; } catch (e) { console.error('Lỗi lấy token:', e); return null; }
};
// --- End Placeholders ---

const FriendRequestsScreen = ({ navigation }) => {
    const [pendingRequests, setPendingRequests] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isProcessing, setIsProcessing] = useState(null);

    // Hàm fetch lời mời (giữ nguyên, log vẫn hữu ích)
    const fetchPendingRequests = useCallback(async () => {
        console.log("Bắt đầu fetch danh sách lời mời...");
        setIsLoading(true);
        try {
            const token = await getAuthToken();
            if (!token) { Alert.alert('Lỗi', 'Token không tìm thấy.'); setIsLoading(false); return; }

            const url = `${API_BASE_URL}/friend/requests/pending`;
            console.log("Gọi API:", url);
            const response = await axios.get(url, { headers: { Authorization: `Bearer ${token}` } });

            console.log("Dữ liệu lời mời nhận được từ API:", JSON.stringify(response.data, null, 2));

            if (Array.isArray(response.data)) {
                setPendingRequests(response.data);
            } else {
                console.warn("API /friend/requests/pending không trả về mảng:", response.data);
                setPendingRequests([]);
            }
        } catch (error) {
             console.error("Lỗi khi lấy danh sách lời mời:", error.response ? JSON.stringify(error.response.data) : error.message);
             let errorMsg = 'Không thể tải danh sách lời mời.';
             if (error.response) { /* ... xử lý lỗi status code ... */ }
             else if (error.request) { errorMsg = 'Không thể kết nối máy chủ.'; }
             Alert.alert('Lỗi', errorMsg);
             setPendingRequests([]);
        } finally {
            setIsLoading(false);
            console.log("Kết thúc fetch danh sách lời mời.");
        }
    }, []);

    // useEffect (giữ nguyên)
    useEffect(() => {
        fetchPendingRequests();
        const unsubscribe = navigation.addListener('focus', fetchPendingRequests);
        return unsubscribe;
    }, [fetchPendingRequests, navigation]);

    // handleAcceptRequest (chỉnh sửa để dùng item.id)
    const handleAcceptRequest = async (requestId) => {
        if (!requestId) { console.error("handleAcceptRequest: requestId không hợp lệ!"); return; }
        setIsProcessing(requestId);
        try {
            const token = await getAuthToken(); if (!token) throw new Error("Token not found");
            // Sử dụng requestId (là item.id)
            const url = `${API_BASE_URL}/friend/request/${requestId}/accept`;
            await axios.post(url, null, { headers: { Authorization: `Bearer ${token}` } });
            Alert.alert('Thành công', 'Đã chấp nhận lời mời kết bạn.');
            // Cập nhật state trực tiếp
            setPendingRequests(prev => prev.filter(req => req.id !== requestId));
        } catch (error) { /* ... xử lý lỗi ... */ }
        finally { setIsProcessing(null); }
    };

     // handleDeclineRequest (chỉnh sửa để dùng item.id)
    const handleDeclineRequest = async (requestId) => {
         if (!requestId) { console.error("handleDeclineRequest: requestId không hợp lệ!"); return; }
        setIsProcessing(requestId);
        try {
            const token = await getAuthToken(); if (!token) throw new Error("Token not found");
             // Sử dụng requestId (là item.id)
            const url = `${API_BASE_URL}/friend/request/${requestId}/cancel`;
            await axios.post(url, null, { headers: { Authorization: `Bearer ${token}` } });
            Alert.alert('Thông báo', 'Đã từ chối/hủy lời mời.');
             // Cập nhật state trực tiếp
            setPendingRequests(prev => prev.filter(req => req.id !== requestId));
        } catch (error) { /* ... xử lý lỗi ... */ }
        finally { setIsProcessing(null); }
    };


    // *** RENDER ITEM ĐÃ ĐƯỢC CHỈNH SỬA ***
    const renderRequestItem = ({ item }) => {
        if (!item) {
             console.warn("renderRequestItem: item is null or undefined");
             return null;
        }
        // Lấy ID lời mời từ trường 'id'
        const requestId = item.id;
        // Lấy ID người gửi từ trường 'senderId'
        const senderId = item.senderId;

        // Kiểm tra các trường cần thiết (ít nhất là ID lời mời và ID người gửi)
        if (!requestId || !senderId) {
             console.warn("renderRequestItem: Bỏ qua item bị thiếu id hoặc senderId:", item);
             return null;
        }

        const isCurrentlyProcessing = isProcessing === requestId;

        // !!! LƯU Ý: Hiện tại chúng ta chỉ có senderId, chưa có username và avatar !!!
        // Tạm thời sẽ hiển thị senderId thay cho username

        return (
            <View style={styles.requestItem}>
                 {/* Ảnh đại diện tạm thời */}
                 <Image
                     source={{ uri: 'https://via.placeholder.com/45' }} // Ảnh mặc định
                     style={styles.avatar}
                 />
                 {/* Hiển thị tạm senderId */}
                <Text style={styles.senderName}>ID: {senderId}</Text>
                <View style={styles.requestActions}>
                     {isCurrentlyProcessing ? ( <ActivityIndicator size="small" color="#0084ff" /> )
                     : ( <>
                             <TouchableOpacity
                                style={[styles.actionButton, styles.declineButton]}
                                onPress={() => handleDeclineRequest(requestId)}
                                disabled={isCurrentlyProcessing}
                            >
                                <Text style={styles.declineButtonText}>Từ chối</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.actionButton, styles.acceptButton]}
                                onPress={() => handleAcceptRequest(requestId)}
                                disabled={isCurrentlyProcessing}
                            >
                                <Text style={styles.acceptButtonText}>Chấp nhận</Text>
                            </TouchableOpacity>
                         </>
                     )}
                </View>
            </View>
        );
    };

     return (
        <SafeAreaView style={styles.container}>
            {/* Header (giữ nguyên) */}
             <View style={styles.screenHeader}>
                 <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                      <Ionicons name="arrow-back" size={24} color="#0084ff" />
                 </TouchableOpacity>
                 <Text style={styles.screenTitle}>Lời mời kết bạn</Text>
             </View>

            {/* FlatList (cập nhật keyExtractor) */}
            {isLoading ? ( <ActivityIndicator size="large" color="#0084ff" style={styles.loader} /> )
            : ( <FlatList
                    data={pendingRequests}
                    renderItem={renderRequestItem}
                    // *** SỬ DỤNG item.id VÀ LÀM AN TOÀN HƠN ***
                    keyExtractor={(item, index) => item?.id?.toString() || `req-${index}`}
                    ListEmptyComponent={<Text style={styles.emptyListText}>Không có lời mời kết bạn nào.</Text>}
                />
            )}
        </SafeAreaView>
    );
};

// --- Styles (Giữ nguyên) ---
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff' },
    screenHeader: { flexDirection: 'row', alignItems: 'center', padding: 15, borderBottomWidth: 1, borderBottomColor: '#eee', backgroundColor: '#fff' },
    backButton: { marginRight: 15, padding: 5 },
    screenTitle: { fontSize: 18, fontWeight: 'bold', color: '#333' },
    loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    requestItem: { flexDirection: 'row', alignItems: 'center', padding: 15, borderBottomWidth: 1, borderBottomColor: '#eee' },
    avatar: { width: 45, height: 45, borderRadius: 22.5, marginRight: 15, backgroundColor: '#eee' }, // Thêm màu nền cho avatar tạm
    senderName: { flex: 1, fontSize: 16, fontWeight: '500', color: '#555' }, // Đổi màu chữ ID
    requestActions: { flexDirection: 'row', alignItems: 'center' },
    actionButton: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 5, marginLeft: 8 },
    acceptButton: { backgroundColor: '#0084ff' },
    acceptButtonText: { color: '#fff', fontWeight: 'bold' },
    declineButton: { borderWidth: 1, borderColor: '#ccc' },
    declineButtonText: { color: '#333' },
    emptyListText: { textAlign: 'center', marginTop: 50, fontSize: 16, color: '#888' },
});

export default FriendRequestsScreen;