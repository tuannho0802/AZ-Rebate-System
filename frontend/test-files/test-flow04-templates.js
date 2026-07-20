// test-flow04-templates.js
// Flow 04 — Admin: Template CRUD + Apply Template (test ở tầng API, không phải UI).
// Node.js thuần dùng global fetch (yêu cầu Node >= 18, xem BACKEND_SETUP.md).
// An toàn chạy lại nhiều lần: mọi asset/template/user test đều có suffix RUN_ID,
// KHÔNG đụng tới seed account cố định (admin_test@azrebate.com, mib@test.com, ...).
//
// Chạy: cd backend/test && node test-flow04-templates.js

const BASE_URL = process.env.API_URL || 'http://localhost:3000';
const RUN_ID = Date.now();

const ADMIN_EMAIL = 'admin_test@azrebate.com';
const ADMIN_PASSWORD = 'Test@1234';

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

async function main() {
    console.log(`\n=== Flow 04 — Template CRUD — RUN_ID=${RUN_ID} ===\n`);

    // --- 0. Login Admin ---
    const login = await request('POST', '/auth/admin/login', { email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
    log(login.status === 201 || login.status === 200, '0. Admin login', login);
    const adminToken = login.body?.accessToken;
    if (!adminToken) {
        console.log('\nKhông lấy được accessToken, dừng test.');
        process.exit(1);
    }

    // --- 1. Tạo 2 asset test riêng cho run này ---
    const assetA = await request(
        'POST',
        '/admin/assets',
        { code: `T4A_${RUN_ID}`, name: `Test Asset A ${RUN_ID}`, category: 'OTHER' },
        adminToken
    );
    log(assetA.status === 201, '1a. Tạo asset test A', assetA);

    const assetB = await request(
        'POST',
        '/admin/assets',
        { code: `T4B_${RUN_ID}`, name: `Test Asset B ${RUN_ID}`, category: 'OTHER' },
        adminToken
    );
    log(assetB.status === 201, '1b. Tạo asset test B', assetB);

    const assetAId = assetA.body?.id;
    const assetBId = assetB.body?.id;

    // In luôn shape response thật ra console để dễ đối chiếu khi API đổi
    console.log('   Shape asset thật:', JSON.stringify(assetA.body, null, 2));

    // --- 2. Đếm tổng số asset hiện có trong hệ thống (để verify placeholder sau) ---
    const allAssets = await request('GET', '/admin/assets', undefined, adminToken);
    log(allAssets.status === 200 && Array.isArray(allAssets.body), '2. GET /admin/assets trả mảng', allAssets.status);
    const totalAssetCount = Array.isArray(allAssets.body) ? allAssets.body.length : 0;

    // --- 3. Tạo Template với 1 item cụ thể (assetA), KHÔNG liệt kê assetB ---
    const createTpl = await request(
        'POST',
        '/admin/templates',
        {
            name: `Test Template ${RUN_ID}`,
            description: 'Template test Flow 04',
            items: [{ assetId: assetAId, rebateUnit: 10, markupPips: 5 }],
        },
        adminToken
    );
    log(createTpl.status === 201, '3. Tạo template với 1 item cụ thể', createTpl);
    const templateId = createTpl.body?.id;
    console.log('   Shape template thật:', JSON.stringify(createTpl.body, null, 2));

    // --- 4. Verify: asset KHÔNG liệt kê (assetB và mọi asset khác) tự động có item (0,0) ---
    const itemsAfterCreate = createTpl.body?.items ?? [];
    log(
        itemsAfterCreate.length === totalAssetCount,
        '4a. Tổng số item = tổng số asset hiện có (mọi asset đều có item, kể cả placeholder)',
        `items=${itemsAfterCreate.length}, assets=${totalAssetCount}`
    );

    const assetAItem = itemsAfterCreate.find((it) => it.assetId === assetAId);
    log(
        Number(assetAItem?.rebateUnit) === 10 && Number(assetAItem?.markupPips) === 5,
        '4b. Item assetA giữ đúng giá trị Admin đã set (10, 5)',
        assetAItem
    );

    const assetBItem = itemsAfterCreate.find((it) => it.assetId === assetBId);
    log(
        Number(assetBItem?.rebateUnit) === 0 && Number(assetBItem?.markupPips) === 0,
        '4c. Item assetB (không liệt kê) tự động là placeholder (0,0)',
        assetBItem
    );

    // --- 5. Sửa template: đổi name + update lại 1 item (assetB) ---
    const updateTpl = await request(
        'PATCH',
        `/admin/templates/${templateId}`,
        { name: `Test Template ${RUN_ID} — Updated`, items: [{ assetId: assetBId, rebateUnit: 3, markupPips: 2 }] },
        adminToken
    );
    log(updateTpl.status === 200, '5a. Sửa template (đổi name + update 1 item)', updateTpl);

    const assetBItemAfterUpdate = (updateTpl.body?.items ?? []).find((it) => it.assetId === assetBId);
    log(
        Number(assetBItemAfterUpdate?.rebateUnit) === 3 && Number(assetBItemAfterUpdate?.markupPips) === 2,
        '5b. Item assetB đã cập nhật đúng giá trị mới (3, 2)',
        assetBItemAfterUpdate
    );

    const assetAItemAfterUpdate = (updateTpl.body?.items ?? []).find((it) => it.assetId === assetAId);
    log(
        Number(assetAItemAfterUpdate?.rebateUnit) === 10 && Number(assetAItemAfterUpdate?.markupPips) === 5,
        '5c. Item assetA KHÔNG bị đổi khi chỉ PATCH item assetB (item khác giữ nguyên)',
        assetAItemAfterUpdate
    );

    log(updateTpl.body?.name === `Test Template ${RUN_ID} — Updated`, '5d. Name đã đổi đúng', updateTpl.body?.name);

    // --- 6. Tạo 1 User MIB test riêng cho run này, để test Apply Template ---
    const createUser = await request(
        'POST',
        '/admin/users',
        { email: `t4_mib_${RUN_ID}@test.local`, password: 'Test@1234', fullName: `Flow04 MIB ${RUN_ID}`, role: 'MIB' },
        adminToken
    );
    log(createUser.status === 201, '6. Tạo User MIB test (root, riêng cho run này)', createUser);
    const testUserId = createUser.body?.id;

    // --- 7. Admin áp Template cho User MIB root vừa tạo — phải bypass cap/orphan check ---
    const applyTpl = await request('POST', `/templates/${templateId}/apply/${testUserId}`, {}, adminToken);
    log(applyTpl.status === 201 || applyTpl.status === 200, '7a. Admin áp template cho MIB root mới tạo', applyTpl);

    const appliedList = Array.isArray(applyTpl.body) ? applyTpl.body : [];
    // Placeholder (0,0) phải bị lọc bỏ khi apply — chỉ 2 item non-zero (assetA=10,5 và
    // assetB=3,2) thực sự được ghi, KHÔNG tính mọi asset khác trong hệ thống.
    log(
        appliedList.length === 2,
        '7b. Số item thực sự được ghi khi Apply = đúng 2 (đã lọc bỏ mọi item (0,0) placeholder)',
        `applied=${appliedList.length}`
    );

    // --- 8. Verify config đã thực sự được tạo cho user qua GET children ---
    // LƯU Ý: assetId là query param BẮT BUỘC ở endpoint này (theo API_REFERENCE.md:
    // "GET /commission-configs/children/:userId?assetId="), gọi thiếu sẽ bị 400.
    // Bản trước của script này gọi thiếu assetId nên bị FAIL nhầm — đã sửa.
    const children = await request(
        'GET',
        `/commission-configs/children/${testUserId}?assetId=${assetAId}`,
        undefined,
        adminToken
    );
    log(children.status === 200, '8a. GET commission-configs/children (kèm assetId) sau khi apply → 200', children);

    const childrenSelf = children.body?.self;
    log(
        childrenSelf && Number(childrenSelf.rebateUnit) === 10 && Number(childrenSelf.markupPips) === 5,
        '8b. Config của chính testUser cho assetA đúng giá trị đã apply (10, 5)',
        childrenSelf
    );

    // --- 9. Asset đang được template tham chiếu (item khác 0,0) → xoá phải bị chặn ---
    const deleteReferencedAsset = await request('DELETE', `/admin/assets/${assetAId}`, undefined, adminToken);
    log(
        deleteReferencedAsset.status === 400,
        '9. Xoá asset đang có template item khác (0,0) → 400 (bị chặn)',
        deleteReferencedAsset
    );

    // --- 10. Xoá Template ---
    const deleteTpl = await request('DELETE', `/admin/templates/${templateId}`, undefined, adminToken);
    log(deleteTpl.status === 200 || deleteTpl.status === 204, '10a. Xoá template', deleteTpl.status);

    const listAfterDelete = await request('GET', '/admin/templates', undefined, adminToken);
    const stillExists = Array.isArray(listAfterDelete.body) && listAfterDelete.body.some((t) => t.id === templateId);
    log(!stillExists, '10b. Template đã biến mất khỏi list sau khi xoá', stillExists);

    // --- 11. Thông tin thêm (KHÔNG assert cứng): sau khi xoá template, thử xoá lại assetA.
    // assetA vẫn có thể còn tham chiếu bởi CommissionConfig (đã tạo ở bước Apply #7),
    // nên vẫn có thể trả 400 vì lý do khác — đây là hành vi đúng, không phải bug của
    // riêng Template, chỉ log lại để tham khảo.
    const deleteAssetAfterTplDeleted = await request('DELETE', `/admin/assets/${assetAId}`, undefined, adminToken);
    console.log(
        `ℹ️  INFO — 11. Xoá assetA sau khi xoá template: status=${deleteAssetAfterTplDeleted.status} ` +
        (deleteAssetAfterTplDeleted.status === 400
            ? '(vẫn bị chặn — khả năng do CommissionConfig tạo ở bước Apply, không phải bug Template)'
            : '(đã xoá được)')
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