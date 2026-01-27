// PIPC HTML 상세 분석
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

async function analyzePipc() {
    console.log('\n=== PIPC HTML 상세 분석 ===');
    try {
        const res = await fetch('https://www.pipc.go.kr/np/cop/bbs/selectBoardList.do?bbsId=BS074&mCode=C020010000', {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const html = await res.text();

        console.log('HTML length:', html.length);

        // 링크 패턴 찾기
        const linkRegex = /selectBoardArticle\.do[^"']*nttId=(\d+)/g;
        const matches = [...html.matchAll(linkRegex)];
        console.log('Found links:', matches.length);

        if (matches.length > 0) {
            console.log('Sample match:', matches[0][0].substring(0, 100));

            const seen = new Set();
            for (const m of matches) {
                const nttId = m[1];
                if (seen.has(nttId)) continue;
                seen.add(nttId);

                const idx = html.indexOf(m[0]);
                // 앞 영역에서 제목 찾기
                const surroundingText = html.substring(Math.max(0, idx - 500), idx + 100);

                console.log(`\n--- nttId: ${nttId} ---`);
                console.log(surroundingText.substring(0, 600));

                if (seen.size >= 2) break;
            }
        }

        // fn_egov_select_noticeView 함수 정의 찾기
        const fnMatch = html.match(/function\s+fn_egov_select_noticeView\s*\([^)]*\)\s*\{[^}]{0,500}/);
        if (fnMatch) {
            console.log('\n--- fn_egov_select_noticeView function ---');
            console.log(fnMatch[0]);
        }

    } catch (e) {
        console.error('Error:', e.message);
    }
}

(async () => {
    await analyzePipc();
})();
