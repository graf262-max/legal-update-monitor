// MSIT data-value와 실제 링크 연결 분석
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

async function analyzeMsitDataValue() {
    console.log('\n=== MSIT data-value 분석 ===');
    try {
        const res = await fetch('https://www.msit.go.kr/bbs/list.do?sCode=user&mPid=208&mId=307', {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const html = await res.text();

        // data-value 주변 컨텍스트 확인
        const dataValueMatches = [...html.matchAll(/data-value="(\d+)"/g)];
        const seen = new Set();

        for (const m of dataValueMatches) {
            const id = m[1];
            if (seen.has(id)) continue;
            seen.add(id);

            const idx = html.indexOf(`data-value="${id}"`);
            const surroundingText = html.substring(Math.max(0, idx - 300), idx + 200);

            console.log(`\n--- ID: ${id} ---`);
            console.log(surroundingText.substring(0, 500));

            if (seen.size >= 3) break;
        }

        // fn_view 함수 정의 찾기
        const fnViewMatch = html.match(/function\s+fn_view\s*\([^)]*\)\s*\{[^}]{0,500}/);
        if (fnViewMatch) {
            console.log('\n--- fn_view function definition ---');
            console.log(fnViewMatch[0]);
        }

        // view.do 관련 모든 패턴
        const viewDoMatches = [...html.matchAll(/view\.do[^'")\s]{0,100}/g)];
        console.log('\n--- view.do patterns ---');
        const seenViews = new Set();
        for (const m of viewDoMatches) {
            if (seenViews.has(m[0])) continue;
            seenViews.add(m[0]);
            console.log(m[0]);
        }

    } catch (e) {
        console.error('Error:', e.message);
    }
}

(async () => {
    await analyzeMsitDataValue();
})();
