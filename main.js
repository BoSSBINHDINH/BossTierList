// Client-side leaderboard helper; MongoDB is accessed only through the server API.
let leaderboardData = [];

async function fetchLeaderboardFromMongoDB() {
    try {
        const apiBase = String(window.BOSSTIER_API_BASE || '').replace(/\/+$/, '');
        const response = await fetch(`${apiBase}/api/players`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();

        if (Array.isArray(data.players)) {
            leaderboardData = data.players.map(doc => {
                let tiers = doc.tiers || { Sword: doc.tier || 'Unranked' };
                if (typeof tiers === 'string') {
                    try {
                        tiers = JSON.parse(tiers);
                    } catch {
                        const separator = tiers.indexOf(':');
                        tiers = separator > 0
                            ? { [tiers.slice(0, separator).trim()]: tiers.slice(separator + 1).trim() }
                            : { Sword: tiers.trim() };
                    }
                }
                return {
                    name: doc.name || doc.username || 'Unknown',
                    points: Number(doc.points) || 0,
                    skin: doc.skin || doc.name || doc.username || 'Steve',
                    tiers
                };
            });
        }
        return leaderboardData;
    } catch (error) {
        console.error('Lỗi tải dữ liệu từ MongoDB API:', error);
        return [];
    }
}
