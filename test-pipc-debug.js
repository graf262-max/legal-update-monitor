// PIPC 특정 항목 디버깅
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const EXCLUDE_KEYWORDS = ['보상', '난민', '이탈주민', '북한이탈'];
function shouldExclude(title) {
    return EXCLUDE_KEYWORDS.some(k => title.includes(k));
}

function isWithin7Days(dateStr) {
    if (!dateStr) return true;
    try {
        const d = new Date(dateStr.replace(/\./g, '-'));
        const now = new Date();
        const diff = (now - d) / (1000 * 60 * 60 * 24);
        console.log(`  Date: ${dateStr}, Diff: ${diff.toFixed(1)} days, Within 7 days: ${diff <= 7 && diff >= -1}`);
        return diff <= 7 && diff >= -1;
    } catch {
        return true;
    }
}

async function debugPipc() {
    console.log('\n=== PIPC 디버깅 ===');
    console.log('현재 시간:', new Date().toISOString());

    try {
        const res = await fetch('https://www.pipc.go.kr/np/cop/bbs/selectBoardList.do?bbsId=BS074&mCode=C020010000', {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const html = await res.text();

        const linkTitleRegex = /<a\s+href="[^"]*nttId=(\d+)"[^>]*>([^<]+)</g;
        const matches = [...html.matchAll(linkTitleRegex)];
        const dateMatches = [...html.matchAll(/<td>(\d{4}-\d{2}-\d{2})<\/td>/g)];

        const seen = new Set();
        let dateIdx = 0;

        console.log('\n모든 항목 분석:');
        for (const m of matches) {
            const nttId = m[1];
            const title = m[2].trim();

            if (seen.has(nttId)) continue;
            seen.add(nttId);

            const dateStr = dateMatches[dateIdx] ? dateMatches[dateIdx][1] : '';
            dateIdx++;

            console.log(`\n--- nttId=${nttId} ---`);
            console.log(`  제목: "${title}"`);

            const within7 = isWithin7Days(dateStr);
            const excluded = shouldExclude(title);

            // 키워드 매칭 확인
            const isPipc = /개인정보|정보보호|정보통신망|데이터|보호법|기업정보|유출/.test(title);
            console.log(`  키워드 매칭: ${isPipc}`);
            console.log(`  제외 키워드: ${excluded}`);
            console.log(`  최종 수집 여부: ${within7 && !excluded && isPipc ? '✅ 수집됨' : '❌ 필터됨'}`);

            if (!isPipc) {
                console.log(`  >> 키워드 미매칭! 제목에 '개인정보', '정보보호', '데이터' 등 없음`);
            }
        }

    } catch (e) {
        console.error('Error:', e.message);
    }
}

(async () => {
    await debugPipc();
})();
