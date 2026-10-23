// Danh sách người chơi lấy từ Appwrite
let leaderboardData = [];

// Hàm gọi dữ liệu trực tiếp từ Appwrite Collection
async function fetchLeaderboardFromAppwrite() {
    try {
        // Gọi API công khai của Appwrite (Yêu cầu collection players đã bật quyền Read cho 'Any')
        const response = await fetch(`https://fra.cloud.appwrite.io/v1/databases/6abe735d000cdcf9add0/collections/6abe73830021ac77c8ea/documents`, {
            headers: {
                'X-Appwrite-Project': '6abe6933000170bafd6d',
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();

        if (data.documents) {
            // Map dữ liệu từ Appwrite chuẩn hóa vào leaderboardData với cơ chế xử lý tiers thông minh
            leaderboardData = data.documents.map(doc => {
                let parsedTiers = { Sword: doc.tier || "Unranked" };

                if (doc.tiers) {
                    if (typeof doc.tiers === 'object') {
                        parsedTiers = doc.tiers;
                    } else if (typeof doc.tiers === 'string') {
                        try {
                            parsedTiers = JSON.parse(doc.tiers);
                        } catch (e) {
                            // Nếu người dùng gõ dạng thô như "Sword: HT1" hoặc "HT1"
                            if (doc.tiers.includes(':')) {
                                const parts = doc.tiers.split(':');
                                parsedTiers = { [parts[0].trim()]: parts[1].trim() };
                            } else {
                                parsedTiers = { Sword: doc.tiers.trim() };
                            }
                        }
                    }
                }

                return {
                    name: doc.name || doc.username || "Unknown",
                    points: doc.points || 0,
                    skin: doc.skin || doc.name || "Steve",
                    tiers: parsedTiers
                };
            });
        }

        return leaderboardData;
    } catch (error) {
        console.error("Lỗi tải dữ liệu từ Appwrite:", error);
        return [];
    }
}
