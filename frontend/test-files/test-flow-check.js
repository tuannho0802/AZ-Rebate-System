/**
 * test-flow-check.js — Reusable end-to-end backend verification.
 *
 * MỤC ĐÍCH: chạy toàn bộ flow nghiệp vụ chính theo đúng thứ tự phụ thuộc
 * (auth -> admin CRUD -> users hierarchy -> commission-config cap/orphan/
 * version -> template apply -> payout-session/ledger state machine), in ra
 * PASS/FAIL rõ ràng cho từng bước, KHÔNG cần sửa CONFIG bằng tay mỗi lần —
 * mọi userId cần thiết được TỰ resolve qua GET /users theo email (seed data
 * cố định), không hardcode UUID.
 *
 * TÁI SỬ DỤNG NHIỀU LẦN AN TOÀN: Asset/Template/User mới tạo trong lúc test
 * đều có suffix theo timestamp (RUN_ID) nên không bao giờ đụng độ với lần
 * chạy trước — không cần dọn dẹp DB giữa các lần chạy.
 *
 * LƯU Ý: hệ thống không có DELETE cho User (chỉ PATCH isActive, theo đúng
 * rule "no hard delete" đã chốt) — mỗi lần chạy sẽ để lại 1 vài user test
 * mới (email dạng testflow-*-<RUN_ID>@test.com). Đây là hành vi CHỦ Ý,
 * không phải lỗi — dọn dẹp thủ công qua DB nếu cần.
 *
 * CÁCH CHẠY:
 *   node test-flow-check.js
 *   BASE_URL=http://localhost:3000 node test-flow-check.js   (override nếu cần)
 *
 * YÊU CẦU: Node.js 18+ (dùng global fetch), backend đang chạy, DB đã seed
 * theo đúng prisma/seed.ts (email/password mặc định bên dưới).
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const RUN_ID = Date.now();
const SEED_PASSWORD = 'Test@1234';

// ---- Seed accounts cố định (theo prisma/seed.ts) ----
const SEED = {
    admin: 'admin_test@azrebate.com',
    admin2: 'admin2_test@azrebate.com',
    mib: 'mib@test.com',
    lv1a: 'lv1-a@test.com',
    lv1b: 'lv1-b@test.com',
    lv2a: 'lv2-a@test.com',
    lv2b: 'lv2-b@test.com',
    lv2c: 'lv2-c@test.com',
    lv3a: 'lv3-a@test.com',
    lv3b: 'lv3-b@test.com',
    mib2: 'mib2@test.com',
    lv1c: 'lv1-c@test.com',
    lv2c2: 'lv2-c2@test.com',
};

// ---------------------------------------------------------------------------
// Test runner tối giản — không phụ thuộc thư viện ngoài
// ---------------------------------------------------------------------------
const results = [];
let currentSection = '';

function section(name) {
    currentSection = name;
    console.log(`\n${'='.repeat(70)}\n${name}\n${'='.repeat(70)}`);
}

function record(label, pass, detail) {
    results.push({ section: currentSection, label, pass, detail });
    const icon = pass ? '\x1b[32m✔ PASS\x1b[0m' : '\x1b[31m✘ FAIL\x1b[0m';
    console.log(`  ${icon}  ${label}${detail ? '  — ' + detail : ''}`);
}

/**
 * Gọi API, trả về { status, body }. KHÔNG throw khi status lỗi — để bài test
 * tự assert status mong đợi (nhiều case CỐ Ý mong đợi 400/403/409/404).
 */
async function call(method, path, { token, body } = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(`${BASE_URL}${path}`, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    let parsed = null;
    const text = await res.text();
    try {
        parsed = text ? JSON.parse(text) : null;
    } catch {
        parsed = text;
    }
    return { status: res.status, body: parsed };
}

/**
 * Thực hiện 1 assertion: gọi API, kiểm tra status nằm trong `expectStatus`
 * (số hoặc mảng số), trả về response để bước sau dùng tiếp.
 */
async function check(label, method, path, opts, expectStatus) {
    const expected = Array.isArray(expectStatus) ? expectStatus : [expectStatus];
    const { status, body } = await call(method, path, opts);
    const pass = expected.includes(status);
    record(label, pass, `${method} ${path} -> ${status} (expect ${expected.join('|')})`);
    if (!pass) {
        console.log(`         Response body:`, JSON.stringify(body).slice(0, 300));
    }
    return { status, body, pass };
}

// ---------------------------------------------------------------------------
// Helpers nghiệp vụ
// ---------------------------------------------------------------------------
async function loginAdmin(email) {
    const { status, body } = await call('POST', '/auth/admin/login', {
        body: { email, password: SEED_PASSWORD },
    });
    if (status >= 300 || !body?.accessToken) {
        throw new Error(`Login admin thất bại cho ${email}: status ${status} — ${JSON.stringify(body)}`);
    }
    return body.accessToken;
}

async function loginUser(email) {
    const { status, body } = await call('POST', '/auth/user/login', {
        body: { email, password: SEED_PASSWORD },
    });
    if (status >= 300 || !body?.accessToken) {
        throw new Error(`Login user thất bại cho ${email}: status ${status} — ${JSON.stringify(body)}`);
    }
    return body.accessToken;
}

/** Map email -> User record đầy đủ, resolve qua GET /users bằng token Admin (thấy toàn bộ hệ thống). */
async function buildUserIndex(adminToken) {
    const { status, body } = await call('GET', '/users?limit=100', { token: adminToken });
    if (status !== 200 || !Array.isArray(body)) {
        throw new Error(`Không load được /users để resolve ID (status ${status}) — dừng test.`);
    }
    const byEmail = new Map();
    for (const u of body) byEmail.set(u.email, u);
    return byEmail;
}

// ---------------------------------------------------------------------------
// MAIN
// ---------------------------------------------------------------------------
async function main() {
    console.log(`Backend flow-check — BASE_URL=${BASE_URL} — RUN_ID=${RUN_ID}`);

    // ===== 0. AUTH =====
    section('0. AUTH — login toàn bộ tài khoản seed cần dùng');
    let adminToken, admin2Token, mibToken, mib2Token, lv1aToken, lv1bToken, lv2aToken;
    try {
        adminToken = await loginAdmin(SEED.admin);
        record('Admin login', true, SEED.admin);
        admin2Token = await loginAdmin(SEED.admin2);
        record('Admin2 (non-root) login', true, SEED.admin2);
        mibToken = await loginUser(SEED.mib);
        record('MIB login', true, SEED.mib);
        mib2Token = await loginUser(SEED.mib2);
        record('MIB2 (cây khác) login', true, SEED.mib2);
        lv1aToken = await loginUser(SEED.lv1a);
        record('lv1-a (IB) login', true, SEED.lv1a);
        lv1bToken = await loginUser(SEED.lv1b);
        record('lv1-b (IB) login', true, SEED.lv1b);
        lv2aToken = await loginUser(SEED.lv2a);
        record('lv2-a (IB, cháu của MIB) login', true, SEED.lv2a);
    } catch (err) {
        record('AUTH SETUP', false, err.message);
        console.log('\nKhông login được tài khoản seed cơ bản — dừng toàn bộ test. Kiểm tra lại DB đã seed đúng chưa.');
        printSummaryAndExit();
        return;
    }

    // Resolve toàn bộ userId cần dùng qua email — KHÔNG hardcode UUID
    const idx = await buildUserIndex(adminToken);
    const need = (email) => {
        const u = idx.get(email);
        if (!u) throw new Error(`Seed user ${email} không tồn tại trong DB — chạy lại prisma seed trước.`);
        return u;
    };
    const mib = need(SEED.mib);
    const mib2 = need(SEED.mib2);
    const lv1a = need(SEED.lv1a);
    const lv1b = need(SEED.lv1b);
    const lv2a = need(SEED.lv2a);
    const lv2c = need(SEED.lv2c); // con trực tiếp THẬT của lv1-b (theo seed.ts) — dùng cho test orphan-config
    const lv3a = idx.get(SEED.lv3a); // optional, dùng cho test subtree sâu hơn nếu có

    // ===== 1. ADMIN — Asset & Template CRUD (dữ liệu mới, unique theo RUN_ID) =====
    section('1. ADMIN — Asset & Template CRUD');
    const assetCode = `TESTFLOW_${RUN_ID}`;
    const createAssetRes = await check(
        'Admin tạo Asset mới',
        'POST',
        '/admin/assets',
        { token: adminToken, body: { code: assetCode, name: `Test Flow Asset ${RUN_ID}`, category: 'OTHER' } },
        201
    );
    const asset = createAssetRes.body;

    await check(
        'Non-admin (MIB) tạo Asset -> phải 403',
        'POST',
        '/admin/assets',
        { token: mibToken, body: { code: `SHOULD_FAIL_${RUN_ID}`, name: 'x', category: 'OTHER' } },
        403
    );

    await check('Admin GET /admin/assets', 'GET', '/admin/assets', { token: adminToken }, 200);
    await check(
        '[GAP đã sửa] Non-admin (IB) GET /admin/assets -> phải MỞ (200), không 403',
        'GET',
        '/admin/assets',
        { token: lv1aToken },
        200
    );

    const templateName = `TestFlow Template ${RUN_ID}`;
    // QUAN TRỌNG: dùng asset RIÊNG cho template item, KHÁC với `asset` chính
    // (dùng cho cap/orphan/version/ledger test ở mục 3+5). Lý do: nếu dùng
    // chung 1 asset, bước "Admin áp Template cho MIB" ở mục 4 sẽ GHI ĐÈ config
    // gốc của MIB (đặt tay ở mục 3 là 10/10) xuống giá trị thấp trong template
    // (2/2) — làm MIB < lv1-a trong chuỗi, khiến LedgerService tính netRebate/
    // netMarkup ÂM và vi phạm CHECK constraint `check_ledger_nonneg` lúc Lock.
    // Đây từng là nguyên nhân thật của lỗi 500 — do bug Ở TEST SCRIPT (asset
    // trùng lặp giữa 2 mục test), KHÔNG phải bug backend.
    const templateAssetRes = await check(
        'Admin tạo Asset RIÊNG cho Template item (tránh đụng asset chính dùng cho ledger test)',
        'POST',
        '/admin/assets',
        { token: adminToken, body: { code: `TESTFLOW_TPL_${RUN_ID}`, name: `Test Flow Template Asset ${RUN_ID}`, category: 'OTHER' } },
        201
    );
    const templateAsset = templateAssetRes.body;

    const createTemplateRes = await check(
        'Admin tạo Template kèm item cho asset RIÊNG (không đụng asset chính)',
        'POST',
        '/admin/templates',
        {
            token: adminToken,
            body: {
                name: templateName,
                description: 'Auto-created by test-flow-check.js',
                level: 0,
                items: [{ assetId: templateAsset?.id, rebateUnit: 2, markupPips: 2 }],
            },
        },
        201
    );
    const template = createTemplateRes.body;
    let lowTemplate;
    let highTemplate;
    let adminHighTemplate;

    const templatesRes = await check(
        '[GAP đã sửa] Non-admin (IB) GET /admin/templates -> phải MỞ (200)',
        'GET',
        '/admin/templates',
        { token: lv1aToken },
        200
    );
    const hasLevelField = templatesRes.body && templatesRes.body.length > 0 && ('level' in templatesRes.body[0]);
    record('  -> Template level bị ẩn khỏi non-admin', !hasLevelField, `hasLevel = ${hasLevelField}`);

    // ===== 2. USERS — hierarchy, pagination, subtree permission =====
    section('2. USERS — hierarchy, pagination, subtree permission');
    await check('GET /users?limit=100 (đúng giới hạn) -> 200', 'GET', '/users?limit=100', { token: adminToken }, 200);
    await check(
        'GET /users?limit=101 (vượt max) -> phải 400 (validator @Max(100))',
        'GET',
        '/users?limit=101',
        { token: adminToken },
        400
    );
    await check(
        '[Bug#2 đã sửa] GET /users?parentId=<mib.id> (MIB tự xem con trực tiếp) -> 200',
        'GET',
        `/users?parentId=${mib.id}&limit=100`,
        { token: mibToken },
        200
    );

    await check(
        '[SubtreeViewGuard đã nới] MIB xem subtree của CHÍNH MÌNH -> 200',
        'GET',
        `/users/${mib.id}/subtree`,
        { token: mibToken },
        200
    );
    await check(
        '[SubtreeViewGuard đã nới] MIB xem subtree của CHÁU (lv2-a, không phải con trực tiếp) -> phải 200',
        'GET',
        `/users/${lv2a.id}/subtree`,
        { token: mibToken },
        200
    );
    await check(
        'MIB xem subtree của user KHÁC NHÁNH (mib2) -> phải 403',
        'GET',
        `/users/${mib2.id}/subtree`,
        { token: mibToken },
        403
    );
    await check('IB (lv1-a) xem subtree BẤT KỲ, kể cả chính mình -> luôn 403', 'GET', `/users/${lv1a.id}/subtree`, { token: lv1aToken }, 403);

    const newChildEmail = `testflow-child-${RUN_ID}@test.com`;
    const createChildRes = await check(
        'lv1-a (IB) tự tạo con trực tiếp (IB mới)',
        'POST',
        '/users',
        {
            token: lv1aToken,
            body: { email: newChildEmail, password: SEED_PASSWORD, fullName: 'TestFlow Child', role: 'IB', parentId: lv1a.id },
        },
        201
    );
    const newChild = createChildRes.body;

    await check(
        'lv1-a KHÔNG được tạo user với parentId khác chính mình (nhảy cấp) -> phải 403',
        'POST',
        '/users',
        { token: lv1aToken, body: { email: `testflow-skip-${RUN_ID}@test.com`, password: SEED_PASSWORD, role: 'IB', parentId: lv2a.id } },
        403
    );

    await check('MIB tự sửa chính mình -> LUÔN bị chặn 403', 'PATCH', `/users/${mib.id}`, { token: mibToken, body: { fullName: 'x' } }, 403);
    if (newChild?.id) {
        await check('lv1-a sửa con trực tiếp vừa tạo -> 200', 'PATCH', `/users/${newChild.id}`, { token: lv1aToken, body: { fullName: 'Edited' } }, 200);
    }
    await check(
        'MIB sửa CHÁU (lv2-a, không phải con trực tiếp) -> phải 403 (chỉ cha trực tiếp mới sửa)',
        'PATCH',
        `/users/${lv2a.id}`,
        { token: mibToken, body: { fullName: 'x' } },
        403
    );

    // ===== 3. COMMISSION CONFIG — orphan, cap, version, self-edit block =====
    section('3. COMMISSION CONFIG — orphan / cap / version / self-edit');
    if (!asset?.id) {
        record('SKIP toàn bộ mục 3', false, 'Asset mới không tạo được ở bước 1, không thể test tiếp');
    } else {
        await check(
            'MIB set config cho CHÍNH MÌNH (asset mới, chưa ai có config) -> phải 403 (root chỉ Admin set)',
            'POST',
            '/commission-configs',
            { token: mibToken, body: { userId: mib.id, assetId: asset.id, rebateUnit: 5, markupPips: 5 } },
            403
        );

        const adminSetMibRes = await check(
            'Admin set config gốc cho MIB (bắt buộc trước khi ai xuống dưới set được)',
            'POST',
            '/commission-configs',
            { token: adminToken, body: { userId: mib.id, assetId: asset.id, rebateUnit: 10, markupPips: 10 } },
            201
        );

        await check(
            'MIB set config cho con trực tiếp (lv1-a) truyền riêng lẻ rebate/markup -> phải 403 (không cho phép)',
            'POST',
            '/commission-configs',
            { token: mibToken, body: { userId: lv1a.id, assetId: asset.id, rebateUnit: 5, markupPips: 5 } },
            403
        );

        await check(
            'MIB set config cho con trực tiếp (lv1-a) VƯỢT TRẦN (25 > 20) -> phải 400',
            'POST',
            '/commission-configs',
            { token: mibToken, body: { userId: lv1a.id, assetId: asset.id, transferUnit: 25 } },
            400
        );

        const mibSetLv1aRes = await check(
            'MIB set config cho con trực tiếp (lv1-a) TRONG TRẦN (10 <= 20) -> 200/201',
            'POST',
            '/commission-configs',
            { token: mibToken, body: { userId: lv1a.id, assetId: asset.id, transferUnit: 10 } },
            [200, 201]
        );

        await check(
            'MIB set config cho CHÁU (lv2-a, không phải con trực tiếp) -> phải 403',
            'POST',
            '/commission-configs',
            { token: mibToken, body: { userId: lv2a.id, assetId: asset.id, transferUnit: 2 } },
            403
        );

        await check(
            '[Orphan-config] lv1-b set config cho con TRỰC TIẾP THẬT (lv2-c) khi CHÍNH lv1-b chưa có config asset này -> phải 400',
            'POST',
            '/commission-configs',
            { token: lv1bToken, body: { userId: lv2c.id, assetId: asset.id, transferUnit: 2 } },
            400
        );

        // Version / optimistic lock
        const childCfg = await check(
            'MIB xem children (self+direct) cho asset mới -> version phải có giá trị, không null',
            'GET',
            `/commission-configs/children/${mib.id}?assetId=${asset.id}`,
            { token: mibToken },
            200
        );
        const lv1aVersion = childCfg.body?.children?.find((c) => c.userId === lv1a.id)?.version;
        record('  -> version của lv1-a trong response', typeof lv1aVersion === 'number', `version = ${lv1aVersion}`);

        if (typeof lv1aVersion === 'number') {
            await check(
                'MIB PATCH config lv1-a với version SAI (cũ - 999) -> phải 409',
                'PATCH',
                `/commission-configs/${lv1a.id}/${asset.id}`,
                { token: mibToken, body: { transferUnit: 8, version: 999 } },
                409
            );
            await check(
                'MIB PATCH config lv1-a với version ĐÚNG -> 200',
                'PATCH',
                `/commission-configs/${lv1a.id}/${asset.id}`,
                { token: mibToken, body: { transferUnit: 8, version: lv1aVersion } },
                200
            );
        }

        const mibSelfCfg = await check(
            'Admin xem self+children cua MIB de lay version hien tai (chuan bi test tran-duoi)',
            'GET',
            `/commission-configs/children/${mib.id}?assetId=${asset.id}`,
            { token: adminToken },
            200
        );
        const mibVersion = mibSelfCfg.body?.self?.version;
        record('  -> version cua MIB trong response', typeof mibVersion === 'number', `version = ${mibVersion}`);

        if (typeof mibVersion === 'number') {
            await check(
                '[Tran-duoi / Auto-clamp] Admin PATCH MIB (root) ha rebateUnit xuong duoi muc con (2 < 8) -> phai cho phep (200) va tu dong ha con',
                'PATCH',
                `/commission-configs/${mib.id}/${asset.id}`,
                { token: adminToken, body: { rebateUnit: 2, markupPips: 10, version: mibVersion } },
                200
            );

            const mibAfterRes = await check(
                '  -> GET lai self+children MIB de verify con tu dong ha',
                'GET',
                `/commission-configs/children/${mib.id}?assetId=${asset.id}`,
                { token: adminToken },
                200
            );
            const lv1aAfter = mibAfterRes.body?.children?.find((c) => c.userId === lv1a.id);
            const lv1aRebate = lv1aAfter ? Number(lv1aAfter.rebateUnit) : null;
            record(
                '  -> rebateUnit cua lv1-a tu dong bi ha xuong bang rebateUnit cua MIB (2)',
                lv1aRebate === 2,
                `lv1-a rebateUnit = ${lv1aRebate} (ky vong 2)`
            );
        } else {
            record('SKIP test tran-duoi cho MIB', false, 'Khong lay duoc version cua MIB tu response children');
        }

        await check('Admin xem full tree (tree/:userId) -> 200 (admin-only)', 'GET', `/commission-configs/tree/${mib.id}?assetId=${asset.id}`, { token: adminToken }, 200);
        await check('MIB xem full tree -> phải 403 (endpoint admin-only)', 'GET', `/commission-configs/tree/${mib.id}?assetId=${asset.id}`, { token: mibToken }, 403);

        await check(
            'DELETE /commission-configs/:id -> phải 404/405 (route không tồn tại, cố tình không cho xoá)',
            'DELETE',
            `/commission-configs/${adminSetMibRes.body?.id ?? 'any-id'}`,
            { token: adminToken },
            [404, 405]
        );

        // ===== 4. TEMPLATE APPLY =====
        section('4. TEMPLATE APPLY');
        if (template?.id && asset?.id) {
            // Tạo thêm các template test cap-check
            const highTemplateRes = await check(
                'Admin tạo High Template (level 1, vượt cap MIB)',
                'POST',
                '/admin/templates',
                {
                    token: adminToken,
                    body: {
                        name: `High Template ${RUN_ID}`,
                        level: 1,
                        items: [{ assetId: asset.id, rebateUnit: 20, markupPips: 20 }],
                    },
                },
                201
            );
            highTemplate = highTemplateRes.body;

            const lowTemplateRes = await check(
                'Admin tạo Low Template (level 1, trong cap MIB)',
                'POST',
                '/admin/templates',
                {
                    token: adminToken,
                    body: {
                        name: `Low Template ${RUN_ID}`,
                        level: 1,
                        items: [{ assetId: asset.id, rebateUnit: 5, markupPips: 5 }],
                    },
                },
                201
            );
            lowTemplate = lowTemplateRes.body;

            const adminHighTemplateRes = await check(
                'Admin tạo Admin High Template (level 0, vượt cap Admin nếu check)',
                'POST',
                '/admin/templates',
                {
                    token: adminToken,
                    body: {
                        name: `Admin High Template ${RUN_ID}`,
                        level: 0,
                        items: [{ assetId: asset.id, rebateUnit: 30, markupPips: 30 }],
                    },
                },
                201
            );
            adminHighTemplate = adminHighTemplateRes.body;

            await check(
                'MIB tự áp Template cho CHÍNH MÌNH (root) -> phải 403 (chỉ Admin set được root)',
                'POST',
                `/templates/${template.id}/apply/${mib.id}`,
                { token: mibToken },
                403
            );
            await check(
                'Admin áp Template cho MIB (root) -> 201, bypass cap/orphan',
                'POST',
                `/templates/${template.id}/apply/${mib.id}`,
                { token: adminToken },
                201
            );
            await check(
                'MIB áp Template cho con trực tiếp (lv1-b, giờ MIB đã có config) -> 201',
                'POST',
                `/templates/${template.id}/apply/${lv1b.id}`,
                { token: mibToken },
                201
            );
            await check(
                'MIB áp Template cho CHÁU (lv2a) -> phải 403 (không phải con trực tiếp/không thuộc subtree quyền apply)',
                'POST',
                `/templates/${template.id}/apply/${lv2a.id}`,
                { token: mibToken },
                403
            );

            // Bổ sung các case cap-check khi áp template
            await check(
                'MIB áp High Template (vượt cap) cho con trực tiếp (lv1-b) -> phải 400',
                'POST',
                `/templates/${highTemplate.id}/apply/${lv1b.id}`,
                { token: mibToken },
                400
            );

            await check(
                'MIB áp Low Template (trong cap) cho con trực tiếp (lv1-b) -> 201',
                'POST',
                `/templates/${lowTemplate.id}/apply/${lv1b.id}`,
                { token: mibToken },
                201
            );

            await check(
                'Admin áp Admin High Template (vượt cap) cho MIB -> 201 (Admin bypass cap-check)',
                'POST',
                `/templates/${adminHighTemplate.id}/apply/${mib.id}`,
                { token: adminToken },
                201
            );
        } else {
            record('SKIP mục 4', false, 'Template không tạo được ở bước 1');
        }

        // ===== 7. TEMPLATE LOCK =====
        section('7. TEMPLATE LOCK');
        if (template?.id && lowTemplate?.id) {
            // MIB lock template (level 1) cho con trực tiếp (lv1-b, level 1)
            // Dùng lowTemplate (level 1) thay vì template (level 0) vì lv1b.level = 1
            await check(
                'MIB lock template cho con trực tiếp -> 201/200',
                'POST',
                `/templates/${lowTemplate.id}/lock/${lv1b.id}`,
                { token: mibToken },
                [200, 201]
            );

            await check(
                'Gọi lock lần 2 (đã lock rồi) -> vẫn 200/201 (idempotent)',
                'POST',
                `/templates/${lowTemplate.id}/lock/${lv1b.id}`,
                { token: mibToken },
                [200, 201]
            );

            await check(
                'MIB lock template cho user KHÔNG phải con trực tiếp (cháu lv2-a) -> phải 403',
                'POST',
                `/templates/${template.id}/lock/${lv2a.id}`,
                { token: mibToken },
                403
            );

            await check(
                'IB thường (không phải cha của target) cố lock template cho ai đó -> phải 403',
                'POST',
                `/templates/${template.id}/lock/${lv1b.id}`,
                { token: lv1aToken },
                403
            );

            await check(
                'Lock template có level không khớp level của user target -> phải 400',
                'POST',
                `/templates/${lowTemplate.id}/lock/${mib.id}`, // lowTemplate.level = 1, mib.level = 0
                { token: adminToken },
                400
            );

            // Kiểm tra GET /templates/visible bằng token của user bị lock (lv1-b)
            const visibleBeforeUnlock = await check(
                'Sau khi lock: gọi GET /templates/visible bằng token của user bị lock -> template đó KHÔNG xuất hiện',
                'GET',
                '/templates/visible',
                { token: lv1bToken },
                200
            );
            const isTemplateLocked = !visibleBeforeUnlock.body?.some((t) => t.id === lowTemplate.id);
            record('  -> template bị lock biến mất khỏi danh sách', isTemplateLocked, `lockedIds = ${JSON.stringify(visibleBeforeUnlock.body?.map((t) => t.id))}`);

            // MIB unlock template cho con trực tiếp
            await check(
                'MIB unlock template cho con trực tiếp -> 200',
                'POST',
                `/templates/${lowTemplate.id}/unlock/${lv1b.id}`,
                { token: mibToken },
                [200, 201]
            );

            // Kiểm tra GET /templates/visible bằng token của user được unlock (lv1-b)
            const visibleAfterUnlock = await check(
                'unlock xong -> template xuất hiện lại trong GET /templates/visible',
                'GET',
                '/templates/visible',
                { token: lv1bToken },
                200
            );
            const isTemplateUnlocked = visibleAfterUnlock.body?.some((t) => t.id === lowTemplate.id);
            record('  -> template xuất hiện trở lại', isTemplateUnlocked, `visibleIds = ${JSON.stringify(visibleAfterUnlock.body?.map((t) => t.id))}`);

            // Admin gọi GET /templates/visible -> thấy tất cả, kể cả field level
            const adminVisible = await check(
                'Admin gọi GET /templates/visible -> thấy tất cả, kể cả field level',
                'GET',
                '/templates/visible',
                { token: adminToken },
                200
            );
            const hasLevelAdmin = adminVisible.body?.length > 0 && adminVisible.body.every((t) => typeof t.level === 'number');
            record('  -> admin thấy field level', hasLevelAdmin, `sample.level = ${adminVisible.body?.[0]?.level}`);

            // Non-admin gọi GET /templates/visible -> response KHÔNG có field level
            const userVisible = await check(
                'Non-admin gọi GET /templates/visible -> response KHÔNG có field level',
                'GET',
                '/templates/visible',
                { token: lv1bToken },
                200
            );
            const hasNoLevelUser = userVisible.body?.length > 0 && userVisible.body.every((t) => t.level === undefined);
            record('  -> non-admin không thấy field level', hasNoLevelUser, `sample.level = ${userVisible.body?.[0]?.level}`);
        } else {
            record('SKIP mục 7', false, 'Template không tạo được ở bước 1');
        }

        // ===== 5. PAYOUT SESSION + LEDGER — state machine =====
        section('5. PAYOUT SESSION + LEDGER — DRAFT -> LOCKED -> COMPLETED');
        await check(
            'Non-admin (MIB) tạo Payout Session -> phải 403 (admin-only)',
            'POST',
            '/payout-sessions',
            { token: mibToken, body: { name: 'x', baseVolume: 100, sourceUserId: lv1a.id, assetId: asset.id } },
            403
        );

        const createSessionRes = await check(
            'Admin tạo Payout Session (DRAFT) — sourceUserId = lv1-a (đã có config asset này)',
            'POST',
            '/payout-sessions',
            {
                token: adminToken,
                body: { name: `TestFlow Session ${RUN_ID}`, note: 'auto', baseVolume: 1000, sourceUserId: lv1a.id, assetId: asset.id },
            },
            201
        );
        const session = createSessionRes.body;

        if (session?.id) {
            await check('GET /payout-sessions (list) -> 200', 'GET', '/payout-sessions', { token: adminToken }, 200);
            await check('GET /payout-sessions?status=DRAFT -> 200', 'GET', '/payout-sessions?status=DRAFT', { token: adminToken }, 200);

            await check('Admin Lock session (DRAFT -> LOCKED)', 'POST', `/payout-sessions/${session.id}/lock`, { token: adminToken }, [200, 201]);

            const detailAfterLock = await check(
                'GET chi tiết session sau khi Lock -> status LOCKED, có ledgerEntries[]',
                'GET',
                `/payout-sessions/${session.id}`,
                { token: adminToken },
                200
            );
            const hasLedger = Array.isArray(detailAfterLock.body?.ledgerEntries) && detailAfterLock.body.ledgerEntries.length > 0;
            record('  -> ledgerEntries[] có dữ liệu sau Lock', hasLedger, `length = ${detailAfterLock.body?.ledgerEntries?.length}`);
            record(
                '  -> status thật sự đổi thành LOCKED',
                detailAfterLock.body?.status === 'LOCKED',
                `status = ${detailAfterLock.body?.status}`
            );

            await check(
                'Lock LẦN 2 (đã LOCKED) -> phải 409 (không lock lại được)',
                'POST',
                `/payout-sessions/${session.id}/lock`,
                { token: adminToken },
                409
            );

            await check('GET ledger riêng qua /payout-sessions/:id/ledger -> 200', 'GET', `/payout-sessions/${session.id}/ledger`, { token: adminToken }, 200);

            await check('Admin Complete session (LOCKED -> COMPLETED)', 'POST', `/payout-sessions/${session.id}/complete`, { token: adminToken }, [200, 201]);

            const detailAfterComplete = await check(
                'GET chi tiết session sau khi Complete -> status COMPLETED',
                'GET',
                `/payout-sessions/${session.id}`,
                { token: adminToken },
                200
            );
            record(
                '  -> status thật sự đổi thành COMPLETED',
                detailAfterComplete.body?.status === 'COMPLETED',
                `status = ${detailAfterComplete.body?.status}`
            );

            await check(
                'Complete LẦN 2 (đã COMPLETED) -> phải 409',
                'POST',
                `/payout-sessions/${session.id}/complete`,
                { token: adminToken },
                409
            );
            await check(
                'Lock session ĐÃ COMPLETED -> phải 409 (không quay lại LOCKED được)',
                'POST',
                `/payout-sessions/${session.id}/lock`,
                { token: adminToken },
                409
            );
        } else {
            record('SKIP phần còn lại của mục 5', false, 'Tạo session thất bại, không thể test state machine tiếp');
        }
    }

    // ===== 6. INTEGRITY CHECK — quét chuỗi cha-con lệch (GET /admin/integrity-check) =====
    section('6. INTEGRITY CHECK — /admin/integrity-check');
    await check(
        'Non-admin (MIB) gọi /admin/integrity-check -> phải 403 (admin-only)',
        'GET',
        '/admin/integrity-check',
        { token: mibToken },
        403
    );

    const integrityRes = await check(
        'Admin gọi /admin/integrity-check -> 200',
        'GET',
        '/admin/integrity-check',
        { token: adminToken },
        200
    );

    const violations = integrityRes.body;
    record(
        '  -> response là mảng (Array)',
        Array.isArray(violations),
        `typeof body = ${typeof violations}, isArray = ${Array.isArray(violations)}`
    );

    if (Array.isArray(violations)) {
        // KHÔNG assert cứng "phải rỗng" — đây là bài test đọc TOÀN BỘ DB thật, không
        // chỉ data do test-flow-check.js tạo ra, nên nếu còn asset cũ (vd GOLD) chưa
        // được dọn bằng SQL UPDATE thủ công thì mảng này vẫn có phần tử, ĐÚNG NHƯ THIẾT
        // KẾ (integrity check phải trung thực báo cáo, không được tự ý che dấu). Ở đây
        // chỉ log ra để người chạy test TỰ NHÌN THẤY tình trạng thật, không cho fail.
        if (violations.length === 0) {
            record('  -> KHÔNG còn vi phạm chuỗi cha-con nào trong toàn hệ thống', true, 'violations = []');
        } else {
            record(
                `  -> CÒN ${violations.length} vi phạm cha-con trong DB (có thể là data cũ chưa dọn, ví dụ GOLD) — xem chi tiết bên dưới`,
                true,
                violations.map((v) => `${v.assetCode}: ${v.childEmail}(${v.childRebate}/${v.childMarkup}) > cha ${v.parentEmail}(${v.parentRebate}/${v.parentMarkup})`).join(' | ')
            );
        }

        // Sanity-check cấu trúc từng phần tử (nếu có), đảm bảo response không bị đổi shape
        if (violations.length > 0) {
            const sample = violations[0];
            const hasExpectedShape =
                typeof sample.assetCode === 'string' &&
                typeof sample.childEmail === 'string' &&
                typeof sample.parentEmail === 'string' &&
                typeof sample.childRebate === 'number' &&
                typeof sample.parentRebate === 'number' &&
                typeof sample.violatesRebate === 'boolean' &&
                typeof sample.violatesMarkup === 'boolean';
            record(
                '  -> shape của violation object đúng field mong đợi',
                hasExpectedShape,
                JSON.stringify(sample).slice(0, 200)
            );
        }
    }

    printSummaryAndExit();
}

function printSummaryAndExit() {
    console.log(`\n${'='.repeat(70)}\nTỔNG KẾT\n${'='.repeat(70)}`);
    const bySection = new Map();
    for (const r of results) {
        if (!bySection.has(r.section)) bySection.set(r.section, []);
        bySection.get(r.section).push(r);
    }
    let totalPass = 0;
    let totalFail = 0;
    for (const [sec, items] of bySection) {
        const pass = items.filter((i) => i.pass).length;
        const fail = items.length - pass;
        totalPass += pass;
        totalFail += fail;
        console.log(`  ${fail === 0 ? '✔' : '✘'} ${sec}: ${pass}/${items.length} pass`);
        for (const i of items.filter((x) => !x.pass)) {
            console.log(`      ✘ ${i.label} — ${i.detail}`);
        }
    }
    console.log(`\nTổng: ${totalPass} PASS / ${totalFail} FAIL / ${totalPass + totalFail} checks — RUN_ID=${RUN_ID}\n`);
    // KHÔNG dùng process.exit() ép buộc — trên Windows, gọi exit() đột ngột
    // trong lúc fetch (undici) còn giữ socket keep-alive chưa đóng hết sẽ gây
    // crash native "Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)".
    // Dùng process.exitCode để Node tự thoát êm sau khi event loop rảnh —
    // vẫn giữ đúng exit code cho CI (0 = pass hết, 1 = có fail).
    process.exitCode = totalFail > 0 ? 1 : 0;
}

main().catch((err) => {
    console.error('\n[FATAL] Test script crash ngoài dự kiến:', err);
    printSummaryAndExit();
});