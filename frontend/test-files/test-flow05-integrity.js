// test-flow05-integrity.js
// Flow 05 — Admin: Integrity Check panel (test ở tầng API, không phải UI).
// Node.js thuần dùng global fetch (yêu cầu Node >= 18, xem BACKEND_SETUP.md).
// An toàn chạy lại nhiều lần: user test tạo riêng cho run này có suffix RUN_ID,
// KHÔNG đụng tới seed account cố định (admin_test@azrebate.com, mib@test.com, ...).
//
// LƯU Ý QUAN TRỌNG: script này KHÔNG tự tạo vi phạm giả. Endpoint
// /admin/integrity-check chỉ ĐỌC vi phạm đã có sẵn trong DB — không thể tạo
// vi phạm mới qua API vì POST/PATCH /commission-configs luôn enforce rule
// "con ≤ cha" (BUSINESS_RULES.md mục 2.1), nên mọi request cố tình tạo vi phạm
// sẽ bị 400. Nếu seed data có sẵn vi phạm CRYPTO/GAUCNH (xem DATABASE.md mục 5),
// script sẽ log ra để đối chiếu tay — KHÔNG hard-fail nếu không thấy (seed có
// thể đã đổi hoặc đã được dọn từ trước).
//
// Chạy: cd backend/test && node test-flow05-integrity.js

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

// Kiểm tra 1 violation object đúng shape FLAT như interface `ChainViolation`
// (API_REFERENCE.md mục Integrity Check — đã verify trực tiếp từ integrity.service.ts).
function checkViolationShape(v, idx) {
    const stringFields = ['assetCode', 'assetId', 'childEmail', 'childUserId', 'parentEmail', 'parentUserId'];
    const numberFields = ['childRebate', 'childMarkup', 'parentRebate', 'parentMarkup'];
    const boolFields = ['violatesRebate', 'violatesMarkup'];

    const problems = [];
    for (const f of stringFields) if (typeof v[f] !== 'string') problems.push(`${f}=${typeof v[f]}`);
    for (const f of numberFields) if (typeof v[f] !== 'number') problems.push(`${f}=${typeof v[f]}`);
    for (const f of boolFields) if (typeof v[f] !== 'boolean') problems.push(`${f}=${typeof v[f]}`);

    log(
        problems.length === 0,
        `violation[${idx}] đúng shape FLAT, đủ field đúng type`,
        problems.length ? problems.join(', ') : undefined
    );

    // Không fail cứng — backend là nguồn sự thật, đây chỉ để đối chiếu tham khảo,
    // soi ngược cờ violatesRebate/violatesMarkup có hợp lý so với số thực nhận được không.
    if (problems.length === 0) {
        const expectRebate = v.childRebate > v.parentRebate;
        const expectMarkup = v.childMarkup > v.parentMarkup;
        if (v.violatesRebate !== expectRebate) {
            console.log(
                `ℹ️  INFO — violation[${idx}] violatesRebate=${v.violatesRebate} nhưng childRebate(${v.childRebate}) vs parentRebate(${v.parentRebate}) gợi ý ${expectRebate}`
            );
        }
        if (v.violatesMarkup !== expectMarkup) {
            console.log(
                `ℹ️  INFO — violation[${idx}] violatesMarkup=${v.violatesMarkup} nhưng childMarkup(${v.childMarkup}) vs parentMarkup(${v.parentMarkup}) gợi ý ${expectMarkup}`
            );
        }
    }
}

async function main() {
    console.log(`\n=== Flow 05 — Integrity Check — RUN_ID=${RUN_ID} ===\n`);

    // --- 0. Login Admin ---
    const login = await request('POST', '/auth/admin/login', { email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
    log(login.status === 201 || login.status === 200, '0. Admin login', login);
    const adminToken = login.body?.accessToken;
    if (!adminToken) {
        console.log('\nKhông lấy được accessToken, dừng test.');
        process.exit(1);
    }

    // --- 1. Tạo 1 User MIB test riêng cho run này, để có token non-admin thật ---
    // (không dùng seed account cố định, tránh phụ thuộc credentials có sẵn ngoài Admin)
    const createUser = await request(
        'POST',
        '/admin/users',
        { email: `t5_mib_${RUN_ID}@test.local`, password: 'Test@1234', fullName: `Flow05 MIB ${RUN_ID}`, role: 'MIB' },
        adminToken
    );
    log(createUser.status === 201, '1. Tạo User MIB test (để lấy token non-admin)', createUser);

    const nonAdminLogin = await request('POST', '/auth/user/login', {
        email: `t5_mib_${RUN_ID}@test.local`,
        password: 'Test@1234',
    });
    log(nonAdminLogin.status === 201 || nonAdminLogin.status === 200, '2. Login User MIB test vừa tạo', nonAdminLogin);
    const nonAdminToken = nonAdminLogin.body?.accessToken;

    // --- 3. Admin gọi GET /admin/integrity-check → 200 + mảng đúng shape ---
    const adminCheck = await request('GET', '/admin/integrity-check', undefined, adminToken);
    log(adminCheck.status === 200, '3a. Admin gọi integrity-check → 200', adminCheck.status);
    log(Array.isArray(adminCheck.body), '3b. Response là array', typeof adminCheck.body);

    const violations = Array.isArray(adminCheck.body) ? adminCheck.body : [];
    console.log(`   Tìm thấy ${violations.length} vi phạm.`);
    violations.forEach((v, idx) => checkViolationShape(v, idx));

    if (violations.length > 0) {
        const codes = [...new Set(violations.map((v) => v.assetCode))];
        console.log(`   assetCode xuất hiện: ${codes.join(', ')}`);
        console.log('   Đối chiếu tay với DATABASE.md mục 5 nếu cần xác nhận đúng vi phạm CRYPTO/GAUCNH.');
    } else {
        console.log(
            '   ℹ️  Danh sách rỗng — nếu đang mong đợi seed violations CRYPTO/GAUCNH, kiểm tra lại đã seed đúng DB hoặc đã bị dọn từ trước.'
        );
    }

    // --- 4. Non-admin gọi → 403 ---
    if (nonAdminToken) {
        const nonAdminCheck = await request('GET', '/admin/integrity-check', undefined, nonAdminToken);
        log(nonAdminCheck.status === 403, '4. Non-admin gọi integrity-check → 403', nonAdminCheck);
    } else {
        console.log('⚠️  Bỏ qua test 4 (non-admin 403) vì bước 2 không lấy được token.');
    }

    // --- 5. Không kèm token → 401 ---
    // Không nằm trong bảng lỗi của API_REFERENCE.md (bảng đó chỉ liệt kê 400/403/404/409)
    // — verify lại bằng log thật ở đây; nếu status thực tế khác 401 thì cập nhật lại
    // API_REFERENCE.md, đừng tự sửa assert này để "cho pass".
    const noTokenCheck = await request('GET', '/admin/integrity-check');
    log(noTokenCheck.status === 401, '5. Gọi integrity-check KHÔNG kèm token → 401', noTokenCheck);

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