/**
 * 수집기 설정 파일
 * 
 * 여기서 활성화할 사이트와 옵션을 설정하세요.
 */

export const COLLECTOR_CONFIG = {
    // 국가법령정보센터 (API 키 필요)
    lawGoKr: {
        enabled: true,  // true/false로 활성화/비활성화
        name: '국가법령정보센터',
        requiresApiKey: true,
        envKey: 'LAW_GO_KR_OC'
    },

    // 열린국회정보 (API 키 필요)
    assembly: {
        enabled: true,
        name: '열린국회정보',
        requiresApiKey: true,
        envKey: 'ASSEMBLY_API_KEY'
    },

    // 고용노동부 (API 키 불필요 - RSS)
    moel: {
        enabled: true,
        name: '고용노동부',
        requiresApiKey: false
    },

    // 개인정보보호위원회 (API 키 불필요 - 스크래핑)
    pipc: {
        enabled: true,
        name: '개인정보보호위원회',
        requiresApiKey: false
    },

    // 과학기술정보통신부 (API 키 불필요 - 스크래핑)
    msit: {
        enabled: true,
        name: '과학기술정보통신부',
        requiresApiKey: false
    },

    // 금융위원회 (API 키 불필요 - 스크래핑)
    fsc: {
        enabled: true,
        name: '금융위원회',
        requiresApiKey: false
    },

    // 공정거래위원회 (API 키 불필요 - 스크래핑)
    ftc: {
        enabled: true,
        name: '공정거래위원회',
        requiresApiKey: false
    }
};

/**
 * SSL 인증서 검증 설정
 * 
 * 한국 정부 사이트들은 특수한 SSL 인증서를 사용하여
 * Node.js에서 인증서 오류가 발생할 수 있습니다.
 * 
 * true: 인증서 검증 무시 (개발/테스트용)
 * false: 인증서 검증 활성화 (보안 강화)
 */
export const SKIP_SSL_VERIFICATION = true;

/**
 * 데이터 수집 기간 설정 (시간 단위)
 * 기본값: 48시간 이내 항목만 수집
 */
export const COLLECTION_HOURS = 48;
