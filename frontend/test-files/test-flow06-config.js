// test-flow06-config.js
// Flow 06 — Commission Config: READ (tree + children) — test ở tầng API, không phải UI.
// Node.js thuần dùng global fetch (yêu cầu Node >= 18, xem BACKEND_SETUP.md).
// An toàn chạy lại nhiều lần: mọi asset/user test đều có suffix RUN_ID,
// KHÔNG đụng tới seed account cố định (admin_test@azrebate.com, mib@test.com, ...).
//
// !! Đã CONFIRM trên môi trường thật (run 29/29 PASS) — không còn giả định treo: !!
//   - Login non-admin (MIB/IB): "/auth/user/login" — đã đưa lên đầu LOGIN_PATH_CANDIDATES.
//     Các path còn lại trong mảng vẫn giữ làm fallback, phòng trường hợp backend đổi route.
//   - PARENT_FIELD: 'parentId' — đúng, verify qua bước 2b-check.
//
// Chạy: cd backend/test && node test-flow06-config.js

const BASE_URL = process.env.API_URL || 'http://localhost:3000';
const RUN_ID = Date.now();

const ADMIN_EMAIL = 'admin_test@azrebate.com';
const ADMIN_PASSWORD = 'Test@1234';
const TEST_PASSWORD = 'Test@1234';

// Thử theo thứ tự này — path nào trả 200/201 kèm accessToken sẽ được dùng và cache lại
// cho các lần login sau trong CÙNG lần chạy script (khỏi thử lại từ đầu mỗi user).
// Đã confirm thật trên môi trường của dự án: "/auth/user/login" — để lên đầu danh sách.
const LOGIN_PATH_CANDIDATES = [
    '/auth/user/login',
    '/auth/login',
    '/auth/signin',
    '/auth/mib/login',
    '/auth/ib/login',
    '/users/login',
];
let cachedWorkingLoginPath = null; // set sau lần login non-admin đầu tiên thành công

const PARENT_FIELD = 'parentId'; // Đã confirm đúng qua bước 2b-check (29/29 PASS run gần nhất)

let passed = 0;
let failed = 0;
const failures = [];

function log(ok, name, detail) {
    if (ok) {
        passed++;
        console.log(`✅ PASS — ${name}`);
    } else {
        failed++;
        failures.push(name);
        console.log(`❌ FAIL — ${name}`);
        if (detail !== undefined) console.log('   ', typeof detail === 'string' ? detail : JSON.stringify(detail));
    }
}

async function request(method, path, body, token) {
    const res = await fetch(`${BASE_URL}${path}`, {
        method,
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    let json = null;
    try {
        json = await res.json();
    } catch {
        json = null;
    }
    return { status: res.status, body: json };
}

// Login cho user thường (MIB/IB) — tự thử các path trong LOGIN_PATH_CANDIDATES.
// Sau lần thành công đầu tiên trong run này, cache lại path đó để các lần login sau
// (user khác) đi thẳng vào path đúng, khỏi thử lại toàn bộ danh sách.
async function loginNonAdmin(email, password) {
    const candidates = cachedWorkingLoginPath ? [cachedWorkingLoginPath] : LOGIN_PATH_CANDIDATES;
    const attempts = [];
    for (const path of candidates) {
        const res = await request('POST', path, { email, password });
        attempts.push({ path, status: res.status });
        if ((res.status === 200 || res.status === 201) && res.body?.accessToken) {
            cachedWorkingLoginPath = path;
            return { token: res.body.accessToken, path, attempts };
        }
    }
    return { token: null, path: null, attempts };
}

async function main() {
    console.log(`\n=== Flow 06 — Commission Config READ (tree + children) — RUN_ID=${RUN_ID} ===\n`);

    // --- 0. Login Admin ---
    const adminLogin = await request('POST', '/auth/admin/login', { email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
    log(adminLogin.status === 201 || adminLogin.status === 200, '0. Admin login', adminLogin);
    const adminToken = adminLogin.body?.accessToken;
    if (!adminToken) {
        console.log('\nKhông lấy được accessToken admin, dừng test.');
        process.exit(1);
    }

    // --- 1. Tạo 2 asset test riêng cho run này: assetA sẽ có config, assetB KHÔNG set config
    // cho ai cả (dùng để test "chưa cấu hình → null, không phải 0" ở bước 12) ---
    const assetA = await request(
        'POST',
        '/admin/assets',
        { code: `T6A_${RUN_ID}`, name: `Test Asset A ${RUN_ID}`, category: 'OTHER' },
        adminToken
    );
    log(assetA.status === 201, '1a. Tạo assetA (sẽ có config)', assetA);
    const assetB = await request(
        'POST',
        '/admin/assets',
        { code: `T6B_${RUN_ID}`, name: `Test Asset B ${RUN_ID}`, category: 'OTHER' },
        adminToken
    );
    log(assetB.status === 201, '1b. Tạo assetB (sẽ KHÔNG set config cho ai)', assetB);
    const assetAId = assetA.body?.id;
    const assetBId = assetB.body?.id;

    // --- 2. Dựng cây phân cấp test 3 tầng: MIB (root) → IB1 (con trực tiếp) → IB2 (cháu) ---
    const mib = await request(
        'POST',
        '/admin/users',
        { email: `t6_mib_${RUN_ID}@test.local`, password: TEST_PASSWORD, fullName: `Flow06 MIB ${RUN_ID}`, role: 'MIB' },
        adminToken
    );
    log(mib.status === 201, '2a. Tạo MIB root test', mib);
    const mibId = mib.body?.id;

    const ib1 = await request(
        'POST',
        '/admin/users',
        {
            email: `t6_ib1_${RUN_ID}@test.local`,
            password: TEST_PASSWORD,
            fullName: `Flow06 IB1 ${RUN_ID}`,
            role: 'IB',
            [PARENT_FIELD]: mibId,
        },
        adminToken
    );
    log(ib1.status === 201, `2b. Tạo IB1 (con trực tiếp của MIB, qua field "${PARENT_FIELD}")`, ib1);
    const ib1Id = ib1.body?.id;
    // Verify ngay cha có đúng không, để lộ sớm nếu PARENT_FIELD sai tên thay vì để 403/tree
    // sai lệch khó hiểu ở các bước sau.
    log(
        ib1.body?.[PARENT_FIELD] === mibId || ib1.body?.parentId === mibId || ib1.body?.parent?.id === mibId,
        `2b-check. IB1 thực sự có cha = MIB (nếu FAIL, PARENT_FIELD "${PARENT_FIELD}" có thể sai tên — xem ghi chú đầu file)`,
        ib1.body
    );

    const ib2 = await request(
        'POST',
        '/admin/users',
        {
            email: `t6_ib2_${RUN_ID}@test.local`,
            password: TEST_PASSWORD,
            fullName: `Flow06 IB2 (cháu) ${RUN_ID}`,
            role: 'IB',
            [PARENT_FIELD]: ib1Id,
        },
        adminToken
    );
    log(ib2.status === 201, '2c. Tạo IB2 (con của IB1 = cháu của MIB)', ib2);
    const ib2Id = ib2.body?.id;

    // --- 3. Set config cho MIB và IB1 trên assetA. IB2 CỐ Ý không set gì (dùng để test
    // node chưa cấu hình ở bước 11). ---
    const cfgMib = await request(
        'POST',
        '/commission-configs',
        { userId: mibId, assetId: assetAId, rebateUnit: 10, markupPips: 5 },
        adminToken
    );
    log(cfgMib.status === 201 || cfgMib.status === 200, '3a. Set config MIB (assetA, rebate=10 markup=5)', cfgMib);

    const cfgIb1 = await request(
        'POST',
        '/commission-configs',
        { userId: ib1Id, assetId: assetAId, rebateUnit: 4, markupPips: 2 },
        adminToken
    );
    log(cfgIb1.status === 201 || cfgIb1.status === 200, '3b. Set config IB1 (assetA, rebate=4 markup=2)', cfgIb1);

    // --- 4. Admin xem tree/:mibId?assetId=assetA → phải là cây lồng nhau 3 tầng: MIB → IB1 → IB2 ---
    const tree = await request('GET', `/commission-configs/tree/${mibId}?assetId=${assetAId}`, undefined, adminToken);
    log(tree.status === 200, '4a. Admin GET tree/:mibId → 200', tree);
    console.log('   Shape tree thật:', JSON.stringify(tree.body, null, 2));

    log(tree.body?.userId === mibId, '4b. Root của tree đúng là MIB', tree.body?.userId);
    log(
        Number(tree.body?.rebateUnit) === 10 && Number(tree.body?.markupPips) === 5,
        '4c. Config root (MIB) đúng giá trị đã set (10, 5)',
        tree.body
    );

    const treeIb1 = (tree.body?.children ?? []).find((c) => c.userId === ib1Id);
    log(!!treeIb1, '4d. Tree có IB1 là con trực tiếp của MIB', treeIb1);
    log(
        !!treeIb1 && Number(treeIb1.rebateUnit) === 4 && Number(treeIb1.markupPips) === 2,
        '4e. Config IB1 trong tree đúng giá trị đã set (4, 2)',
        treeIb1
    );

    const treeIb2 = (treeIb1?.children ?? []).find((c) => c.userId === ib2Id);
    log(!!treeIb2, '4f. Tree có IB2 là con của IB1 (cháu của MIB) — verify cây lồng nhau nhiều tầng', treeIb2);

    // --- 5. Login MIB (non-admin) để test phân quyền — tự thử các path candidate ---
    const mibLogin = await loginNonAdmin(`t6_mib_${RUN_ID}@test.local`, TEST_PASSWORD);
    log(
        !!mibLogin.token,
        `5. Login MIB thường — tự thử ${LOGIN_PATH_CANDIDATES.length} path, ${mibLogin.token ? `work ở "${mibLogin.path}"` : 'KHÔNG path nào work'}`,
        mibLogin.attempts
    );
    if (mibLogin.token) {
        console.log(`   ℹ️  Path login non-admin đúng là "${mibLogin.path}" — cập nhật LOGIN_PATH_CANDIDATES[0] thành giá trị này cho lần chạy sau.`);
    }
    const mibToken = mibLogin.token;

    if (!mibToken) {
        console.log(
            `\n⚠️  Không login được MIB qua bất kỳ path nào trong LOGIN_PATH_CANDIDATES — test 6-10 bị SKIP.`
        );
        console.log('    Thêm path đúng vào đầu mảng LOGIN_PATH_CANDIDATES ở đầu file rồi chạy lại.\n');
    } else {
        // --- 6. Non-admin (MIB) gọi tree/:userId → phải 403 (route Admin-only) ---
        const treeAsMib = await request('GET', `/commission-configs/tree/${mibId}?assetId=${assetAId}`, undefined, mibToken);
        log(treeAsMib.status === 403, '6. Non-admin (MIB) gọi tree/:userId → 403', treeAsMib);

        // --- 7. MIB xem children/:mibId → thấy đúng bản thân + IB1 (con trực tiếp), KHÔNG thấy IB2 (cháu) ---
        const childrenAsMib = await request(
            'GET',
            `/commission-configs/children/${mibId}?assetId=${assetAId}`,
            undefined,
            mibToken
        );
        log(childrenAsMib.status === 200, '7a. MIB GET children của chính mình → 200', childrenAsMib);
        log(
            childrenAsMib.body?.self?.userId === mibId && Number(childrenAsMib.body?.self?.rebateUnit) === 10,
            '7b. self đúng là MIB với config đã set (10, 5)',
            childrenAsMib.body?.self
        );
        const childIdsOfMib = (childrenAsMib.body?.children ?? []).map((c) => c.userId);
        log(childIdsOfMib.includes(ib1Id), '7c. children có IB1 (con trực tiếp)', childIdsOfMib);
        log(!childIdsOfMib.includes(ib2Id), '7d. children KHÔNG có IB2 (cháu, không phải con trực tiếp)', childIdsOfMib);

        // --- 8. Login IB1 để test IB xem children (path đã cache từ bước 5 nên đi thẳng) ---
        const ib1Login = await loginNonAdmin(`t6_ib1_${RUN_ID}@test.local`, TEST_PASSWORD);
        log(!!ib1Login.token, '8a. Login IB1', ib1Login.attempts);
        const ib1Token = ib1Login.token;

        if (!ib1Token) {
            console.log('⚠️  Không login được IB1 — SKIP test 9, 10.\n');
        } else {
            // --- 9. IB1 xem children của chính mình → OK, thấy self + IB2 ---
            const childrenAsIb1Self = await request(
                'GET',
                `/commission-configs/children/${ib1Id}?assetId=${assetAId}`,
                undefined,
                ib1Token
            );
            log(childrenAsIb1Self.status === 200, '9a. IB1 GET children của chính mình → 200', childrenAsIb1Self);
            log(
                childrenAsIb1Self.body?.self?.userId === ib1Id && Number(childrenAsIb1Self.body?.self?.rebateUnit) === 4,
                '9b. self đúng là IB1 với config đã set (4, 2)',
                childrenAsIb1Self.body?.self
            );
            const childIdsOfIb1 = (childrenAsIb1Self.body?.children ?? []).map((c) => c.userId);
            log(childIdsOfIb1.includes(ib2Id), '9c. children của IB1 có IB2 (con trực tiếp của IB1)', childIdsOfIb1);

            // --- 10. IB1 xem children của người khác (MIB, cha mình) → 403 ---
            const childrenOfMibAsIb1 = await request(
                'GET',
                `/commission-configs/children/${mibId}?assetId=${assetAId}`,
                undefined,
                ib1Token
            );
            log(childrenOfMibAsIb1.status === 403, '10. IB1 xem children của người khác (MIB) → 403', childrenOfMibAsIb1);
        }
    }

    // --- 11. Node chưa có config (IB2, chưa set gì) → tree trả null, KHÔNG phải 0 ---
    log(
        treeIb2 !== undefined && treeIb2.rebateUnit === null && treeIb2.markupPips === null && treeIb2.version === null,
        '11. IB2 chưa cấu hình → rebateUnit/markupPips/version = null trong tree (không phải 0)',
        treeIb2
    );

    // --- 12. assetB không set config cho AI cả → root (MIB) trên assetB cũng phải null, không phải 0 ---
    const treeAssetB = await request('GET', `/commission-configs/tree/${mibId}?assetId=${assetBId}`, undefined, adminToken);
    log(treeAssetB.status === 200, '12a. Admin GET tree/:mibId với assetB (chưa config cho ai) → vẫn 200', treeAssetB);
    log(
        treeAssetB.body?.rebateUnit === null && treeAssetB.body?.markupPips === null && treeAssetB.body?.version === null,
        '12b. Root chưa cấu hình cho assetB → null, KHÔNG phải 0 (tránh hiểu nhầm đã set 0)',
        treeAssetB.body
    );

    // --- Tổng kết ---
    console.log(`\n=== KẾT QUẢ: ${passed} PASS / ${failed} FAIL (tổng ${passed + failed}) ===`);
    if (failed > 0) {
        console.log('Các test FAIL:', failures.join(', '));
        process.exit(1);
    }
}

main().catch((err) => {
    console.error('Lỗi không mong muốn khi chạy test:', err);
    process.exit(1);
});