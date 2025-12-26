/**
 * 관리 대상 법률 목록 및 키워드 설정
 */

// 관리 대상 법률 (본법 + 시행령/시행규칙/고시 포함)
export const TARGET_LAWS = [
    {
        name: '상법',
        keywords: ['상법', '상법 시행령', '상법 시행규칙'],
        category: '상거래'
    },
    {
        name: '민법',
        keywords: ['민법', '민법 시행령', '민법 시행규칙'],
        category: '일반'
    },
    {
        name: '개인정보 보호법',
        keywords: ['개인정보 보호법', '개인정보보호법', '개인정보 보호법 시행령', '개인정보 보호법 시행규칙'],
        category: '개인정보'
    },
    {
        name: '직업안정법',
        keywords: ['직업안정법', '직업안정법 시행령', '직업안정법 시행규칙'],
        category: '노동'
    },
    {
        name: '정보통신망 이용촉진 및 정보보호 등에 관한 법률',
        shortName: '정보통신망법',
        keywords: ['정보통신망', '정보통신망법', '정보통신망 이용촉진'],
        category: 'IT/정보보호'
    },
    {
        name: '전자금융거래법',
        keywords: ['전자금융거래법', '전자금융거래법 시행령', '전자금융거래법 시행규칙'],
        category: '금융'
    },
    {
        name: '채용절차의 공정화에 관한 법률',
        shortName: '채용절차법',
        keywords: ['채용절차', '채용절차의 공정화', '채용절차법'],
        category: '노동'
    },
    {
        name: '약관의 규제에 관한 법률',
        shortName: '약관규제법',
        keywords: ['약관의 규제', '약관규제법', '약관 규제'],
        category: '공정거래'
    },
    {
        name: '독점규제 및 공정거래에 관한 법률',
        shortName: '공정거래법',
        keywords: ['독점규제', '공정거래', '공정거래법'],
        category: '공정거래'
    },
    {
        name: '저작권법',
        keywords: ['저작권법', '저작권법 시행령', '저작권법 시행규칙'],
        category: '지식재산'
    }
];

// 중요도 산정 기준
export const IMPORTANCE_RULES = {
    // 키워드 기반 가중치
    keywords: {
        '공포': 3,
        '시행일': 3,      // '시행' → '시행일'로 변경 (시행규칙 제외)
        '본회의 통과': 3,
        '상임위 통과': 2,
        '입법예고': 1,
        '개정': 2,
        '제정': 3,
        '폐지': 3,
        '긴급': 3
    },
    // 감점 키워드 (중요도 낮춤)
    negativeKeywords: {
        '시행규칙': -2,   // 시행규칙은 중요도 낮춤
        '직제': -5        // 조직 관련은 대폭 감점 (회사에 불필요)
    },
    // 기관별 가중치
    sources: {
        'law.go.kr': 2,        // 법제처 (공포 확정)
        'assembly.go.kr': 2,   // 국회 (의결)
        'pipc.go.kr': 1,       // 개인정보보호위
        'moel.go.kr': 1,       // 고용노동부
        'msit.go.kr': 1,       // 과기정통부
        'fsc.go.kr': 1,        // 금융위
        'ftc.go.kr': 1         // 공정위
    }
};

/**
 * 법률명이 관리 대상인지 확인
 */
export function isTargetLaw(title) {
    const normalizedTitle = title.replace(/\s+/g, '');

    for (const law of TARGET_LAWS) {
        for (const keyword of law.keywords) {
            const normalizedKeyword = keyword.replace(/\s+/g, '');
            if (normalizedTitle.includes(normalizedKeyword)) {
                return { matched: true, law };
            }
        }
    }

    return { matched: false, law: null };
}

/**
 * 중요도 점수 계산 (1~5)
 */
export function calculateImportance(item) {
    let score = 1;

    const title = item.title || '';
    const content = item.content || item.summary || '';
    const text = `${title} ${content}`;

    // 키워드 가중치 적용 (가점)
    for (const [keyword, weight] of Object.entries(IMPORTANCE_RULES.keywords)) {
        if (text.includes(keyword)) {
            score += weight;
        }
    }

    // 감점 키워드 적용
    if (IMPORTANCE_RULES.negativeKeywords) {
        for (const [keyword, weight] of Object.entries(IMPORTANCE_RULES.negativeKeywords)) {
            if (text.includes(keyword)) {
                score += weight;  // weight가 음수이므로 감점됨
            }
        }
    }

    // 기관 가중치 적용
    const source = item.source || '';
    for (const [domain, weight] of Object.entries(IMPORTANCE_RULES.sources)) {
        if (source.includes(domain)) {
            score += weight;
            break;
        }
    }

    // 1~5 범위로 정규화
    return Math.min(5, Math.max(1, Math.round(score / 2)));
}

/**
 * 중요도별 별점 생성
 */
export function getStarRating(importance) {
    return '★'.repeat(importance) + '☆'.repeat(5 - importance);
}
