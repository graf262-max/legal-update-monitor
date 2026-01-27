// FTC와 MSIT HTML 샘플 상세 분석
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

async function sampleFtc() {
    console.log('\n=== FTC HTML 샘플 ===');
    try {
        const res = await fetch('https://www.ftc.go.kr/www/selectBbsNttList.do?bordCd=3&key=12&searchCtgry=01,02', {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const html = await res.text();

        const linkIdx = html.indexOf('selectBbsNttView.do');
        if (linkIdx !== -1) {
            // 링크 앞쪽 더 많이 확인
            const sample = html.substring(Math.max(0, linkIdx - 500), linkIdx + 400);
            console.log('Sample around first link (before and after):');
            console.log(sample);
        }
    } catch (e) {
        console.error('Error:', e.message);
    }
}

async function sampleMsit() {
    console.log('\n=== MSIT HTML 샘플 ===');
    try {
        const res = await fetch('https://www.msit.go.kr/bbs/list.do?sCode=user&mPid=208&mId=307', {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const html = await res.text();

        const fnIdx = html.indexOf('fn_detail(3186801)');
        if (fnIdx !== -1) {
            // 함수 호출 이후 텍스트 확인
            const sample = html.substring(fnIdx, fnIdx + 800);
            console.log('Sample after fn_detail:');
            console.log(sample);
        }
    } catch (e) {
        console.error('Error:', e.message);
    }
}

async function sampleFsc() {
    console.log('\n=== FSC HTML 샘플 ===');
    try {
        const res = await fetch('https://www.fsc.go.kr/no010101', {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const html = await res.text();

        const linkIdx = html.indexOf('/no010101/');
        if (linkIdx !== -1) {
            // 링크 주변 더 넓게 확인
            const sample = html.substring(Math.max(0, linkIdx - 300), linkIdx + 300);
            console.log('Sample around /no010101/:');
            console.log(sample);
        }
    } catch (e) {
        console.error('Error:', e.message);
    }
}

(async () => {
    await sampleFtc();
    await sampleMsit();
    await sampleFsc();
})();
