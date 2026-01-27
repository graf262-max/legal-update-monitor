// MSIT 목록 구조 분석
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

async function analyzeMsitList() {
    console.log('\n=== MSIT 목록 상세 분석 ===');
    try {
        const res = await fetch('https://www.msit.go.kr/bbs/list.do?sCode=user&mPid=208&mId=307', {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const html = await res.text();

        // tbody 찾기
        const tbodyIdx = html.indexOf('<tbody>');
        if (tbodyIdx !== -1) {
            const tbodyEnd = html.indexOf('</tbody>', tbodyIdx);
            const tbody = html.substring(tbodyIdx, tbodyEnd + 8);

            console.log('tbody length:', tbody.length);

            // 첫 번째 tr 구조 확인
            const trMatch = tbody.match(/<tr[^>]*>([\s\S]*?)<\/tr>/);
            if (trMatch) {
                console.log('\n--- First TR structure ---');
                console.log(trMatch[0].substring(0, 1000));
            }

            // onclick 패턴 찾기
            const onclickMatches = [...tbody.matchAll(/onclick="([^"]+)"/g)];
            console.log('\n--- onClick patterns ---');
            onclickMatches.slice(0, 5).forEach(m => console.log(m[1]));

            // fn_view 같은 함수 호출 패턴
            const fnMatches = [...tbody.matchAll(/fn_\w+\([^)]*\)/g)];
            console.log('\n--- Function call patterns ---');
            fnMatches.slice(0, 5).forEach(m => console.log(m[0]));
        }

        // 실제 데이터 ID 찾기
        const seqMatches = [...html.matchAll(/fn_view\s*\(\s*['"]?(\d+)['"]?\s*\)/g)];
        console.log('\n--- fn_view IDs ---');
        seqMatches.slice(0, 10).forEach(m => console.log(m[1]));

        // data-* 속성 찾기
        const dataMatches = [...html.matchAll(/data-\w+="(\d+)"/g)];
        console.log('\n--- data attributes ---');
        dataMatches.slice(0, 10).forEach(m => console.log(m[0]));

    } catch (e) {
        console.error('Error:', e.message);
    }
}

(async () => {
    await analyzeMsitList();
})();
