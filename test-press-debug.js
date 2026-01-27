// 상세 테스트 - 왜 보도자료가 0개인지 확인
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// 제외 키워드
const EXCLUDE_KEYWORDS = ['보상', '난민', '이탈주민', '북한이탈'];
function shouldExclude(title) {
    return EXCLUDE_KEYWORDS.some(k => title.includes(k));
}

// 7일 이내 확인
function isWithin7Days(dateStr) {
    if (!dateStr) return true; // 날짜 없으면 통과
    try {
        const d = new Date(dateStr.replace(/\./g, '-'));
        const now = new Date();
        const diff = (now - d) / (1000 * 60 * 60 * 24);
        return diff <= 7 && diff >= -1;
    } catch {
        return true;
    }
}

async function debugMoelPress() {
    console.log('\n=== 고용노동부 보도자료 상세 디버그 ===');
    try {
        const res = await fetch('https://www.moel.go.kr/news/enews/report/enewsList.do', {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const html = await res.text();

        const linkRegex = /enewsView\.do\?news_seq=(\d+)/g;
        const matches = [...html.matchAll(linkRegex)];
        const seen = new Set();
        let processed = 0;
        let passedFilter = 0;

        for (const m of matches) {
            const newsSeq = m[1];
            if (seen.has(newsSeq)) continue;
            seen.add(newsSeq);
            processed++;

            const idx = html.indexOf(m[0]);
            const surroundingText = html.substring(Math.max(0, idx - 50), idx + 200);

            const titleMatch = surroundingText.match(/>\s*([^<]{10,100})\s*</);
            const title = titleMatch ? titleMatch[1].trim() : '';

            const isLabor = /근로|고용|노동|채용|임금|퇴직|산업안전|직업안정|일자리/.test(title);

            console.log(`  [${processed}] newsSeq=${newsSeq}`);
            console.log(`      title: "${title}"`);
            console.log(`      isLabor: ${isLabor}, excluded: ${shouldExclude(title)}`);

            if (title && !shouldExclude(title) && isLabor) {
                passedFilter++;
            }
        }
        console.log(`\n  총 ${processed}개 중 ${passedFilter}개 통과`);
    } catch (e) {
        console.error('Error:', e.message);
    }
}

async function debugFtcPress() {
    console.log('\n=== 공정거래위원회 보도자료 상세 디버그 ===');
    try {
        const res = await fetch('https://www.ftc.go.kr/www/selectBbsNttList.do?bordCd=3&key=12&searchCtgry=01,02', {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const html = await res.text();

        const linkRegex = /selectBbsNttView\.do[^"']*nttSn=(\d+)/g;
        const matches = [...html.matchAll(linkRegex)];
        const seen = new Set();
        let processed = 0;

        for (const m of matches) {
            const nttSn = m[1];
            if (seen.has(nttSn)) continue;
            seen.add(nttSn);
            processed++;

            const idx = html.indexOf(m[0]);
            const surroundingText = html.substring(Math.max(0, idx - 100), idx + 300);

            // 제목 추출 시도
            const titleMatch1 = surroundingText.match(/>\s*([^<]{5,150})\s*<\/a>/);
            const titleMatch2 = surroundingText.match(/title="([^"]{5,150})"/);
            const titleMatch3 = surroundingText.match(/>([^<]{5,150})</);
            const titleMatch = titleMatch1 || titleMatch2 || titleMatch3;
            const title = titleMatch ? titleMatch[1].trim() : '';

            const isFtc = /공정거래|독점|약관|하도급|가맹|표시광고|소비자|전자상거래|담합|제재|위반/.test(title);

            console.log(`  [${processed}] nttSn=${nttSn}`);
            console.log(`      title: "${title}"`);
            console.log(`      isFtc: ${isFtc}, excluded: ${shouldExclude(title)}`);
        }
    } catch (e) {
        console.error('Error:', e.message);
    }
}

async function checkMsitHtml() {
    console.log('\n=== MSIT HTML 구조 확인 ===');
    try {
        const res = await fetch('https://www.msit.go.kr/bbs/list.do?sCode=user&mPid=208&mId=307', {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const html = await res.text();

        // 링크 패턴 찾기
        console.log('Checking patterns...');

        let m = [...html.matchAll(/view\.do[^"']*nttSeqNo=(\d+)/g)];
        console.log(`Pattern view.do...nttSeqNo: ${m.length} matches`);

        m = [...html.matchAll(/nttSeqNo=(\d+)/g)];
        console.log(`Pattern nttSeqNo: ${m.length} matches`);
        if (m.length > 0) console.log('  Sample:', m[0][0]);

        m = [...html.matchAll(/bbsSeqNo=(\d+)/g)];
        console.log(`Pattern bbsSeqNo: ${m.length} matches`);
        if (m.length > 0) console.log('  Sample:', m[0][0]);

        // a 태그 찾기
        m = [...html.matchAll(/<a[^>]*href="([^"]*bbs\/view[^"]*)"/g)];
        console.log(`A tags with bbs/view: ${m.length} matches`);
        if (m.length > 0) {
            console.log('  Sample:', m[0][1].substring(0, 80));
        }
    } catch (e) {
        console.error('Error:', e.message);
    }
}

async function checkFscHtml() {
    console.log('\n=== FSC HTML 구조 확인 ===');
    try {
        const res = await fetch('https://www.fsc.go.kr/no010101', {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const html = await res.text();

        // 링크 패턴 찾기
        console.log('Checking patterns...');

        let m = [...html.matchAll(/no010101[^"']*bbsSeq=(\d+)/g)];
        console.log(`Pattern no010101...bbsSeq: ${m.length} matches`);

        m = [...html.matchAll(/bbsSeq=(\d+)/g)];
        console.log(`Pattern bbsSeq: ${m.length} matches`);
        if (m.length > 0) console.log('  Sample:', m[0][0]);

        m = [...html.matchAll(/\/no010101\/(\d+)/g)];
        console.log(`Pattern /no010101/ID: ${m.length} matches`);
        if (m.length > 0) console.log('  Sample:', m[0][0]);

        // a 태그 찾기
        m = [...html.matchAll(/<a[^>]*href="([^"]*no010101[^"]*)"/g)];
        console.log(`A tags with no010101: ${m.length} matches`);
        if (m.length > 0) {
            m.slice(0, 3).forEach(x => console.log('  ', x[1].substring(0, 60)));
        }
    } catch (e) {
        console.error('Error:', e.message);
    }
}

(async () => {
    await debugMoelPress();
    await debugFtcPress();
    await checkMsitHtml();
    await checkFscHtml();
})();
