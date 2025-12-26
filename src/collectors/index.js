/**
 * 모든 수집기 통합 모듈
 */

import https from 'https';
import { COLLECTOR_CONFIG, SKIP_SSL_VERIFICATION } from '../config/collectors.js';

// SSL 인증서 검증 무시 설정 (한국 정부 사이트용)
if (SKIP_SSL_VERIFICATION) {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

// 동적 import를 위한 수집기 맵
const collectorModules = {
    lawGoKr: () => import('./law-go-kr.js'),
    assembly: () => import('./assembly.js'),
    moel: () => import('./moel.js'),
    pipc: () => import('./pipc.js'),
    msit: () => import('./msit.js'),
    fsc: () => import('./fsc.js'),
    ftc: () => import('./ftc.js')
};

/**
 * 모든 수집기에서 데이터 수집
 */
export async function collectAllSources() {
    console.log('[collectors] 데이터 수집 시작...');
    console.log('[collectors] SSL 인증서 검증:', SKIP_SSL_VERIFICATION ? '비활성화' : '활성화');

    const results = {
        items: [],
        errors: [],
        stats: {}
    };

    // 활성화된 수집기만 필터링
    const enabledCollectors = Object.entries(COLLECTOR_CONFIG)
        .filter(([key, config]) => {
            if (!config.enabled) {
                console.log(`[collectors] ${config.name}: 비활성화됨 (건너뜀)`);
                return false;
            }

            // API 키 필요한 경우 확인
            if (config.requiresApiKey && config.envKey) {
                const hasKey = !!process.env[config.envKey];
                if (!hasKey) {
                    console.log(`[collectors] ${config.name}: API 키 없음 (건너뜀)`);
                    results.stats[config.name] = 'API 키 필요';
                    return false;
                }
            }

            return true;
        });

    // 병렬로 모든 수집기 실행
    const promises = enabledCollectors.map(async ([key, config]) => {
        try {
            console.log(`[collectors] ${config.name} 수집 중...`);

            const moduleLoader = collectorModules[key];
            if (!moduleLoader) {
                throw new Error(`수집기 모듈을 찾을 수 없음: ${key}`);
            }

            const module = await moduleLoader();
            const items = await module.collectAll();

            results.stats[config.name] = items.length;
            console.log(`[collectors] ${config.name}: ${items.length}건 수집완료`);
            return items;
        } catch (error) {
            console.error(`[collectors] ${config.name} 오류:`, error.message);
            results.errors.push({ source: config.name, error: error.message });
            results.stats[config.name] = 0;
            return [];
        }
    });

    const allItems = await Promise.all(promises);

    // 모든 결과 합치기
    results.items = allItems.flat();

    // 중요도 순으로 정렬
    results.items.sort((a, b) => b.importance - a.importance);

    // 중복 제거 (같은 제목)
    const seen = new Set();
    results.items = results.items.filter(item => {
        const key = item.title.trim().toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });

    console.log(`[collectors] 총 ${results.items.length}건 수집완료`);

    return results;
}

/**
 * 특정 수집기만 실행
 */
export async function collectFromSource(sourceName) {
    const entry = Object.entries(COLLECTOR_CONFIG).find(([key, config]) =>
        config.name.includes(sourceName) || sourceName.includes(config.name)
    );

    if (!entry) {
        throw new Error(`수집기를 찾을 수 없습니다: ${sourceName}`);
    }

    const [key, config] = entry;
    const moduleLoader = collectorModules[key];
    const module = await moduleLoader();
    return module.collectAll();
}

/**
 * 수집기 목록 반환
 */
export function getCollectorNames() {
    return Object.values(COLLECTOR_CONFIG).map(c => c.name);
}

/**
 * 활성화된 수집기 목록 반환
 */
export function getEnabledCollectors() {
    return Object.entries(COLLECTOR_CONFIG)
        .filter(([_, config]) => config.enabled)
        .map(([_, config]) => config.name);
}

export default { collectAllSources, collectFromSource, getCollectorNames, getEnabledCollectors };
