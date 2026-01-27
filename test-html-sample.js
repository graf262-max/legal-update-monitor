// HTML 구조 샘플링
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

async function sampleMoelHtml() {
    console.log('\n=== 고용노동부 HTML 샘플 ===');
    try {
        const res = await fetch('https://www.moel.go.kr/news/enews/report/enewsList.do', {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const html = await res.text();

        // 첫 번째 링크 주변 텍스트 확인
        const idx = html.indexOf('enewsView.do?news_seq=');
        if (idx !== -1) {
            const sample = html.substring(Math.max(0, idx - 500), idx + 200);
            console.log('Sample around first link:');
            console.log(sample);
        }
    } catch (e) {
        console.error('Error:', e.message);
    }
}

async function sampleFtcHtml() {
    console.log('\n=== 공정거래위원회 HTML 샘플 ===');
    try {
        const res = await fetch('https://www.ftc.go.kr/www/selectBbsNttList.do?bordCd=3&key=12&searchCtgry=01,02', {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const html = await res.text();

        // 첫 번째 링크 주변 텍스트 확인
        const idx = html.indexOf('selectBbsNttView.do');
        if (idx !== -1) {
            const sample = html.substring(Math.max(0, idx - 500), idx + 200);
            console.log('Sample around first link:');
            console.log(sample);
        }
    } catch (e) {
        console.error('Error:', e.message);
    }
}

async function sampleMsitHtml() {
    console.log('\n=== 과기정통부 HTML 샘플 ===');
    try {
        const res = await fetch('https://www.msit.go.kr/bbs/list.do?sCode=user&mPid=208&mId=307', {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const html = await res.text();

        // 보도자료 링크 찾기
        const idx = html.indexOf('bbs_seq_n');
        if (idx !== -1) {
            const sample = html.substring(Math.max(0, idx - 200), idx + 300);
            console.log('Sample around bbs_seq_n:');
            console.log(sample);
        } else {
            // 다른 패턴 시도
            const idx2 = html.indexOf('list-item');
            if (idx2 !== -1) {
                const sample = html.substring(Math.max(0, idx2 - 100), idx2 + 500);
                console.log('Sample around list-item:');
                console.log(sample);
            }

            // a 태그 패턴
            const aMatch = html.match(/<a[^>]*class="[^"]*title[^"]*"[^>]*>/);
            if (aMatch) {
                const idx3 = html.indexOf(aMatch[0]);
                const sample = html.substring(idx3, idx3 + 400);
                console.log('Sample around title link:');
                console.log(sample);
            }
        }
    } catch (e) {
        console.error('Error:', e.message);
    }
}

async function sampleFscHtml() {
    console.log('\n=== 금융위원회 HTML 샘플 ===');
    try {
        const res = await fetch('https://www.fsc.go.kr/no010101', {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const html = await res.text();

        // /no010101/ID 패턴 주변 확인
        const idx = html.indexOf('/no010101/');
        if (idx !== -1) {
            const sample = html.substring(Math.max(0, idx - 300), idx + 200);
            console.log('Sample around /no010101/:');
            console.log(sample);
        }
    } catch (e) {
        console.error('Error:', e.message);
    }
}

(async () => {
    await sampleMoelHtml();
    await sampleFtcHtml();
    await sampleMsitHtml();
    await sampleFscHtml();
})();
