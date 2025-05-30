const sendFiles = async (files) => {
  const latestToken = await getAccessToken();
  if (!latestToken) {
    Alert.alert('Lỗi', 'Vui lòng đăng nhập để gửi file.');
    return;
  }
  // Kiểm tra token có hợp lệ không
  try {
    const tokenPayload = JSON.parse(atob(latestToken.split('.')[1]));
    const expirationTime = tokenPayload.exp * 1000; // Convert to milliseconds
    if (Date.now() >= expirationTime) {
      Alert.alert('Phiên đăng nhập hết hạn', 'Vui lòng đăng nhập lại để tiếp tục.', [
        {
          text: 'Đăng nhập lại',
          onPress: () => navigation.navigate('Login'),
        },
      ]);
      return;
    }
  } catch (error) {
    console.error('Lỗi kiểm tra token:', error);
    Alert.alert('Lỗi xác thực', 'Vui lòng đăng nhập lại để tiếp tục.', [
      {
        text: 'Đăng nhập lại',
        onPress: () => navigation.navigate('Login'),
      },
    ]);
    return;
  }
  setIsSending(true);
  try {
    // Nếu là ảnh, nén lại trước khi upload và đổi tên file về .jpg.jpg.jpg
    const filesToUpload = await Promise.all(files.map(async (file) => {
      if (file.type && file.type.startsWith('image/')) {
        let format = 'jpeg';
        let name = file.name;

        name = name.replace(/\.(heic|HEIC|jpeg|JPEG|png|PNG|jpg|JPG)+$/gi, '') + '.jpg.jpg';
        const manipResult = await manipulateAsync(
          file.uri,
          [{ resize: { width: MAX_IMAGE_SIZE, height: MAX_IMAGE_SIZE } }],
          { compress: MAX_IMAGE_QUALITY, format }
        );
        return {
          uri: manipResult.uri,
          name,
          type: 'image/jpeg',
        };
      }
      return file;
    }));
    const totalFiles = filesToUpload.length;
    let completedFiles = 0;
    console.log('Token upload:', latestToken);
    const fileUrls = await uploadFile(filesToUpload, otherUserId, latestToken, groupId, (progress) => {
      // Nếu muốn progress thì xử lý ở đây
    });
    if (!Array.isArray(fileUrls)) {
      throw new Error('uploadFile không trả về mảng URL hợp lệ.');
    }
    setImagePickerModalVisible(false);
    setSelectedImageIds(new Set());
    Alert.alert('Thành công', 'File đã được gửi thành công!');
    
    // Load lại lịch sử chat sau khi gửi thành công
    await loadChatHistory();
    
  } catch (error) {
    console.error('Lỗi gửi file:', error);
    let errorMessage = 'Không thể gửi file. ';
    if (error.response) {
      switch (error.response.status) {
        case 401:
        case 403:
          errorMessage += 'Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.';
          break;
        case 413:
          errorMessage += 'File quá lớn. Vui lòng chọn file nhỏ hơn.';
          break;
        default:
          errorMessage += error.response.data?.message || 'Vui lòng thử lại sau.';
      }
    } else if (error.request) {
      errorMessage += 'Không thể kết nối đến server. Vui lòng kiểm tra kết nối mạng.';
    } else {
      errorMessage += error.message || 'Vui lòng thử lại sau.';
    }
    Alert.alert(
      'Lỗi',
      errorMessage,
      [
        {
          text: 'Thử lại',
          onPress: () => sendFiles(files),
        },
        {
          text: 'Hủy',
          style: 'cancel',
          onPress: () => {
            setImagePickerModalVisible(false);
            setSelectedImageIds(new Set());
          },
        },
      ]
    );
  } finally {
    setIsSending(false);
  }
}; 